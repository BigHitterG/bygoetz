import { BASIL_COMMONS_POLICY } from "./commonsPolicy.ts";

/**
 * Versioned planning constants for Basil's quorum frontier. Postgres remains
 * authoritative; these dependency-free helpers keep tests, owner UI, and
 * offline simulations aligned with the database policy.
 */
export const BASIL_FRONTIER_POLICY = {
  formulaVersion: 2,
  foundingRegionSide: 10,
  regionSize: BASIL_COMMONS_POLICY.regionSize,
  effectivePlantsPerRegion: BASIL_COMMONS_POLICY.regionRestingAt,
  prepareAtOccupancy: 0.5,
  openAtOccupancy: 0.6,
  targetOccupancyAfterOpening: 0.55,
  minimumGlobalGardeners: 12,
  perimeterRegionsPerGardener: 3,
  supportedPlantsPerRegion: 64,
  supportedSubcellsPerRegion: 8,
  localGardenersPerRegion: 6,
  guestAssistWeight: 0.25,
  guestAssistMaximumShare: 0.25,
  activeDaysRequired: 4,
  rollingDays: 7,
  consecutiveQualifyingDays: 3,
  supportRegionsPerAccountDay: 3,
  heritageFlowersPerRegion: 9,
  fallowAfterInactiveDays: 30,
  automaticOpeningEnabled: false,
} as const;

export type FrontierCommunityStage =
  | "founding"
  | "sprouting"
  | "growing"
  | "community";

export type FrontierStagePolicy = {
  id: FrontierCommunityStage;
  requiredAccounts: number;
  recommendationCooldownDays: number;
};

export type FrontierRegionQualification = {
  supportedPlants: number;
  supportedSubcells: number;
  distinctGardeners: number;
  activeDays: number;
  consecutiveQualifyingDays: number;
  sideAdjacentToEstablished: boolean;
  requiredGardeners?: number;
};

export function getFrontierCommunityStage(
  activeAccounts7d: number,
): FrontierStagePolicy {
  const accounts = Math.max(0, Math.trunc(activeAccounts7d));
  if (accounts <= 3) {
    return { id: "founding", requiredAccounts: 1, recommendationCooldownDays: 30 };
  }
  if (accounts <= 11) {
    return { id: "sprouting", requiredAccounts: 2, recommendationCooldownDays: 14 };
  }
  if (accounts <= 29) {
    return { id: "growing", requiredAccounts: 3, recommendationCooldownDays: 7 };
  }
  return {
    id: "community",
    requiredAccounts: BASIL_FRONTIER_POLICY.localGardenersPerRegion,
    recommendationCooldownDays: 0,
  };
}

export function getGuestAssistCredit(
  guestContribution: number,
  physicalRequirement: number,
) {
  const guests = Math.max(0, Math.trunc(guestContribution));
  const requirement = Math.max(0, Math.trunc(physicalRequirement));
  return Math.min(
    Math.ceil(guests * BASIL_FRONTIER_POLICY.guestAssistWeight),
    Math.ceil(requirement * BASIL_FRONTIER_POLICY.guestAssistMaximumShare),
  );
}

export function getEffectiveGardenCapacity(openRegions: number) {
  return (
    Math.max(0, Math.trunc(openRegions)) *
    BASIL_FRONTIER_POLICY.effectivePlantsPerRegion
  );
}

export function getGardenOccupancy(livePlants: number, openRegions: number) {
  const capacity = getEffectiveGardenCapacity(openRegions);
  if (capacity === 0) return 0;
  return Math.max(0, Math.trunc(livePlants)) / capacity;
}

export function getFrontierGlobalQuorum(
  perimeterRegions: number,
  activeAccounts7d = Number.POSITIVE_INFINITY,
) {
  const stage = getFrontierCommunityStage(activeAccounts7d);
  if (stage.id !== "community") return stage.requiredAccounts;
  return Math.max(
    BASIL_FRONTIER_POLICY.minimumGlobalGardeners,
    Math.ceil(
      Math.max(0, Math.trunc(perimeterRegions)) /
        BASIL_FRONTIER_POLICY.perimeterRegionsPerGardener,
    ),
  );
}

export function getFoundingSquarePerimeterRegions(
  outerRing: number,
  foundingSide = BASIL_FRONTIER_POLICY.foundingRegionSide,
) {
  const ring = Math.max(0, Math.trunc(outerRing));
  const side = Math.max(1, Math.trunc(foundingSide)) + ring * 2;
  // These are the wild cells sharing a cardinal edge with the square. Corner
  // cells are not candidates until a side-adjacent region has opened.
  return side * 4;
}

export function getRegionsNeededForTargetOccupancy(
  livePlants: number,
  openRegions: number,
  targetOccupancy = BASIL_FRONTIER_POLICY.targetOccupancyAfterOpening,
) {
  const plants = Math.max(0, Math.trunc(livePlants));
  const regions = Math.max(0, Math.trunc(openRegions));
  const target = Math.min(0.95, Math.max(0.05, targetOccupancy));
  const requiredRegions = Math.ceil(
    plants / (BASIL_FRONTIER_POLICY.effectivePlantsPerRegion * target),
  );
  return Math.max(0, requiredRegions - regions);
}

export function getFrontierCapacityState(
  livePlants: number,
  openRegions: number,
) {
  const occupancy = getGardenOccupancy(livePlants, openRegions);
  return {
    occupancy,
    shouldPrepare: occupancy >= BASIL_FRONTIER_POLICY.prepareAtOccupancy,
    shouldRecommendOpening:
      occupancy >= BASIL_FRONTIER_POLICY.openAtOccupancy,
    regionsNeeded: getRegionsNeededForTargetOccupancy(
      livePlants,
      openRegions,
    ),
  };
}

export function qualifiesFrontierRegion(
  input: FrontierRegionQualification,
) {
  const requiredGardeners =
    input.requiredGardeners ?? BASIL_FRONTIER_POLICY.localGardenersPerRegion;
  return (
    input.sideAdjacentToEstablished &&
    input.supportedPlants >= BASIL_FRONTIER_POLICY.supportedPlantsPerRegion &&
    input.supportedSubcells >=
      BASIL_FRONTIER_POLICY.supportedSubcellsPerRegion &&
    input.distinctGardeners >= requiredGardeners &&
    input.activeDays >= BASIL_FRONTIER_POLICY.activeDaysRequired &&
    input.consecutiveQualifyingDays >=
      BASIL_FRONTIER_POLICY.consecutiveQualifyingDays
  );
}
