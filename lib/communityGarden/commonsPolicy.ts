export const BASIL_COMMONS_POLICY = {
  careMode: "uncapped",
  firstHelpfulActionCare: 4,
  dailyMutationLimit: 30_000,
  networkMutationLimit: 120_000,
  actorActionsPerMinute: 150,
  networkActionsPerMinute: 1_500,
  contributorSoftFootprint: 100,
  contributorHardFootprint: 125,
  heritageMinimumAgeDays: 5,
  heritageCareDays: 3,
  heritageGardeners: 3,
  heritageNeighborCount: 6,
  regionSize: 16,
  regionBusyAt: 140,
  regionRestingAt: 180,
  mapExpansionAtOccupancy: 0.65,
} as const;

export type CarePacingState = {
  careEarned: number;
  tierProgress: number;
};

/** A dependency-free mirror of the transactional Postgres rule for tests/UI copy. */
export function calculateCommonsCareAward(
  state: CarePacingState,
  baseCare: number,
) {
  const normalizedCare = Math.max(0, Math.trunc(baseCare));
  const progress = 0;
  const actionsRequired = 1;
  let phase: "daily" | "open" = "open";

  if (normalizedCare <= 0) {
    return { award: 0, progress, actionsRequired, phase };
  }
  if (state.careEarned === 0) {
    phase = "daily";
    return {
      award:
        BASIL_COMMONS_POLICY.firstHelpfulActionCare +
        Math.max(0, normalizedCare - 1),
      progress,
      actionsRequired,
      phase,
    };
  }

  return {
    award: normalizedCare,
    progress,
    actionsRequired,
    phase: "open",
  };
}
