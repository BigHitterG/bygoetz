import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getFoundingStewardActionId } from "./foundingStewardPolicy";
import { getGardenErrorCode } from "./health";
import {
  loadCommunityGardenSnapshot,
  submitCommunityGardenAction,
} from "./publicGardenServer";

const TUTORIAL_CLEARANCE_TILES = 8;
const REGION_SIZE = 16;
const PLANT_TYPES = ["rose", "sunflower", "lavender"] as const;
const PLANT_OFFSETS = [
  [1, 0], [0, 1], [-1, 0], [0, -1],
  [1, 1], [-1, 1], [-1, -1], [1, -1],
  [2, 0], [0, 2], [-2, 0], [0, -2],
  [2, 1], [1, 2], [-1, 2], [-2, 1],
  [-2, -1], [-1, -2], [1, -2], [2, -1],
] as const;

type StewardPlan = {
  runDate: string;
  paidMemberCount: number;
  stewards: Array<{
    stewardId: number;
    code: string;
    displayName: string;
    actorKey: string;
    networkKey: string;
    dailyPlantActions: number;
    dailyWaterActions: number;
  }>;
  waterCandidates: Array<{
    plantId: string;
    gridX: number;
    gridY: number;
    regionX: number;
    regionY: number;
    plantType: string;
    ownerKind: "paid_member" | "founding_steward";
  }>;
  plantAnchors: Array<{
    plantId: string;
    gridX: number;
    gridY: number;
    regionX: number;
    regionY: number;
  }>;
};

type LoggedAction = {
  actionId: string;
  stewardId: number;
  actionOrdinal: number;
  actionType: "plant" | "water";
  targetOwnerKind: "paid_member" | "founding_steward";
  targetPlantId: string | null;
  gridX: number;
  gridY: number;
  regionX: number;
  regionY: number;
};

type ActionOutcome = {
  success: boolean;
  actionType: "plant" | "water";
  plantsPlaced: number;
  flowersWatered: number;
  heritagePromotionsCompleted: number;
};

type GardenCell = { gridX: number; gridY: number };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
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
    paidMemberCount: numberValue(source.paidMemberCount),
    stewards: arrayValue(source.stewards).flatMap((item) => {
      const row = record(item);
      if (!row) return [];
      return [{
        stewardId: numberValue(row.stewardId),
        code: stringValue(row.code),
        displayName: stringValue(row.displayName),
        actorKey: stringValue(row.actorKey),
        networkKey: stringValue(row.networkKey),
        dailyPlantActions: numberValue(row.dailyPlantActions),
        dailyWaterActions: numberValue(row.dailyWaterActions),
      }];
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
      }];
    }),
    plantAnchors: arrayValue(source.plantAnchors).flatMap((item) => {
      const row = record(item);
      if (!row) return [];
      return [{
        plantId: stringValue(row.plantId),
        gridX: numberValue(row.gridX),
        gridY: numberValue(row.gridY),
        regionX: numberValue(row.regionX),
        regionY: numberValue(row.regionY),
      }];
    }),
  };
}

function key(x: number, y: number) {
  return `${x}:${y}`;
}

function cellFromSnapshot(value: unknown): GardenCell | null {
  const row = record(value);
  if (!row) return null;
  const gridX = numberValue(row.grid_x ?? row.gridX);
  const gridY = numberValue(row.grid_y ?? row.gridY);
  return { gridX, gridY };
}

function farFromTutorialSpawns(cell: GardenCell, spawnPoints: GardenCell[]) {
  return spawnPoints.every(
    (spawn) => Math.hypot(cell.gridX - spawn.gridX, cell.gridY - spawn.gridY) >= TUTORIAL_CLEARANCE_TILES,
  );
}

function sameRegion(x: number, y: number, regionX: number, regionY: number) {
  return Math.floor(x / REGION_SIZE) === regionX && Math.floor(y / REGION_SIZE) === regionY;
}

