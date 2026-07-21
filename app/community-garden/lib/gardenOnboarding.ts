export type GardenOnboardingStep =
  | "plant"
  | "my-garden"
  | "preview"
  | "complete"
  | "dismissed";

const STORAGE_KEY = "basil-onboarding-v1";

const VALID_STEPS = new Set<GardenOnboardingStep>([
  "plant",
  "my-garden",
  "preview",
  "complete",
  "dismissed",
]);

export function loadGardenOnboardingStep(): GardenOnboardingStep | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
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
