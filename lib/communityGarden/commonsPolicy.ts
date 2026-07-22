export const BASIL_COMMONS_POLICY = {
  dailyCareLimit: 600,
  fullCareLimit: 200,
  moderateCareLimit: 400,
  dailyMutationLimit: 3_000,
  networkMutationLimit: 12_000,
  contributorSoftFootprint: 100,
  contributorHardFootprint: 125,
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
  const specialBonus = Math.max(0, Math.trunc(baseCare) - 1);
  let award = 0;
  let progress = state.tierProgress;
  let actionsRequired = 1;
  let phase: "daily" | "full" | "taper4" | "taper20" = "full";

  if (baseCare <= 0 || state.careEarned >= BASIL_COMMONS_POLICY.dailyCareLimit) {
    return { award: 0, progress, actionsRequired, phase };
  }
  if (state.careEarned === 0) {
    award = 4 + specialBonus;
    phase = "daily";
    progress = 0;
  } else if (state.careEarned < BASIL_COMMONS_POLICY.fullCareLimit) {
    award = 1 + specialBonus;
    progress = 0;
  } else {
    actionsRequired =
      state.careEarned < BASIL_COMMONS_POLICY.moderateCareLimit ? 4 : 20;
    phase =
      state.careEarned < BASIL_COMMONS_POLICY.moderateCareLimit
        ? "taper4"
        : "taper20";
    progress += 1;
    award = specialBonus;
    if (progress >= actionsRequired) {
      award += 1;
      progress = 0;
    }
  }

  award = Math.min(
    award,
    BASIL_COMMONS_POLICY.dailyCareLimit - state.careEarned,
  );
  return { award, progress, actionsRequired, phase };
}
