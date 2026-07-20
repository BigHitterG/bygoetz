"use client";

import type { GardenTool } from "./GardenCanvas";
import type { GardenWorldMode } from "../game/gardenRenderer";
import {
  MY_GARDEN_ELEMENTS,
  type MyGardenElementType,
} from "../lib/myGardenCatalog";
import { getPlantDefinition, PLANT_TYPES, type PlantType } from "../lib/roseLifecycle";

type GardenInventoryProps = {
  mode: GardenWorldMode;
  open: boolean;
  selectedTool: GardenTool;
  onToggle: () => void;
  onSelectPlant: (plantType: PlantType) => void;
  onSelectPath: () => void;
  onSelectElement: (elementType: MyGardenElementType) => void;
};

export function GardenInventory({
  mode,
  open,
  selectedTool,
  onToggle,
  onSelectPlant,
  onSelectPath,
  onSelectElement,
}: GardenInventoryProps) {
  const selectedElement = MY_GARDEN_ELEMENTS.find(
    (element) => element.type === selectedTool,
  );
  const selectedName =
    selectedTool === "path"
      ? "Path"
      : selectedElement?.name ?? getPlantDefinition(selectedTool as PlantType).name;
  const selectedClass =
    selectedTool === "path"
      ? "cg-path-icon"
      : selectedElement
        ? `cg-item-glyph is-${selectedElement.type}`
        : `cg-plant-glyph is-${selectedTool}`;

  return (
    <div className={`cg-inventory${open ? " is-open" : ""}`}>
      {open ? (
        <section className="cg-inventory-panel" aria-label="Garden inventory">
          <header>
            <strong>Inventory</strong>
            <small>Choose, then place it on the map</small>
          </header>

          <div className="cg-inventory-section">
            <p>Plants</p>
            <div className="cg-inventory-grid">
              {PLANT_TYPES.map((plantType) => {
                const plant = getPlantDefinition(plantType);
                return (
                  <button
                    key={plantType}
                    type="button"
                    aria-label={`Select ${plant.name} seeds`}
                    aria-pressed={selectedTool === plantType}
                    onClick={() => onSelectPlant(plantType)}
                  >
                    <span
                      className={`cg-plant-glyph is-${plantType}`}
                      aria-hidden="true"
                    />
                    <span>{plant.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "personal" ? (
            <div className="cg-inventory-section">
              <p>Items</p>
              <div className="cg-inventory-grid is-items">
                <button
                  type="button"
                  aria-label="Select the free path tool"
                  aria-pressed={selectedTool === "path"}
                  onClick={onSelectPath}
                >
                  <span className="cg-path-icon" aria-hidden="true" />
                  <span>Path</span>
                  <small>Free</small>
                </button>
                {MY_GARDEN_ELEMENTS.map((element) => (
                  <button
                    key={element.type}
                    type="button"
                    aria-label={`Select ${element.name}, ${element.careCost} Care`}
                    aria-pressed={selectedTool === element.type}
                    onClick={() => onSelectElement(element.type)}
                  >
                    <span
                      className={`cg-item-glyph is-${element.type}`}
                      aria-hidden="true"
                    />
                    <span>{element.name}</span>
                    <small>{element.careCost} Care</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <button
        className="cg-inventory-toggle"
        type="button"
        aria-expanded={open}
        aria-label={`${open ? "Close" : "Open"} inventory. ${selectedName} selected.`}
        onClick={onToggle}
      >
        <span className={selectedClass} aria-hidden="true" />
        <span>
          <small>{open ? "Close" : "Inventory"}</small>
          <strong>{selectedName}</strong>
        </span>
        <i aria-hidden="true">{open ? "▼" : "▲"}</i>
      </button>
    </div>
  );
}