function findPlantCell(input: {
  anchor: StewardPlan["plantAnchors"][number];
  occupied: Set<string>;
  spawnPoints: GardenCell[];
  rotation: number;
}) {
  for (let index = 0; index < PLANT_OFFSETS.length; index += 1) {
    const offset = PLANT_OFFSETS[(index + input.rotation) % PLANT_OFFSETS.length];
    const gridX = input.anchor.gridX + offset[0];
    const gridY = input.anchor.gridY + offset[1];
    if (!sameRegion(gridX, gridY, input.anchor.regionX, input.anchor.regionY)) continue;
    if (input.occupied.has(key(gridX, gridY))) continue;
    if (!farFromTutorialSpawns({ gridX, gridY }, input.spawnPoints)) continue;
    return { gridX, gridY };
  }
  return null;
}

async function upsertAction(input: LoggedAction & {
  runId: string;
  status: "pending" | "success" | "failed";
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
      care_awarded: input.careAwarded ?? 0,
      heritage_plant_ids: input.heritagePlantIds ?? [],
      error_code: input.errorCode ?? null,
      completed_at: input.status === "pending" ? null : new Date().toISOString(),
    }, { onConflict: "action_id" });
  if (error) throw error;
}

async function performLoggedAction(
  input: LoggedAction & {
    runId: string;
    actorKey: string;
    networkKey: string;
    plantType?: string;
  },
): Promise<ActionOutcome> {
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
      plantIds: input.actionType === "water" && input.targetPlantId
        ? [input.targetPlantId]
        : undefined,
    }));
    const plants = arrayValue(result?.plants);
    const heritagePlantIds = arrayValue(result?.heritagePlantIds)
      .filter((item): item is string => typeof item === "string");
    const careAwarded = numberValue(result?.careAwarded);
    await upsertAction({
      ...input,
      status: "success",
      careAwarded,
      heritagePlantIds,
    });
    return {
      success: true,
      actionType: input.actionType,
      plantsPlaced: input.actionType === "plant" ? Math.max(1, plants.length) : 0,
      flowersWatered: input.actionType === "water" ? Math.max(1, plants.length) : 0,
      heritagePromotionsCompleted: heritagePlantIds.length,
    };
  } catch (error) {
    await upsertAction({
      ...input,
      status: "failed",
      errorCode: getGardenErrorCode(error),
    });
    return {
      success: false,
      actionType: input.actionType,
      plantsPlaced: 0,
      flowersWatered: 0,
      heritagePromotionsCompleted: 0,
    };
  }
}

