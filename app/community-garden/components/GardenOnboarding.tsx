import type { GardenOnboardingStep } from "../lib/gardenOnboarding";

type GardenOnboardingProps = {
  step: GardenOnboardingStep | null;
  communityPlantings: number;
  inventoryOpen: boolean;
  actionReady: boolean;
  onDismiss: () => void;
  onOpenInventory: () => void;
  onOpenMyGarden: () => void;
};

export function GardenOnboarding({
  step,
  communityPlantings,
  inventoryOpen,
  actionReady,
  onDismiss,
  onOpenInventory,
  onOpenMyGarden,
}: GardenOnboardingProps) {
  if (
    !step ||
    step === "complete" ||
    step === "dismissed" ||
    inventoryOpen ||
    step === "select-seed" ||
    step === "personal-seed"
  ) {
    return null;
  }

  const content =
    step === "plant"
      ? {
          kicker: "A small beginning",
          title: "Plant three community flowers",
          copy: "We will walk through all three. Open Inventory and choose your first seed.",
          action: "Open Inventory",
          onAction: onOpenInventory,
        }
      : step === "community-tile"
        ? {
            kicker: `Community planting ${Math.min(3, communityPlantings + 1)} of 3`,
            title: actionReady ? "You are in place" : "Choose the glowing patch",
            copy: actionReady
              ? "Tap the Plant button below to add your flower."
              : "Tap the highlighted open ground. Your gardener will walk over to it.",
            action: null,
            onAction: null,
          }
      : step === "community-repeat"
        ? {
            kicker: `${communityPlantings} of 3 planted`,
            title:
              3 - communityPlantings === 1
                ? "Plant one more community flower"
                : `Plant ${Math.max(1, 3 - communityPlantings)} more community flowers`,
            copy: "Your Care is growing. Open Inventory to choose the next flower.",
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
        : step === "personal-inventory"
          ? {
              kicker: "Your garden preview",
              title: "Plant three flowers of your own",
              copy: "Try your first one with the guide, then arrange the next two however you like.",
              action: "Open Inventory",
              onAction: onOpenInventory,
            }
          : step === "personal-tile"
            ? {
                kicker: "Your first flower",
                title: actionReady ? "Ready to plant" : "Choose the glowing patch",
                copy: actionReady
                  ? "Tap the Plant button below. Your next two flowers are yours to arrange."
                  : "Tap the highlighted ground and walk over to make this space your own.",
                action: null,
                onAction: null,
              }
        : {
            kicker: "Your garden preview",
            title: "Choose your first flower",
            copy: "Open Inventory and start making this garden your own.",
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
      {content.action && content.onAction ? (
        <button
          className="cg-onboarding-action"
          type="button"
          onClick={content.onAction}
        >
          {content.action}
        </button>
      ) : null}
    </aside>
  );
}
