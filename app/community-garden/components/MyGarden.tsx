"use client";

import type { Session } from "@supabase/supabase-js";
import { useMemo, useState, type CSSProperties } from "react";
import { MY_GARDEN_UPGRADES } from "../lib/myGardenCatalog";
import type {
  MyGardenPlant,
  MyGardenPlantType,
  MyGardenState,
} from "@/lib/communityGarden/myGarden";

const PLANT_CHOICES: { type: MyGardenPlantType; name: string }[] = [
  { type: "rose", name: "Rose" },
  { type: "sunflower", name: "Sunflower" },
  { type: "lavender", name: "Lavender" },
];

type SelectedBed =
  | { kind: "empty"; gridX: number; gridY: number }
  | { kind: "plant"; plant: MyGardenPlant }
  | null;

type MyGardenProps = {
  initialGarden: MyGardenState;
  session: Session;
  gardenName: string;
  onGoToCommunity?: () => void;
};

async function getResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function MyGarden({
  initialGarden,
  session,
  gardenName,
  onGoToCommunity,
}: MyGardenProps) {
  const [garden, setGarden] = useState(initialGarden);
  const [selectedPlantType, setSelectedPlantType] =
    useState<MyGardenPlantType>("rose");
  const [selectedBed, setSelectedBed] = useState<SelectedBed>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Choose a garden bed. Planting here uses Care earned in the Community Garden.",
  );

  const plantsByBed = useMemo(
    () =>
      new Map(
        garden.plants.map((plant) => [
          `${plant.gridX}:${plant.gridY}`,
          plant,
        ]),
      ),
    [garden.plants],
  );

  const beds = useMemo(
    () =>
      Array.from({ length: garden.width * garden.height }, (_, index) => ({
        gridX: index % garden.width,
        gridY: Math.floor(index / garden.width),
      })),
    [garden.height, garden.width],
  );

  async function updateGarden(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/community-garden/my-garden", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, "My Garden could not be updated."));
      }
      setGarden((await response.json()) as MyGardenState);
      setSelectedBed(null);
      setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "My Garden could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const selectedPlant =
    selectedBed?.kind === "plant" ? selectedBed.plant : null;
  const selectedChoice =
    PLANT_CHOICES.find((plant) => plant.type === selectedPlantType) ??
    PLANT_CHOICES[0];

  return (
    <section className="cg-my-garden" aria-labelledby="my-garden-title">
      <div className="cg-my-garden-heading">
        <div>
          <p className="cg-kicker">Your cozy base station</p>
          <h3 id="my-garden-title">{gardenName}</h3>
        </div>
        <div className="cg-care-balance" aria-label={`${garden.careBalance} Care available`}>
          <span>Care</span>
          <strong>{garden.careBalance}</strong>
        </div>
      </div>

      <div
        className={[
          "cg-home-scene",
          garden.upgrades.includes("sage_shed") ? "has-sage-shed" : "",
          garden.upgrades.includes("stone_path") ? "has-stone-path" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="cg-home-sky" aria-hidden="true">
          <span className="cg-home-cloud is-one" />
          <span className="cg-home-cloud is-two" />
        </div>
        <div className="cg-home-shed" aria-hidden="true">
          <span className="cg-shed-chimney" />
          <span className="cg-shed-roof" />
          <span className="cg-shed-wall" />
          <span className="cg-shed-window" />
          <span className="cg-shed-door" />
          <span className="cg-shed-step" />
        </div>
        <div className="cg-home-tree" aria-hidden="true">
          <span />
        </div>
        <div className="cg-home-path" aria-hidden="true" />
        {garden.upgrades.includes("birdhouse") ? (
          <div className="cg-home-birdhouse" aria-label="Birdhouse upgrade">
            <span />
          </div>
        ) : null}
        {garden.upgrades.includes("bench") ? (
          <div className="cg-home-bench" aria-label="Garden bench upgrade">
            <span />
          </div>
        ) : null}

        <div
          className="cg-personal-plot"
          style={{ "--garden-columns": garden.width } as CSSProperties}
          aria-label={`${garden.width} by ${garden.height} personal garden plot`}
        >
          {beds.map(({ gridX, gridY }) => {
            const plant = plantsByBed.get(`${gridX}:${gridY}`);
            const isSelected =
              selectedBed?.kind === "empty"
                ? selectedBed.gridX === gridX && selectedBed.gridY === gridY
                : selectedBed?.kind === "plant" && selectedBed.plant.id === plant?.id;
            const label = plant
              ? `${plant.plantType} in row ${gridY + 1}, column ${gridX + 1}`
              : `Empty bed in row ${gridY + 1}, column ${gridX + 1}`;

            return (
              <button
                key={`${gridX}:${gridY}`}
                className="cg-garden-bed"
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedBed(
                    plant
                      ? { kind: "plant", plant }
                      : { kind: "empty", gridX, gridY },
                  );
                  setNotice(
                    plant
                      ? `This ${plant.plantType} is yours. You can uproot it here.`
                      : `Open bed selected. Plant a ${selectedChoice.name.toLowerCase()} for ${garden.plantCost} Care.`,
                  );
                }}
              >
                {plant ? (
                  <span
                    className={`cg-plant-glyph is-${plant.plantType}`}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="cg-bed-soil-mark" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        <span className="cg-home-fence" aria-hidden="true" />
        <span className="cg-home-sign" aria-hidden="true">MY GARDEN</span>
      </div>

      <div className="cg-garden-workbench">
        <div className="cg-garden-status">
          <strong>
            {selectedPlant
              ? `${selectedPlant.plantType} selected`
              : selectedBed
                ? "Open bed selected"
                : `${garden.plants.length} of ${garden.width * garden.height} beds planted`}
          </strong>
          <span>{notice}</span>
        </div>

        {!selectedPlant ? (
          <div className="cg-my-seed-picker" role="group" aria-label="Choose a plant for My Garden">
            {PLANT_CHOICES.map((plant) => (
              <button
                key={plant.type}
                type="button"
                aria-pressed={selectedPlantType === plant.type}
                onClick={() => {
                  setSelectedPlantType(plant.type);
                  if (selectedBed?.kind === "empty") {
                    setNotice(`Plant a ${plant.name.toLowerCase()} here for ${garden.plantCost} Care.`);
                  }
                }}
              >
                <span className={`cg-plant-glyph is-${plant.type}`} aria-hidden="true" />
                <span>{plant.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedBed?.kind === "empty" ? (
          <button
            className="cg-garden-primary-action"
            type="button"
            disabled={busy || garden.careBalance < garden.plantCost}
            onClick={() =>
              void updateGarden(
                {
                  action: "plant",
                  gridX: selectedBed.gridX,
                  gridY: selectedBed.gridY,
                  plantType: selectedPlantType,
                },
                `${selectedChoice.name} planted. This place is becoming yours.`,
              )
            }
          >
            {busy ? "Planting…" : `Plant ${selectedChoice.name} · ${garden.plantCost} Care`}
          </button>
        ) : null}

        {selectedPlant ? (
          <button
            className="cg-garden-uproot"
            type="button"
            disabled={busy}
            onClick={() =>
              void updateGarden(
                { action: "uproot", plantId: selectedPlant.id },
                `Plant uprooted. ${garden.uprootReturn} Care returned to your basket.`,
              )
            }
          >
            {busy ? "Uprooting…" : `Uproot plant · return ${garden.uprootReturn} Care`}
          </button>
        ) : null}
      </div>

      <div className="cg-care-loop">
        <div>
          <p className="cg-auth-step">How My Garden grows</p>
          <h3>Care outside, create at home</h3>
          <p>
            Plant and thoughtfully water in the Community Garden to earn Care.
            Spend it here on your own plants and a larger plot.
          </p>
          <dl className="cg-care-rates">
            <div><dt>Plant outside</dt><dd>+2</dd></div>
            <div><dt>Water after 4h</dt><dd>+1</dd></div>
            <div><dt>Daily basket</dt><dd>{garden.dailyCareLimit}</dd></div>
          </dl>
        </div>
        <button type="button" onClick={onGoToCommunity}>
          Earn Care in Community Garden
        </button>
      </div>

      <div className="cg-upgrade-shelf">
        <div className="cg-steward-section-heading">
          <h3>Garden upgrades</h3>
          <small>Permanent, visible rewards</small>
        </div>
        <p>
          Your plants stay in My Garden. Add lasting touches by caring for the
          public garden.
        </p>
        <div className="cg-upgrade-grid">
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
                  disabled={busy || owned || garden.careBalance < upgrade.careCost}
                  onClick={() =>
                    void updateGarden(
                      {
                        action: "purchase-upgrade",
                        upgradeType: upgrade.type,
                      },
                      `${upgrade.name} added to My Garden.`,
                    )
                  }
                >
                  {owned ? "Added" : "Add"}
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <div className="cg-plot-expansion">
        <div>
          <strong>Plot level {garden.plotLevel}</strong>
          <span>{garden.width} × {garden.height} · {garden.width * garden.height} beds</span>
        </div>
        {garden.nextExpansion ? (
          <button
            type="button"
            disabled={busy || garden.careBalance < garden.nextExpansion.careCost}
            onClick={() =>
              void updateGarden(
                { action: "expand" },
                `Your garden grew to ${garden.nextExpansion?.width} × ${garden.nextExpansion?.height}.`,
              )
            }
          >
            Expand to {garden.nextExpansion.width} × {garden.nextExpansion.height}
            {" · "}{garden.nextExpansion.careCost} Care
          </button>
        ) : (
          <span className="cg-plot-complete">Your full garden plot is open.</span>
        )}
      </div>
    </section>
  );
}