export async function runCommunityGardenFoundingStewards(runDate = new Date().toISOString().slice(0, 10)) {
  const admin = getSupabaseAdmin();
  const { data: planData, error: planError } = await admin.rpc(
    "get_community_garden_founding_steward_plan_v1",
    { p_run_date: runDate },
  );
  if (planError) throw planError;
  const plan = parsePlan(planData);

  const { data: priorRun, error: priorError } = await admin
    .from("community_garden_founding_steward_runs")
    .select("run_id,status,actions_attempted,actions_succeeded,actions_failed,plants_placed,flowers_watered,heritage_promotions_completed")
    .eq("run_date", runDate)
    .maybeSingle();
  if (priorError) throw priorError;
  if (priorRun?.status === "completed" || priorRun?.status === "skipped") {
    return { runDate, status: priorRun.status, alreadyProcessed: true };
  }

  const { data: run, error: runError } = await admin
    .from("community_garden_founding_steward_runs")
    .upsert({
      run_date: runDate,
      status: plan.paidMemberCount > 0 ? "running" : "skipped",
      paid_member_count: plan.paidMemberCount,
      completed_at: plan.paidMemberCount > 0 ? null : new Date().toISOString(),
      error_summary: null,
    }, { onConflict: "run_date" })
    .select("run_id")
    .single();
  if (runError) throw runError;
  if (plan.paidMemberCount === 0) {
    return { runDate, status: "skipped" as const, reason: "no-paid-members" };
  }

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
  const safeWaterCandidates = plan.waterCandidates.filter((candidate) =>
    farFromTutorialSpawns(candidate, spawnPoints));
  const safeAnchors = plan.plantAnchors.filter((anchor) =>
    farFromTutorialSpawns(anchor, spawnPoints));
  const dateRotation = Math.abs(Number(runDate.replaceAll("-", ""))) || 0;

  const outcomes = (
    await Promise.all(plan.stewards.map(async (steward) => {
      const stewardOutcomes: ActionOutcome[] = [];
      let ordinal = 1;
      const assignedWater = safeWaterCandidates.filter(
        (_, index) => (index + dateRotation) % plan.stewards.length === steward.stewardId - 1,
      );
      for (const candidate of assignedWater.slice(0, steward.dailyWaterActions)) {
        stewardOutcomes.push(await performLoggedAction({
          runId: run.run_id,
          actionId: getFoundingStewardActionId(runDate, steward.stewardId, ordinal),
          stewardId: steward.stewardId,
          actionOrdinal: ordinal,
          actionType: "water",
          targetOwnerKind: candidate.ownerKind,
          targetPlantId: candidate.plantId,
          gridX: candidate.gridX,
          gridY: candidate.gridY,
          regionX: candidate.regionX,
          regionY: candidate.regionY,
          actorKey: steward.actorKey,
          networkKey: steward.networkKey,
        }));
        ordinal += 1;
      }

      for (let plantIndex = 0; plantIndex < steward.dailyPlantActions; plantIndex += 1) {
        if (!safeAnchors.length) break;
        const anchor = safeAnchors[(dateRotation + steward.stewardId + plantIndex) % safeAnchors.length];
        const cell = findPlantCell({
          anchor,
          occupied,
          spawnPoints,
          rotation: (dateRotation + steward.stewardId * 3 + plantIndex) % PLANT_OFFSETS.length,
        });
        if (!cell) continue;
        occupied.add(key(cell.gridX, cell.gridY));
        stewardOutcomes.push(await performLoggedAction({
          runId: run.run_id,
          actionId: getFoundingStewardActionId(runDate, steward.stewardId, ordinal),
          stewardId: steward.stewardId,
          actionOrdinal: ordinal,
          actionType: "plant",
          targetOwnerKind: "founding_steward",
          targetPlantId: null,
          gridX: cell.gridX,
          gridY: cell.gridY,
          regionX: anchor.regionX,
          regionY: anchor.regionY,
          actorKey: steward.actorKey,
          networkKey: steward.networkKey,
          plantType: PLANT_TYPES[(dateRotation + steward.stewardId + plantIndex) % PLANT_TYPES.length],
        }));
        ordinal += 1;
      }
      return stewardOutcomes;
    }))
  ).flat();

  const succeeded = outcomes.filter((outcome) => outcome.success).length;
  const failed = outcomes.length - succeeded;
  const status = failed === 0 ? "completed" : succeeded > 0 ? "partial" : "failed";
  const { error: completeError } = await admin
    .from("community_garden_founding_steward_runs")
    .update({
      status,
      actions_attempted: outcomes.length,
      actions_succeeded: succeeded,
      actions_failed: failed,
      plants_placed: outcomes.reduce((sum, outcome) => sum + outcome.plantsPlaced, 0),
      flowers_watered: outcomes.reduce((sum, outcome) => sum + outcome.flowersWatered, 0),
      heritage_promotions_completed: outcomes.reduce(
        (sum, outcome) => sum + outcome.heritagePromotionsCompleted,
        0,
      ),
      completed_at: new Date().toISOString(),
      error_summary: failed > 0 ? `${failed} steward action(s) failed; see the private action audit.` : null,
    })
    .eq("run_id", run.run_id);
  if (completeError) throw completeError;

  return {
    runDate,
    status,
    paidMemberCount: plan.paidMemberCount,
    actionsAttempted: outcomes.length,
    actionsSucceeded: succeeded,
    actionsFailed: failed,
  };
}
