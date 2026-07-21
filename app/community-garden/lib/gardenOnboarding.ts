import type { PlantType } from "./roseLifecycle";

export type GardenOnboardingStep =
  | "plant"
  | "select-seed"
  | "community-tile"
  | "community-repeat"
  | "my-garden"
  | "personal-inventory"
  | "personal-seed"
  | "personal-tile"
  | "complete"
  | "dismissed";

const STORAGE_KEY = "basil-onboarding-v1";
const COMMUNITY_PLANTINGS_KEY = "basil-onboarding-community-plantings-v1";

// Keep the tutorial stable even as the full garden catalog grows. These are
// the only choices that teach the core planting loop during onboarding.
export const GARDEN_ONBOARDING_PLANT_TYPES = [
  "rose",
  "sunflower",
  "lavender",
] as const satisfies readonly PlantType[];

export function isGardenOnboardingPlantType(plantType: PlantType) {
  return (GARDEN_ONBOARDING_PLANT_TYPES as readonly PlantType[]).includes(
    plantType,
  );
}

const VALID_STEPS = new Set<GardenOnboardingStep>([
  "plant",
  "select-seed",
  "community-tile",
  "community-repeat",
  "my-garden",
  "personal-inventory",
  "personal-seed",
  "personal-tile",
  "complete",
  "dismissed",
]);

export function loadGardenOnboardingStep(): GardenOnboardingStep | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "preview") return "personal-inventory";
    if (value === "preview-free" || value === "preview-full") return "complete";
    if (value === "select-seed") return "plant";
    if (value === "personal-seed") return "personal-inventory";
    if (value === "community-repeat") return "community-tile";
    return value && VALID_STEPS.has(value as GardenOnboardingStep)
      ? (value as GardenOnboardingStep)
      : null;
  } catch {
    return null;
  }
}

export function loadCommunityOnboardingPlantings() {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(COMMUNITY_PLANTINGS_KEY));
    return Number.isFinite(value) ? Math.min(3, Math.max(0, Math.floor(value))) : 0;
  } catch {
    return 0;
  }
}

export function saveCommunityOnboardingPlantings(plantings: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMMUNITY_PLANTINGS_KEY,
      String(Math.min(3, Math.max(0, Math.floor(plantings)))),
    );
  } catch {
    // The in-memory count still guides this visit when storage is unavailable.
  }
}

export function saveGardenOnboardingStep(step: GardenOnboardingStep) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, step);
  } catch {
    // The prompt remains usable for this visit when private storage is unavailable.
  }
}

export function isGardenOnboardingFinished(step: GardenOnboardingStep | null) {
  return step === "complete" || step === "dismissed";
}
