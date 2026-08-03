import type {
  BasilAgentPlannerMode,
  WrenMissionInput,
} from "./wrenAgent";

export type BasilAgentPlanningContext = {
  date: string;
  recentMissions: unknown[];
  recentActions: unknown[];
  recentDiary: unknown[];
  recentMetrics: unknown[];
  creatorFeedback: unknown[];
};

export interface BasilAgentPlanner {
  readonly mode: BasilAgentPlannerMode;
  createMission(context: BasilAgentPlanningContext): Promise<WrenMissionInput>;
}

/**
 * Codex writes the mission manifest during the scheduled Creator Studio task.
 * This adapter validates the stored payload; it does not make a paid API call.
 */
export class CodexScheduledPlanner implements BasilAgentPlanner {
  readonly mode = "codex_scheduled" as const;

  constructor(private readonly mission: WrenMissionInput) {}

  async createMission(context: BasilAgentPlanningContext) {
    if (this.mission.missionDate !== context.date) {
      throw new Error("The scheduled Wren mission does not match today's planning date.");
    }
    return this.mission;
  }
}

/**
 * Deliberately disabled until Basil has an approved, budgeted always-on model.
 * Keeping this boundary now lets a future API or local model plug in without
 * giving it direct database or game-action privileges.
 */
export class ExternalApiPlanner implements BasilAgentPlanner {
  readonly mode = "external_api" as const;

  async createMission(_context: BasilAgentPlanningContext): Promise<WrenMissionInput> {
    throw new Error(
      "The external Wren planner is disabled. Use the Codex scheduled planner.",
    );
  }
}
