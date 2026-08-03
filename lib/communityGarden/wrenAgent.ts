import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getMyGarden, type MyGardenState } from "./myGarden";
import {
  applyMyGardenBuilderAction,
  plantInMyGarden,
  toggleMyGardenPath,
} from "./myGarden";
import {
  isMyGardenElementType,
  isMyGardenPlantType,
} from "@/app/community-garden/lib/myGardenCatalog";

export const WREN_AGENT_CODE = "wren" as const;
export const WREN_AUTONOMY_TIER = 2 as const;
export const WREN_PLANNER_MODE = "codex_scheduled" as const;
export const WREN_DISCLOSURE_LABEL = "WREN · AI GARDEN STEWARD";
export const WREN_DISCLOSURE_TEXT =
  "Wren is an AI-directed Basil garden steward. Codex selects daily missions; Basil's server rules validate and log every action.";

export type BasilAgentPlannerMode =
  | "deterministic"
  | "codex_scheduled"
  | "external_api";

export type WrenMissionScope = "community_garden" | "my_garden" | "mixed";
export type WrenContentLane =
  | "agent_diary"
  | "field_footage"
  | "experiment"
  | "garden_status"
  | "founder_context";

export type WrenAgentProfile = {
  id: string;
  code: typeof WREN_AGENT_CODE;
  displayName: string;
  disclosureLabel: string;
  disclosureText: string;
  autonomyTier: number;
  plannerMode: BasilAgentPlannerMode;
  gardenStewardId: string;
  foundingStewardId: number;
  appearanceKey: string;
  personaVersion: string;
  publicBio: string;
  publicProfileEnabled: boolean;
};

export type WrenMissionInput = {
  runKey: string;
  missionDate: string;
  objective: string;
  scope: WrenMissionScope;
  plannerVersion: string;
  plan: Record<string, unknown>;
  constraints: Record<string, unknown>;
  truthBasis: Record<string, unknown>;
};

export type WrenMissionRecord = WrenMissionInput & {
  id: string;
  status:
    | "planned"
    | "validated"
    | "executing"
    | "completed"
    | "partial"
    | "rejected"
    | "cancelled";
};

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Wren's agent record was unavailable.");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getWrenSocialIdentity() {
  return {
    code: WREN_AGENT_CODE,
    displayName: "Wren",
    disclosureLabel: WREN_DISCLOSURE_LABEL,
    disclosureText: WREN_DISCLOSURE_TEXT,
    autonomyTier: WREN_AUTONOMY_TIER,
    plannerMode: WREN_PLANNER_MODE,
    captureActor: "wren" as const,
  };
}

export async function getWrenAgentProfile(): Promise<WrenAgentProfile> {
  const { data, error } = await getSupabaseAdmin()
    .from("basil_agent_profiles")
    .select(
      "id,code,display_name,disclosure_label,disclosure_text,autonomy_tier,planner_mode,garden_steward_id,founding_steward_id,appearance_key,persona_version,public_bio,public_profile_enabled",
    )
    .eq("code", WREN_AGENT_CODE)
    .eq("enabled", true)
    .single();
  if (error) throw error;
  const profile = row(data);
  return {
    id: stringValue(profile.id),
    code: WREN_AGENT_CODE,
    displayName: stringValue(profile.display_name),
    disclosureLabel: stringValue(profile.disclosure_label),
    disclosureText: stringValue(profile.disclosure_text),
    autonomyTier: numberValue(profile.autonomy_tier),
    plannerMode: stringValue(profile.planner_mode) as BasilAgentPlannerMode,
    gardenStewardId: stringValue(profile.garden_steward_id),
    foundingStewardId: numberValue(profile.founding_steward_id),
    appearanceKey: stringValue(profile.appearance_key),
    personaVersion: stringValue(profile.persona_version),
    publicBio: stringValue(profile.public_bio),
    publicProfileEnabled: profile.public_profile_enabled === true,
  };
}

export async function getWrenMyGarden(): Promise<MyGardenState> {
  const profile = await getWrenAgentProfile();
  return getMyGarden(profile.gardenStewardId);
}

