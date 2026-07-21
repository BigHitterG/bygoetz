export type GardenOnboardingStep =
  | "plant"
  | "select-seed"
  | "community-tile"
  | "my-garden"
  | "personal-inventory"
  | "personal-seed"
  | "personal-tile"
  | "preview-free"
  | "preview-full"
  | "complete"
  | "dismissed";

const STORAGE_KEY = "basil-onboarding-v1";

const VALID_STEPS = new Set<GardenOnboardingStep>([
  "plant",
  "select-seed",
  "community-tile",
  "my-garden",
  "personal-inventory",
  "personal-seed",
  "personal-tile",
  "preview-free",
  "preview-full",
  "complete",
  "dismissed",
]);

export function loadGardenOnboardingStep(): GardenOnboardingStep | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "preview") return "personal-inventory";
    if (value === "select-seed") return "plant";
    if (value === "personal-seed") return "personal-inventory";
    return value && VALID_STEPS.has(value as GardenOnboardingStep)
      ? (value as GardenOnboardingStep)
      : null;
  } catch {
    return null;
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
