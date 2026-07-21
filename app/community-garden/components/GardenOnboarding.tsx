import type { GardenOnboardingStep } from "../lib/gardenOnboarding";

type GardenOnboardingProps = {
  step: GardenOnboardingStep | null;
  previewPlantings: number;
  previewLimit: number;
  inventoryOpen: boolean;
  onDismiss: () => void;
  onOpenInventory: () => void;
  onOpenMyGarden: () => void;
};

export function GardenOnboarding({
  step,
  previewPlantings,
  previewLimit,
  inventoryOpen,
  onDismiss,
  onOpenInventory,
  onOpenMyGarden,
}: GardenOnboardingProps) {
  if (
    !step ||
    step === "complete" ||
    step === "dismissed" ||
    inventoryOpen
  ) {
    return null;
  }

  const content =
    step === "plant"
      ? {
          kicker: "A small beginning",
          title: "Plant your first flower",
          copy: "Open Inventory, choose a seed, then tap an open place in the Community Garden.",
          action: "Open Inventory",
          onAction: onOpenInventory,
        }
      : step === "my-garden"
        ? {
            kicker: "Care earned",
            title: "See what your Care can grow",
            copy: "Your public garden work also helps a garden of your own. You can try it before joining.",
            action: "Visit My Garden",
            onAction: onOpenMyGarden,
          }
        : {
            kicker: "Your garden preview",
            title:
              previewLimit - previewPlantings === 1
                ? "Plant 1 more flower"
                : `Plant ${Math.max(0, previewLimit - previewPlantings)} more flowers`,
            copy: "Try arranging three flowers here. Your preview stays free to explore, and you can return to the Community Garden anytime.",
            action: "Open Inventory",
            onAction: onOpenInventory,
          };

  return (
    <aside
      className={`cg-onboarding-card is-${step}`}
      aria-labelledby="cg-onboarding-title"
    >
      <button
        className="cg-onboarding-dismiss"
        type="button"
        aria-label="Dismiss garden guide"
        onClick={onDismiss}
      >
        ×
      </button>
      <p>{content.kicker}</p>
      <h2 id="cg-onboarding-title">{content.title}</h2>
      <span>{content.copy}</span>
      <button
        className="cg-onboarding-action"
        type="button"
        onClick={content.onAction}
      >
        {content.action}
      </button>
    </aside>
  );
}