export async function upsertWrenMission(
  input: WrenMissionInput,
): Promise<WrenMissionRecord> {
  const profile = await getWrenAgentProfile();
  const { data, error } = await getSupabaseAdmin()
    .from("basil_agent_missions")
    .upsert(
      {
        agent_id: profile.id,
        mission_date: input.missionDate,
        run_key: input.runKey,
        objective: input.objective,
        scope: input.scope,
        planner_mode: profile.plannerMode,
        planner_version: input.plannerVersion,
        autonomy_tier: profile.autonomyTier,
        status: "planned",
        plan: input.plan,
        constraints: input.constraints,
        truth_basis: input.truthBasis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,run_key" },
    )
    .select("id,status")
    .single();
  if (error) throw error;
  const mission = row(data);
  return {
    ...input,
    id: stringValue(mission.id),
    status: stringValue(mission.status) as WrenMissionRecord["status"],
  };
}

export async function getWrenPlanningContext() {
  const profile = await getWrenAgentProfile();
  const [missions, traces, diary, metrics] = await Promise.all([
    getSupabaseAdmin()
      .from("basil_agent_missions")
      .select("id,mission_date,objective,scope,status,plan,truth_basis,created_at")
      .eq("agent_id", profile.id)
      .order("mission_date", { ascending: false })
      .limit(14),
    getSupabaseAdmin()
      .from("basil_agent_action_traces")
      .select("id,mission_id,action_type,scope,target,result,capture_eligible,replay_status,started_at")
      .eq("agent_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(200),
    getSupabaseAdmin()
      .from("basil_agent_diary_entries")
      .select("id,entry_date,episode_number,title,summary,facts,review_status")
      .eq("agent_id", profile.id)
      .order("entry_date", { ascending: false })
      .limit(30),
    getSupabaseAdmin()
      .from("basil_social_metrics")
      .select(
        "variant_id,window_key,impressions,views,engaged_views,reactions,comments,shares,saves,clicks,watch_seconds,chose_to_view_rate,average_percentage_viewed,completion_rate,replay_rate,profile_actions,game_starts,first_flowers_planted,measured_at",
      )
      .order("measured_at", { ascending: false })
      .limit(200),
  ]);

  for (const result of [missions, traces, diary, metrics]) {
    if (result.error) throw result.error;
  }

  return {
    profile,
    activePlanner: WREN_PLANNER_MODE,
    futurePlannerAdapter: "external_api" as const,
    missions: missions.data ?? [],
    traces: traces.data ?? [],
    diary: diary.data ?? [],
    metrics: metrics.data ?? [],
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function integerValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function gardenSnapshot(garden: MyGardenState) {
  return {
    careBalance: garden.careBalance,
    plotLevel: garden.plotLevel,
    plants: garden.plants,
    paths: garden.paths,
    elements: garden.elements,
    livingGardenHabitats: garden.livingGardenHabitats,
  };
}

/**
 * Executes only Creator-planned, policy-allowed My Garden decisions. The
 * half-hour Founding Steward heartbeat calls this after ordinary community
 * work. Narration never reaches this function and an external planner remains
 * disabled, so no model receives direct game or database authority.
 */
export async function executeWrenMyGardenMission(now = new Date()) {
  const profile = await getWrenAgentProfile();
  const chicagoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const supabase = getSupabaseAdmin();
  const { data: mission, error: missionError } = await supabase
    .from("basil_agent_missions")
    .select("id,status,scope,objective,autonomy_tier,planner_mode,constraints")
    .eq("agent_id", profile.id)
    .eq("mission_date", chicagoDate)
    .in("status", ["validated", "executing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (missionError) throw missionError;
  if (!mission) return { missionId: null, attempted: 0, completed: 0, failed: 0 };
  if (mission.autonomy_tier !== WREN_AUTONOMY_TIER || mission.planner_mode !== WREN_PLANNER_MODE) {
    throw new Error("Wren's mission does not match the enabled autonomy contract.");
  }

  const constraints = objectValue(mission.constraints);
  const requestedCareBudget = integerValue(constraints.dailyCareBudget) ?? 6;
  const dailyCareBudget = Math.min(8, Math.max(0, requestedCareBudget));
  const { error: budgetError } = await supabase.rpc("grant_basil_agent_daily_care", {
    p_agent_code: WREN_AGENT_CODE,
    p_budget_date: chicagoDate,
    p_amount: dailyCareBudget,
  });
  if (budgetError) throw budgetError;
  const requestedLimit = integerValue(constraints.maxMyGardenActionsPerSession) ?? 3;
  const actionLimit = Math.min(3, Math.max(0, requestedLimit));
  const { data: decisions, error: decisionsError } = await supabase
    .from("basil_agent_decisions")
    .select("id,sequence,action_type,target,rationale,status,policy_status")
    .eq("mission_id", mission.id)
    .eq("policy_status", "allowed")
    .in("status", ["planned", "queued"])
    .order("sequence", { ascending: true })
    .limit(actionLimit);
  if (decisionsError) throw decisionsError;
  if (!decisions?.length) return { missionId: mission.id as string, attempted: 0, completed: 0, failed: 0 };

  await supabase.from("basil_agent_missions").update({
    status: "executing",
    started_at: mission.status === "validated" ? now.toISOString() : undefined,
    updated_at: now.toISOString(),
  }).eq("id", mission.id);

  let completed = 0;
  let failed = 0;
  for (const decision of decisions) {
    const target = objectValue(decision.target);
    const gridX = integerValue(target.gridX);
    const gridY = integerValue(target.gridY);
    const before = await getMyGarden(profile.gardenStewardId);
    await supabase.from("basil_agent_decisions").update({ status: "running" }).eq("id", decision.id);
    try {
      let after = before;
      if (decision.action_type === "plant") {
        const plantType = typeof target.plantType === "string" ? target.plantType : "";
        if (gridX === null || gridY === null || !isMyGardenPlantType(plantType)) {
          throw new Error("The planned Wren planting target is invalid.");
        }
        after = await plantInMyGarden(profile.gardenStewardId, gridX, gridY, plantType);
      } else if (decision.action_type === "builder") {
        const category = target.category;
        const mode = target.mode;
        const cells = Array.isArray(target.cells)
          ? target.cells.flatMap((cell) => {
              const item = objectValue(cell);
              const x = integerValue(item.gridX);
              const y = integerValue(item.gridY);
              return x === null || y === null ? [] : [{ gridX: x, gridY: y }];
            })
          : [];
        const itemType = typeof target.itemType === "string" ? target.itemType : null;
        if (
          (mode !== "place" && mode !== "remove") ||
          (category !== "plant" && category !== "path" && category !== "element") ||
          cells.length === 0 ||
          (itemType !== null && itemType !== "path" && !isMyGardenPlantType(itemType) && !isMyGardenElementType(itemType))
        ) {
          throw new Error("The planned Wren Builder action is invalid.");
        }
        after = await applyMyGardenBuilderAction(profile.gardenStewardId, {
          actionId: decision.id,
          mode,
          category,
          itemType,
          cells,
        });
      } else if (decision.action_type === "walk" || decision.action_type === "inspect" || decision.action_type === "wait") {
        // These decisions are diary/capture checkpoints and do not mutate the garden.
      } else if (decision.action_type === "water" && target.kind === "path") {
        if (gridX === null || gridY === null) throw new Error("The planned Wren path target is invalid.");
        after = await toggleMyGardenPath(profile.gardenStewardId, gridX, gridY);
      } else {
        throw new Error("This Wren action is not allowed in My Garden execution.");
      }

      await supabase.from("basil_agent_decisions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", decision.id);
      await supabase.from("basil_agent_action_traces").insert({
        agent_id: profile.id,
        mission_id: mission.id,
        decision_id: decision.id,
        action_type: decision.action_type,
        scope: "my_garden",
        plant_type: typeof target.plantType === "string" ? target.plantType : null,
        started_at: now.toISOString(),
        completed_at: new Date().toISOString(),
        start_position: { gridX: gridX ?? 0, gridY: (gridY ?? 0) + 2 },
        movement_path: [{ gridX: gridX ?? 0, gridY: (gridY ?? 0) + 2 }, { gridX: gridX ?? 0, gridY: gridY ?? 0 }],
        target,
        result: { success: true, rationale: decision.rationale },
        snapshot_before: gardenSnapshot(before),
        snapshot_after: gardenSnapshot(after),
        checkpoints: [{ name: "decision_completed", expected: true, actual: true }],
        capture_eligible: true,
        replay_status: "ready",
      });
      completed += 1;
    } catch (error) {
      await supabase.from("basil_agent_decisions").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        policy_reasons: [error instanceof Error ? error.message.slice(0, 500) : "Unknown execution error"],
      }).eq("id", decision.id);
      failed += 1;
    }
  }

  const { count: remaining } = await supabase
    .from("basil_agent_decisions")
    .select("id", { count: "exact", head: true })
    .eq("mission_id", mission.id)
    .in("status", ["planned", "queued", "running"]);
  if ((remaining ?? 0) === 0) {
    const finishedAt = new Date().toISOString();
    await supabase.from("basil_agent_missions").update({
      status: failed > 0 ? "partial" : "completed",
      completed_at: finishedAt,
      updated_at: finishedAt,
    }).eq("id", mission.id);

    const finalGarden = await getMyGarden(profile.gardenStewardId);
    const { data: latestSnapshot, error: snapshotReadError } = await supabase
      .from("basil_agent_garden_snapshots")
      .select("version")
      .eq("agent_id", profile.id)
      .eq("scope", "my_garden")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotReadError) throw snapshotReadError;
    const { error: snapshotWriteError } = await supabase
      .from("basil_agent_garden_snapshots")
      .insert({
        agent_id: profile.id,
        mission_id: mission.id,
        scope: "my_garden",
        version: Number(latestSnapshot?.version ?? 0) + 1,
        captured_at: finishedAt,
        state: gardenSnapshot(finalGarden),
      });
    if (snapshotWriteError) throw snapshotWriteError;

    const { data: existingDiary, error: diaryReadError } = await supabase
      .from("basil_agent_diary_entries")
      .select("id")
      .eq("mission_id", mission.id)
      .limit(1)
      .maybeSingle();
    if (diaryReadError) throw diaryReadError;
    if (!existingDiary) {
      const { data: latestDiary, error: episodeReadError } = await supabase
        .from("basil_agent_diary_entries")
        .select("episode_number")
        .eq("agent_id", profile.id)
        .order("episode_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (episodeReadError) throw episodeReadError;
      const { data: sourceDecisions, error: decisionReadError } = await supabase
        .from("basil_agent_decisions")
        .select("id")
        .eq("mission_id", mission.id)
        .eq("status", "completed")
        .order("sequence", { ascending: true });
      if (decisionReadError) throw decisionReadError;
      const outcome = failed > 0
        ? `I completed ${completed} planned garden actions; ${failed} did not pass execution.`
        : `I completed ${completed} planned garden actions and saved the result to my persistent garden record.`;
      const { error: diaryWriteError } = await supabase
        .from("basil_agent_diary_entries")
        .insert({
          agent_id: profile.id,
          mission_id: mission.id,
          entry_date: chicagoDate,
          episode_number: Number(latestDiary?.episode_number ?? 0) + 1,
          title: String(mission.objective).slice(0, 180),
          summary: outcome,
          narration: `I'm Wren, Basil's AI-directed garden steward. ${outcome}`,
          facts: {
            completedActions: completed,
            failedActions: failed,
            plantCount: finalGarden.plants.length,
            pathCount: finalGarden.paths.length,
            plannerMode: WREN_PLANNER_MODE,
          },
          source_action_ids: (sourceDecisions ?? []).map((decision) => decision.id),
          review_status: "draft",
        });
      if (diaryWriteError) throw diaryWriteError;
    }
  }
  return { missionId: mission.id as string, attempted: decisions.length, completed, failed };
}

export async function getWrenPublicProfile() {
  const profile = await getWrenAgentProfile();
  if (!profile.publicProfileEnabled) {
    throw new Error("Wren's public transparency profile is disabled.");
  }
  const supabase = getSupabaseAdmin();
  const [garden, mission, diary, traces, care] = await Promise.all([
    getMyGarden(profile.gardenStewardId),
    supabase
      .from("basil_agent_missions")
      .select("mission_date,objective,scope,status,planner_mode,autonomy_tier")
      .eq("agent_id", profile.id)
      .in("status", ["validated", "executing", "completed", "partial"])
      .order("mission_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("basil_agent_diary_entries")
      .select("entry_date,episode_number,title,summary,review_status")
      .eq("agent_id", profile.id)
      .in("review_status", ["approved", "published"])
      .order("entry_date", { ascending: false })
      .limit(12),
    supabase
      .from("basil_agent_action_traces")
      .select("action_type,scope,started_at")
      .eq("agent_id", profile.id)
      .gte("started_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("started_at", { ascending: false })
      .limit(2_000),
    supabase
      .from("basil_agent_care_ledger")
      .select("budget_date,amount,reason")
      .eq("agent_id", profile.id)
      .order("budget_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [mission, diary, traces, care]) {
    if (result.error) throw result.error;
  }
  const actionCounts = (traces.data ?? []).reduce<Record<string, number>>(
    (counts, trace) => {
      const key = String(trace.action_type);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const species = garden.plants.reduce<Record<string, number>>((counts, plant) => {
    counts[plant.plantType] = (counts[plant.plantType] ?? 0) + 1;
    return counts;
  }, {});
  return {
    code: profile.code,
    displayName: profile.displayName,
    appearanceKey: profile.appearanceKey,
    publicBio: profile.publicBio,
    disclosure: {
      label: profile.disclosureLabel,
      text: profile.disclosureText,
      autonomyTier: profile.autonomyTier,
      plannerMode: profile.plannerMode,
      continuousModelConnection: false,
      futureExternalPlannerSupported: true,
    },
    currentMission: mission.data ?? null,
    myGarden: {
      plotLevel: garden.plotLevel,
      plantCount: garden.plants.length,
      pathCount: garden.paths.length,
      elementCount: garden.elements.length,
      habitatCount: garden.livingGardenHabitats?.length ?? 0,
      species,
      plants: garden.plants,
      paths: garden.paths,
    },
    last24Hours: actionCounts,
    maintenanceBudget: care.data ?? null,
    diary: diary.data ?? [],
    updatedAt: new Date().toISOString(),
  };
}
