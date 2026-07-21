import type { GardenOnboardingStep } from "../lib/gardenOnboarding";

type GardenOnboardingProps = {
  step: GardenOnboardingStep | null;
  previewPlantings: number;
  previewLimit: number;
  inventoryOpen: boolean;
  actionReady: boolean;
  onDismiss: () => void;
  onOpenInventory: () => void;
  onOpenMyGarden: () => void;
};

export function GardenOnboarding({
  step,
  previewPlantings,
  previewLimit,
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
    step === "personal-seed" ||
    step === "preview-free"
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
      : step === "community-tile"
        ? {
            kicker: "Your first planting",
            title: actionReady ? "You are in place" : "Choose the glowing patch",
            copy: actionReady
              ? "Tap the Plant button below to add your flower."
              : "Tap the highlighted open ground. Your gardener will walk over to it.",
            action: null,
            onAction: null,
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
            : step === "preview-full"
              ? {
                  kicker: "Three flowers planted",
                  title: "Keep growing when you are ready",
                  copy: "Choose another open spot and try to plant a fourth flower to unlock your full garden.",
                  action: "Open Inventory",
                  onAction: onOpenInventory,
                }
        : {
            kicker: "Your garden",
            title: `${Math.max(0, previewLimit - previewPlantings)} flowers remain`,
            copy: "Keep arranging your preview at your own pace.",
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
