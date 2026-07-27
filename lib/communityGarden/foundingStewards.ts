import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MAX_WATERING_TARGETS,
  selectDirectionalWateringTargets,
} from "@/app/community-garden/lib/wateringSelection";
import {
  FoundingStewardActionType,
  getFoundingStewardActionId,
  getFoundingStewardDueActions,
  getFoundingStewardSchedule,
} from "./foundingStewardPolicy";
import { getGardenErrorCode } from "./health";
import {
  loadCommunityGardenSnapshot,
  submitCommunityGardenAction,
} from "./publicGardenServer";

const TUTORIAL_CLEARANCE_TILES = 12;
const REGION_SIZE = 16;
const LOCAL_WATER_REACH_TILES = 6;
const PLANT_TYPES = ["rose", "sunflower", "lavender"] as const;

// Each session follows one compact trail. Rotating and mirroring these trails
// produces rows and small patches instead of scatterplot planting.
const PLANT_TRAILS = [
  [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [4, 1], [3, 1]],
  [[0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [1, 3], [1, 2], [1, 1]],
  [[1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
  [[-1, 0], [-2, 0], [-3, 0], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1]],
] as const;

type GardenCell = { gridX: number; gridY: number };
type OwnerKind = "paid_member" | "founding_steward";

type StewardPlan = {
  runDate: string;
  sessionSlot: number;
  paidMemberCount: number;
  stewards: Array<{
    stewardId: number;
    code: string;
    displayName: string;
    actorKey: string;
    networkKey: string;
    dailyPlantActions: number;
    dailyWaterActions: number;
    dailyWeedActions: number;
  }>;
  waterCandidates: Array<GardenCell & {
    plantId: string;
    regionX: number;
    regionY: number;
    plantType: string;
    ownerKind: OwnerKind;
    blockedStewardIds: number[];
  }>;
  plantAnchors: Array<GardenCell & {
    plantId: string;
    regionX: number;
    regionY: number;
  }>;
  weedCandidates: Array<GardenCell & {
    weedId: string;
    regionX: number;
    regionY: number;
  }>;
};

type LoggedAction = {
  actionId: string;
  stewardId: number;
  actionOrdinal: number;
  actionType: FoundingStewardActionType;
  targetOwnerKind: OwnerKind | "garden";
  targetPlantId: string | null;
  targetIds: string[];
  gridX: number;
  gridY: number;
  regionX: number;
  regionY: number;
  sessionSlot: number;
};

type ActionOutcome = {
  success: boolean;
  actionType: FoundingStewardActionType;
  affectedCount: number;
  heritagePromotionsCompleted: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function parsePlan(value: unknown): StewardPlan {
  const source = record(value);
  if (!source) throw new Error("The Founding Steward plan was unavailable.");
  return {
    runDate: stringValue(source.runDate),
    sessionSlot: numberValue(source.sessionSlot),
    paidMemberCount: numberValue(source.paidMemberCount),
    stewards: arrayValue(source.stewards).flatMap((item) => {
      const row = record(item);
      return row ? [{
        stewardId: numberValue(row.stewardId),
        code: stringValue(row.code),
        displayName: stringValue(row.displayName),
        actorKey: stringValue(row.actorKey),
        networkKey: stringValue(row.networkKey),
        dailyPlantActions: numberValue(row.dailyPlantActions),
        dailyWaterActions: numberValue(row.dailyWaterActions),
        dailyWeedActions: numberValue(row.dailyWeedActions),
      }] : [];
    }),
    waterCandidates: arrayValue(source.waterCandidates).flatMap((item) => {
      const row = record(item);
      if (!row) return [];
      const ownerKind = stringValue(row.ownerKind);
      if (ownerKind !== "paid_member" && ownerKind !== "founding_steward") return [];
      return [{
        plantId: stringValue(row.plantId),
        gridX: numberValue(row.gridX),
        gridY: numberValue(row.gridY),
        regionX: numberValue(row.regionX),
        regionY: numberValue(row.regionY),
        plantType: stringValue(row.plantType),
        ownerKind,
        blockedStewardIds: arrayValue(row.blockedStewardIds).map(numberValue),
      }];
    }),
    plantAnchors: arrayValue(source.plantAnchors).flatMap((item) => {
      const row = record(item);
      return row ? [{
        plantId: stringValue(row.plantId),
        gridX: numberValue(row.gridX),
        gridY: numberValue(row.gridY),
        regionX: numberValue(row.regionX),
        regionY: numberValue(row.regionY),
      }] : [];
    }),
    weedCandidates: arrayValue(source.weedCandidates).flatMap((item) => {
      const row = record(item);
      return row ? [{
        weedId: stringValue(row.weedId),
        gridX: numberValue(row.gridX),
        gridY: numberValue(row.gridY),
        regionX: numberValue(row.regionX),
        regionY: numberValue(row.regionY),
      }] : [];
    }),
  };
}

function key(x: number, y: number) {
  return `${x}:${y}`;
}

function cellFromSnapshot(value: unknown): GardenCell | null {
  const row = record(value);
  if (!row) return null;
  return {
    gridX: numberValue(row.grid_x ?? row.gridX),
    gridY: numberValue(row.grid_y ?? row.gridY),
  };
}

function farFromTutorialSpawns(cell: GardenCell, spawnPoints: GardenCell[]) {
  return spawnPoints.every((spawn) =>
    Math.hypot(cell.gridX - spawn.gridX, cell.gridY - spawn.gridY) >= TUTORIAL_CLEARANCE_TILES);
}

function sameRegion(x: number, y: number, regionX: number, regionY: number) {
  return Math.floor(x / REGION_SIZE) === regionX && Math.floor(y / REGION_SIZE) === regionY;
}

function distance(left: GardenCell, right: GardenCell) {
  return Math.hypot(left.gridX - right.gridX, left.gridY - right.gridY);
}

function stableNumber(...parts: Array<string | number>) {
  let value = 2166136261;
  for (const character of parts.join(":")) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function chooseSessionAnchor(
  anchors: StewardPlan["plantAnchors"],
  runDate: string,
  stewardId: number,
  sessionSlot: number,
) {
  if (!anchors.length) return null;
  return anchors[stableNumber(runDate, stewardId, sessionSlot) % anchors.length];
}

function findPlantCell(input: {
  anchor: NonNullable<ReturnType<typeof chooseSessionAnchor>>;
  occupied: Set<string>;
  spawnPoints: GardenCell[];
  trailIndex: number;
  attemptIndex: number;
}) {
  const trail = PLANT_TRAILS[input.trailIndex % PLANT_TRAILS.length];
  for (let retry = 0; retry < 32; retry += 1) {
    const offset = trail[(input.attemptIndex + retry) % trail.length];
    const lap = Math.floor((input.attemptIndex + retry) / trail.length);
    const gridX = input.anchor.gridX + offset[0] + lap * (input.trailIndex % 2 ? 1 : 0);
    const gridY = input.anchor.gridY + offset[1] + lap * (input.trailIndex % 2 ? 0 : 1);
    if (!sameRegion(gridX, gridY, input.anchor.regionX, input.anchor.regionY)) continue;
    if (input.occupied.has(key(gridX, gridY))) continue;
    if (!farFromTutorialSpawns({ gridX, gridY }, input.spawnPoints)) continue;
    return { gridX, gridY };
  }
  return null;
}

function buildWaterChain<T extends GardenCell & { plantId: string }>(
  available: T[],
  sessionAnchor: GardenCell,
) {
  if (!available.length) return [];
  const seed = [...available].sort((a, b) => distance(a, sessionAnchor) - distance(b, sessionAnchor))[0];
  const byId = new Map(available.map((candidate) => [candidate.plantId, candidate]));
  return selectDirectionalWateringTargets({
    clickedGridX: seed.gridX,
    clickedGridY: seed.gridY,
    maryGridX: sessionAnchor.gridX,
    maryGridY: sessionAnchor.gridY,
    anchorCandidateId: seed.plantId,
    candidates: available.map((candidate) => ({
      id: candidate.plantId,
      gridX: candidate.gridX,
      gridY: candidate.gridY,
      careReady: true,
    })),
    maxTargets: MAX_WATERING_TARGETS,
    maxReach: LOCAL_WATER_REACH_TILES,
  }).map((candidate) => byId.get(candidate.id)).filter((candidate): candidate is T => Boolean(candidate));
}

async function upsertAction(input: LoggedAction & {
  runId: string;
  status: "pending" | "success" | "failed";
  affectedCount?: number;
  careAwarded?: number;
  heritagePlantIds?: string[];
  errorCode?: string | null;
}) {
  const { error } = await getSupabaseAdmin()
    .from("community_garden_founding_steward_actions")
    .upsert({
      action_id: input.actionId,
      run_id: input.runId,
      steward_id: input.stewardId,
      action_ordinal: input.actionOrdinal,
      action_type: input.actionType,
      status: input.status,
      target_owner_kind: input.targetOwnerKind,
      target_plant_id: input.targetPlantId,
      grid_x: input.gridX,
      grid_y: input.gridY,
      region_x: input.regionX,
      region_y: input.regionY,
      session_slot: input.sessionSlot,
      affected_count: input.affectedCount ?? 0,
      care_awarded: input.careAwarded ?? 0,
      heritage_plant_ids: input.heritagePlantIds ?? [],
      error_code: input.errorCode ?? null,
      completed_at: input.status === "pending" ? null : new Date().toISOString(),
    }, { onConflict: "action_id" });
  if (error) throw error;
}

async function performLoggedAction(input: LoggedAction & {
  runId: string;
  actorKey: string;
  networkKey: string;
  plantType?: string;
}): Promise<ActionOutcome> {
  await upsertAction({ ...input, status: "pending" });
  try {
    const result = record(await submitCommunityGardenAction({
      actionId: input.actionId,
      actorKey: input.actorKey,
      networkKey: input.networkKey,
      identityKind: "account",
      action: input.actionType,
      gridX: input.actionType === "plant" ? input.gridX : undefined,
      gridY: input.actionType === "plant" ? input.gridY : undefined,
      plantType: input.plantType,
      plantIds: input.actionType === "plant" ? undefined : input.targetIds,
    }));
    const plants = arrayValue(result?.plants);
    const planted = record(result?.plant);
    const heritagePlantIds = arrayValue(result?.heritagePlantIds)
      .filter((item): item is string => typeof item === "string");
    const affectedCount = input.actionType === "plant"
      ? (planted || plants.length ? 1 : 0)
      : input.actionType === "weed"
        ? (stringValue(result?.removedWeedId) ? 1 : 0)
        : plants.length;
    await upsertAction({
      ...input,
      status: "success",
      affectedCount,
      careAwarded: numberValue(result?.careAwarded),
      heritagePlantIds,
    });
    return {
      success: true,
      actionType: input.actionType,
      affectedCount,
      heritagePromotionsCompleted: heritagePlantIds.length,
    };
  } catch (error) {
    await upsertAction({ ...input, status: "failed", errorCode: getGardenErrorCode(error) });
    return {
      success: false,
      actionType: input.actionType,
      affectedCount: 0,
      heritagePromotionsCompleted: 0,
    };
  }
}

async function loadRunActions(runId: string) {
  const rows: Array<{
    steward_id: number;
    action_ordinal: number;
    action_type: FoundingStewardActionType;
    status: string;
    affected_count: number;
    heritage_plant_ids: string[];
  }> = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await getSupabaseAdmin()
      .from("community_garden_founding_steward_actions")
      .select("steward_id,action_ordinal,action_type,status,affected_count,heritage_plant_ids")
      .eq("run_id", runId)
      .order("action_ordinal")
      .range(start, start + 999);
    if (error) throw error;
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function runCommunityGardenFoundingStewardSession(now = new Date()) {
  const schedule = getFoundingStewardSchedule(now);
  if (!schedule.active || schedule.sessionSlot === null) {
    return { runDate: schedule.runDate, status: "outside-active-hours" as const };
  }

  const admin = getSupabaseAdmin();
  const { data: planData, error: planError } = await admin.rpc(
    "get_community_garden_founding_steward_plan_v2",
    { p_run_date: schedule.runDate, p_session_slot: schedule.sessionSlot },
  );
  if (planError) throw planError;
  const plan = parsePlan(planData);
  const targetPlantActions = plan.stewards.reduce((sum, steward) => sum + steward.dailyPlantActions, 0);
  const targetWaterActions = plan.stewards.reduce((sum, steward) => sum + steward.dailyWaterActions, 0);
  const targetWeedActions = plan.stewards.reduce((sum, steward) => sum + steward.dailyWeedActions, 0);
  const targetActions = targetPlantActions + targetWaterActions + targetWeedActions;

  const { data: run, error: runError } = await admin
    .from("community_garden_founding_steward_runs")
    .upsert({
      run_date: schedule.runDate,
      status: plan.paidMemberCount > 0 ? "running" : "skipped",
      paid_member_count: plan.paidMemberCount,
      target_actions: targetActions,
      target_plant_actions: targetPlantActions,
      target_water_actions: targetWaterActions,
      target_weed_actions: targetWeedActions,
      completed_at: plan.paidMemberCount > 0 ? null : now.toISOString(),
      error_summary: null,
    }, { onConflict: "run_date" })
    .select("run_id")
    .single();
  if (runError) throw runError;
  if (plan.paidMemberCount === 0) {
    return { runDate: schedule.runDate, status: "skipped" as const, reason: "no-paid-members" };
  }

  const priorActions = await loadRunActions(run.run_id);
  const snapshot = await loadCommunityGardenSnapshot();
  const plants = arrayValue(snapshot.plants).flatMap((item) => {
    const cell = cellFromSnapshot(item);
    return cell ? [cell] : [];
  });
  const weeds = arrayValue(snapshot.weeds).flatMap((item) => {
    const cell = cellFromSnapshot(item);
    return cell ? [cell] : [];
  });
  const spawnPoints = arrayValue(snapshot.spawnPoints).flatMap((item) => {
    const cell = cellFromSnapshot(item);
    return cell ? [cell] : [];
  });
  const occupied = new Set([...plants, ...weeds].map((cell) => key(cell.gridX, cell.gridY)));
  const safeAnchors = plan.plantAnchors.filter((cell) => farFromTutorialSpawns(cell, spawnPoints));
  const safeWater = plan.waterCandidates.filter((cell) => farFromTutorialSpawns(cell, spawnPoints));
  const safeWeeds = plan.weedCandidates.filter((cell) => farFromTutorialSpawns(cell, spawnPoints));

  const outcomes = (await Promise.all(plan.stewards.map(async (steward) => {
    const successfulOrdinals = new Set(priorActions
      .filter((action) => action.steward_id === steward.stewardId && action.status === "success")
      .map((action) => action.action_ordinal));
    const due = getFoundingStewardDueActions({
      ...steward,
      sessionSlot: schedule.sessionSlot!,
      successfulOrdinals,
    });
    const anchor = chooseSessionAnchor(
      safeAnchors,
      schedule.runDate,
      steward.stewardId,
      schedule.sessionSlot!,
    );
    if (!anchor) return [];

    const stewardOutcomes: ActionOutcome[] = [];
    const trailIndex = stableNumber(schedule.runDate, steward.stewardId, schedule.sessionSlot!) % PLANT_TRAILS.length;
    let plantAttempt = 0;
    const waterPool = safeWater
      .filter((candidate) => !candidate.blockedStewardIds.includes(steward.stewardId))
      .filter((candidate) =>
        stableNumber(candidate.plantId, schedule.runDate, schedule.sessionSlot!) % plan.stewards.length ===
          steward.stewardId - 1)
      .sort((a, b) => distance(a, anchor) - distance(b, anchor));
    const weedPool = safeWeeds
      .filter((candidate) =>
        stableNumber(candidate.weedId, schedule.runDate, schedule.sessionSlot!) % plan.stewards.length ===
          steward.stewardId - 1)
      .sort((a, b) => distance(a, anchor) - distance(b, anchor));

    for (const action of due) {
      const common = {
        runId: run.run_id,
        actionId: getFoundingStewardActionId(
          schedule.runDate,
          steward.stewardId,
          action.actionOrdinal,
        ),
        stewardId: steward.stewardId,
        actionOrdinal: action.actionOrdinal,
        sessionSlot: schedule.sessionSlot!,
        actorKey: steward.actorKey,
        networkKey: steward.networkKey,
      };
      if (action.actionType === "plant") {
        const cell = findPlantCell({
          anchor,
          occupied,
          spawnPoints,
          trailIndex,
          attemptIndex: plantAttempt,
        });
        plantAttempt += 1;
        if (!cell) continue;
        occupied.add(key(cell.gridX, cell.gridY));
        stewardOutcomes.push(await performLoggedAction({
          ...common,
          actionType: "plant",
          targetOwnerKind: "founding_steward",
          targetPlantId: null,
          targetIds: [],
          gridX: cell.gridX,
          gridY: cell.gridY,
          regionX: anchor.regionX,
          regionY: anchor.regionY,
          plantType: PLANT_TYPES[stableNumber(
            schedule.runDate,
            steward.stewardId,
            action.actionOrdinal,
          ) % PLANT_TYPES.length],
        }));
      } else if (action.actionType === "water") {
        const chain = buildWaterChain(waterPool, anchor);
        if (!chain.length) continue;
        for (const candidate of chain) {
          waterPool.splice(waterPool.findIndex((item) => item.plantId === candidate.plantId), 1);
        }
        stewardOutcomes.push(await performLoggedAction({
          ...common,
          actionType: "water",
          targetOwnerKind: chain[0].ownerKind,
          targetPlantId: chain[0].plantId,
          targetIds: chain.map((candidate) => candidate.plantId),
          gridX: chain[0].gridX,
          gridY: chain[0].gridY,
          regionX: chain[0].regionX,
          regionY: chain[0].regionY,
        }));
      } else {
        const weed = weedPool.shift();
        if (!weed) continue;
        stewardOutcomes.push(await performLoggedAction({
          ...common,
          actionType: "weed",
          targetOwnerKind: "garden",
          targetPlantId: null,
          targetIds: [weed.weedId],
          gridX: weed.gridX,
          gridY: weed.gridY,
          regionX: weed.regionX,
          regionY: weed.regionY,
        }));
      }
    }
    return stewardOutcomes;
  }))).flat();

  const allActions = await loadRunActions(run.run_id);
  const successful = allActions.filter((action) => action.status === "success");
  const failed = allActions.filter((action) => action.status === "failed");
  const status = successful.length >= targetActions
    ? "completed"
    : failed.length > 0 || schedule.sessionSlot === 31 ? "partial" : "running";
  const { error: completeError } = await admin
    .from("community_garden_founding_steward_runs")
    .update({
      status,
      actions_attempted: allActions.length,
      actions_succeeded: successful.length,
      actions_failed: failed.length,
      plants_placed: successful.filter((action) => action.action_type === "plant").length,
      flowers_watered: successful
        .filter((action) => action.action_type === "water")
        .reduce((sum, action) => sum + action.affected_count, 0),
      weeds_removed: successful.filter((action) => action.action_type === "weed").length,
      heritage_promotions_completed: successful.reduce(
        (sum, action) => sum + (action.heritage_plant_ids?.length ?? 0),
        0,
      ),
      completed_at: status === "completed" ? now.toISOString() : null,
      error_summary: failed.length
        ? `${failed.length} steward action(s) failed; see the private action audit.`
        : null,
    })
    .eq("run_id", run.run_id);
  if (completeError) throw completeError;

  return {
    runDate: schedule.runDate,
    sessionSlot: schedule.sessionSlot,
    status,
    paidMemberCount: plan.paidMemberCount,
    actionsAttemptedThisSession: outcomes.length,
    actionsSucceededThisSession: outcomes.filter((outcome) => outcome.success).length,
    actionsSucceededToday: successful.length,
    targetActions,
  };
}

// Backward-compatible export used by the existing cron route and older tests.
export const runCommunityGardenFoundingStewards = runCommunityGardenFoundingStewardSession;
