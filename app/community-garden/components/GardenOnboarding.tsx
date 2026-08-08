import type { GardenOnboardingStep } from "../lib/gardenOnboarding";
import {
  COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS,
  COMMUNITY_FAST_START_PLANTINGS,
} from "../lib/gardenOnboarding";

type GardenOnboardingProps = {
  step: GardenOnboardingStep | null;
  communityQuickStart?: boolean;
  communityPlantings: number;
  inventoryOpen: boolean;
  plantActionReady: boolean;
  waterActionReady: boolean;
  onOpenInventory: () => void;
  onOpenMyGarden: () => void;
};

export function GardenOnboarding({
  step,
  communityQuickStart = false,
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

  if (
    communityQuickStart &&
    communityPlantings > 0 &&
    (step === "community-tile" || step === "community-repeat")
  ) {
    return null;
  }

  const actionReady =
    step === "community-water" ? waterActionReady : plantActionReady;
  const communityPlantingTarget = communityQuickStart
    ? COMMUNITY_FAST_START_PLANTINGS
    : COMMUNITY_CLASSIC_ONBOARDING_PLANTINGS;
  const content =
    step === "plant"
      ? {
          kicker: "The whole world plants here",
          title: "One public garden, shared by everyone",
          copy: "Anyone online, anywhere in the world, can plant on this same map for free. No account or username is needed. Choose one flower, then add it three times.",
          desktopHint: "Press Q to open Inventory.",
          action: "Open Inventory",
          onAction: onOpenInventory,
        }
      : step === "community-tile" || step === "community-repeat"
        ? {
            kicker:
              communityQuickStart && communityPlantings === 0
                ? ""
                : `${communityQuickStart ? "Quick planting" : "Community planting"} ${Math.min(communityPlantingTarget, communityPlantings + 1)} of ${communityPlantingTarget}`,
            title: actionReady
              ? communityQuickStart && communityPlantings === 0
                ? "Plant your first flower"
                : "You are in place"
              : "Choose the glowing patch",
            copy: actionReady
              ? communityQuickStart && communityPlantings === 0
                ? "Your flower and planting spot are ready. Tap Plant below."
                : "Tap the Plant button below to add your flower."
              : communityPlantings > 0
                ? communityQuickStart
                  ? "Tap anywhere near the next glowing patch. Basil will guide Mary to the right spot."
                  : "Keep your chosen plant. Tap the next glowing patch to walk over."
                : communityQuickStart
                  ? "A starter flower is already selected. Tap the highlighted open ground to walk over."
                  : "Tap the highlighted open ground. Your gardener will walk over to it.",
            desktopHint: actionReady
              ? "Press E to plant."
              : "Click the glowing patch to walk there.",
            action: null,
            onAction: null,
          }
      : step === "my-garden"
        ? {
            kicker: "Community skills complete",
            title: "See what your Care can grow",
            copy: "You planted three flowers and learned to water. My Garden is now ready to try.",
            desktopHint: "Press C to switch gardens.",
            action: "Visit My Garden",
            onAction: onOpenMyGarden,
          }
        : step === "personal-inventory"
          ? {
              kicker: "Your garden preview",
              title: "Plant your first flower",
              copy: "Try your first one with the guide, then arrange up to nine more however you like.",
              desktopHint: "Press Q to open Inventory.",
              action: "Open Inventory",
              onAction: onOpenInventory,
            }
          : step === "personal-tile"
            ? {
                kicker: "Your first flower",
                title: actionReady ? "Ready to plant" : "Choose the glowing patch",
                copy: actionReady
                  ? "Tap the Plant button below. Your next nine flowers are yours to arrange."
                  : "Tap the highlighted ground and walk over to make this space your own.",
                desktopHint: actionReady
                  ? "Press E to plant."
                  : "Click the glowing patch to walk there.",
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
                  desktopHint: actionReady
                    ? "Press E twice to water."
                    : "Click a flower with a water drop.",
                  action: null,
                  onAction: null,
                }
        : {
            kicker: "Your garden preview",
            title: "Choose your first flower",
            copy: "Open Inventory and start making this garden your own.",
            desktopHint: "Press Q to open Inventory.",
            action: "Open Inventory",
            onAction: onOpenInventory,
          };

  return (
    <aside
      className={`cg-onboarding-card is-required is-${step}${actionReady ? " is-action-ready" : ""}`}
      aria-labelledby="cg-onboarding-title"
    >
      {content.kicker ? <p>{content.kicker}</p> : null}
      <h2 id="cg-onboarding-title">{content.title}</h2>
      <span>{content.copy}</span>
      <kbd className="cg-onboarding-desktop-hint">{content.desktopHint}</kbd>
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
