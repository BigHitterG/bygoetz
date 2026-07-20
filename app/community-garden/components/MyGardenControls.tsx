"use client";

import { MY_GARDEN_UPGRADES } from "../lib/myGardenCatalog";
import type {
  MyGardenState,
  MyGardenUpgradeType,
} from "@/lib/communityGarden/myGarden";

export type MyGardenMutation =
  | {
      action: "plant";
      gridX: number;
      gridY: number;
      plantType: "rose" | "sunflower" | "lavender";
    }
  | { action: "toggle-path"; gridX: number; gridY: number }
  | { action: "uproot"; plantId: string }
  | { action: "expand" }
  | { action: "purchase-upgrade"; upgradeType: MyGardenUpgradeType };

type MyGardenControlsProps = {
  garden: MyGardenState;
  open: boolean;
  busy: boolean;
  notice: string;
  preview: boolean;
  onClose: () => void;
  onJoin: () => void;
  onMutate: (mutation: MyGardenMutation) => Promise<void>;
};

export function MyGardenControls({
  garden,
  open,
  busy,
  notice,
  preview,
  onClose,
  onJoin,
  onMutate,
}: MyGardenControlsProps) {
  if (!open) return null;

  return (
    <div
      className="cg-garden-controls-scrim"
      role="presentation"
      onPointerDown={onClose}
    >
      <aside
        className="cg-garden-controls"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garden-controls-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="cg-garden-controls-heading">
          <div>
            <p>My Garden</p>
            <h2 id="garden-controls-title">Care & upgrades</h2>
          </div>
          <div className="cg-garden-controls-balance">
            <span>Care</span>
            <strong>{garden.careBalance}</strong>
          </div>
          <button type="button" aria-label="Close garden upgrades" onClick={onClose}>
            X
          </button>
        </div>

        {notice ? <p className="cg-garden-controls-notice">{notice}</p> : null}

        {preview && garden.preview ? (
          <section className="cg-garden-preview-card">
            <div>
              <p>Temporary preview</p>
              <strong>
                {garden.preview.plantingsUsed} of{" "}
                {garden.preview.plantingLimit} flowers planted
              </strong>
            </div>
            <button type="button" onClick={onJoin}>
              Keep this garden · $6.99
            </button>
          </section>
        ) : null}

        <section className="cg-garden-controls-summary">
          <div>
            <span>Plot</span>
            <strong>
              {garden.width} × {garden.height}
            </strong>
          </div>
          <div>
            <span>Planted</span>
            <strong>{garden.plants.length}</strong>
          </div>
          <div>
            <span>Plant</span>
            <strong>{garden.plantCost} Care</strong>
          </div>
        </section>

        <section className="cg-map-upgrades" aria-labelledby="map-upgrades-title">
          <div className="cg-garden-controls-section-heading">
            <div>
              <h3 id="map-upgrades-title">Garden upgrades</h3>
              <p>Permanent touches that appear on this map.</p>
            </div>
          </div>
          <div className="cg-map-upgrade-grid">
            {MY_GARDEN_UPGRADES.map((upgrade) => {
              const owned = garden.upgrades.includes(upgrade.type);
              return (
                <article key={upgrade.type} className={owned ? "is-owned" : ""}>
                  <span
                    className={`cg-upgrade-preview is-${upgrade.type}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{upgrade.name}</strong>
                    <small>{owned ? "In your garden" : `${upgrade.careCost} Care`}</small>
                  </div>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      preview ||
                      owned ||
                      garden.careBalance < upgrade.careCost
                    }
                    onClick={() =>
                      void onMutate({
                        action: "purchase-upgrade",
                        upgradeType: upgrade.type,
                      })
                    }
                  >
                    {owned ? "Added" : "Add"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cg-map-expansion">
          <div>
            <h3>Open the next parcel</h3>
            <p>
              Property level {garden.plotLevel} · {garden.width * garden.height} plantable spaces.
              Tap the pale locked land on the map or open it here.
            </p>
          </div>
          {garden.nextExpansion ? (
            <button
              type="button"
              disabled={
                busy ||
                preview ||
                garden.careBalance < garden.nextExpansion.careCost
              }
              onClick={() => void onMutate({ action: "expand" })}
            >
              Add land to {garden.nextExpansion.width} ×{" "}
              {garden.nextExpansion.height} · {garden.nextExpansion.careCost} Care
            </button>
          ) : (
            <strong>All available parcels open</strong>
          )}
        </section>

        <p className="cg-garden-controls-footnote">
          {preview
            ? `This preview and its Care last for this browser session. Plant up to ${garden.preview?.plantingLimit ?? 3} flowers and try the Path tool. Membership saves the garden and opens upgrades.`
            : `Earn Care by planting and thoughtfully watering in the Community Garden: the first ${garden.dailyCareLimit} Care comes quickly each day, then every four helpful actions earns another. Personal plants stay here permanently and can be uprooted for ${garden.uprootReturn} Care. The Path tool is free to add, move, and remove whenever you like.`}
        </p>
      </aside>
    </div>
  );
}
