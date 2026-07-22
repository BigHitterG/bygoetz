import {
  BASIL_COMMONS_POLICY,
  calculateCommonsCareAward,
} from "./commonsPolicy.ts";

export type CommonsPlayerProfile = "casual" | "regular" | "intense" | "bot";

export type CommonsSimulationInput = {
  days: number;
  population: number;
  profile: CommonsPlayerProfile;
};

export type CommonsSimulationResult = CommonsSimulationInput & {
  meaningfulActionsPerPlayerDay: number;
  plantAttemptsPerPlayerDay: number;
  carePerPlayerDay: number;
  totalCare: number;
  totalMutations: number;
  projectedLivePlants: number;
  projectedOccupancyPercent: number;
  expansionRecommended: boolean;
  actorMutationLimitReached: boolean;
  careLimitReached: boolean;
};

const PROFILE_ACTIONS: Record<CommonsPlayerProfile, number> = {
  casual: 12,
  regular: 60,
  intense: 600,
  bot: 10_000,
};

const PROFILE_PLANT_SHARE: Record<CommonsPlayerProfile, number> = {
  casual: 0.35,
  regular: 0.4,
  intense: 0.5,
  bot: 0.95,
};

export function simulateCareForMeaningfulActions(actionCount: number) {
  const boundedActions = Math.max(
    0,
    Math.min(BASIL_COMMONS_POLICY.dailyMutationLimit, Math.trunc(actionCount)),
  );
  let careEarned = 0;
  let tierProgress = 0;
  for (let action = 0; action < boundedActions; action += 1) {
    const result = calculateCommonsCareAward({ careEarned, tierProgress }, 1);
    careEarned += result.award;
    tierProgress = result.progress;
  }
  return { careEarned, tierProgress, processedActions: boundedActions };
}

/**
 * A deliberately conservative, dependency-free capacity projection. It uses
 * the production Care and mutation limits and treats each contributor's
 * long-run public footprint as the newest 100 plants. It is planning evidence,
 * not a substitute for database load measurements.
 */
export function simulateCommonsScenario(
  input: CommonsSimulationInput,
): CommonsSimulationResult {
  const requestedActions = PROFILE_ACTIONS[input.profile];
  const care = simulateCareForMeaningfulActions(requestedActions);
  const plantAttempts = Math.floor(
    care.processedActions * PROFILE_PLANT_SHARE[input.profile],
  );
  const activeContributors = Math.max(0, Math.trunc(input.population));
  const livePlants = Math.min(
    25_600,
    activeContributors * BASIL_COMMONS_POLICY.contributorSoftFootprint,
  );
  const occupancy = (livePlants / 25_600) * 100;

  return {
    ...input,
    meaningfulActionsPerPlayerDay: care.processedActions,
    plantAttemptsPerPlayerDay: plantAttempts,
    carePerPlayerDay: care.careEarned,
    totalCare: care.careEarned * activeContributors * input.days,
    totalMutations: care.processedActions * activeContributors * input.days,
    projectedLivePlants: livePlants,
    projectedOccupancyPercent: Number(occupancy.toFixed(2)),
    expansionRecommended:
      occupancy >= BASIL_COMMONS_POLICY.mapExpansionAtOccupancy * 100,
    actorMutationLimitReached:
      requestedActions > BASIL_COMMONS_POLICY.dailyMutationLimit,
    careLimitReached: care.careEarned >= BASIL_COMMONS_POLICY.dailyCareLimit,
  };
}

export function buildPhase5SimulationMatrix() {
  const durations = [30, 90, 365];
  const populations = [10, 50, 250, 1_000];
  const profiles: CommonsPlayerProfile[] = ["casual", "regular", "intense", "bot"];
  return durations.flatMap((days) =>
    populations.flatMap((population) =>
      profiles.map((profile) => simulateCommonsScenario({ days, population, profile })),
    ),
  );
}
