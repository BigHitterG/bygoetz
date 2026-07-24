import type { GardenOnboardingStep } from "../lib/gardenOnboarding";

type GardenOnboardingProps = {
  step: GardenOnboardingStep | null;
  communityPlantings: number;
  inventoryOpen: boolean;
  plantActionReady: boolean;
  waterActionReady: boolean;
  onOpenInventory: () => void;
  onOpenMyGarden: () => void;
};

export function GardenOnboarding({
  step,
  communityPlantings,
  inventoryOpen,
  plantActionReady,
  waterActionReady,
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

  const actionReady =
    step === "community-water" ? waterActionReady : plantActionReady;
  const content =
    step === "plant"
      ? {
          kicker: "One garden, shared everywhere",
          title: "Add your flowers to the community",
          copy: "This shared landscape is shaped by gardeners wherever they are. Choose one plant, then add it three times.",
          action: "Open Inventory",
          onAction: onOpenInventory,
        }
      : step === "community-tile" || step === "community-repeat"
        ? {
            kicker: `Community planting ${Math.min(3, communityPlantings + 1)} of 3`,
            title: actionReady ? "You are in place" : "Choose the glowing patch",
            copy: actionReady
              ? "Tap the Plant button below to add your flower."
              : communityPlantings > 0
                ? "Keep your chosen plant. Tap the next glowing patch to walk over."
                : "Tap the highlighted open ground. Your gardener will walk over to it.",
            action: null,
            onAction: null,
          }
      : step === "my-garden"
        ? {
            kicker: "Community planting 3 of 3",
            title: "See what your Care can grow",
            copy: "Three flowers are planted. My Garden is now ready to try.",
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
            : step === "community-water"
              ? {
                  kicker: "One more garden skill",
                  title: actionReady
                    ? "Water the highlighted flowers"
                    : "Choose the blue watering square",
                  copy: actionReady
                    ? "Double tap Water below to send two short sprays through the highlighted flowers."
                    : "Tap the highlighted flowers. Mary will move into range and the Water button will light up.",
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
      className={`cg-onboarding-card is-required is-${step}${actionReady ? " is-action-ready" : ""}`}
      aria-labelledby="cg-onboarding-title"
    >
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
