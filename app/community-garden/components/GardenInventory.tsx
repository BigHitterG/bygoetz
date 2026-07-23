"use client";

import { useMemo, useState } from "react";
import type { GardenTool } from "./GardenCanvas";
import type { GardenWorldMode } from "../game/gardenRenderer";
import {
  getMyGardenCollection,
  getMyGardenElementGlyphClass,
  getMyGardenPlant,
  isMyGardenCatalogEntryUnlocked,
  MY_GARDEN_COLLECTIONS,
  MY_GARDEN_ELEMENTS,
  MY_GARDEN_PLANTS,
  type MyGardenElementType,
  type MyGardenInventoryCategory,
  type MyGardenPlantType,
} from "../lib/myGardenCatalog";
import { getPlantDefinition, PLANT_TYPES, type PlantType } from "../lib/roseLifecycle";
import {
  GARDEN_ONBOARDING_PLANT_TYPES,
  isGardenOnboardingPlantType,
} from "../lib/gardenOnboarding";

type GardenInventoryProps = {
  mode: GardenWorldMode;
  open: boolean;
  selectedTool: GardenTool;
  lifetimeCare: number;
  guidePlantChoice?: boolean;
  onboardingLocked?: boolean;
  toggleLocked?: boolean;
  onToggle: () => void;
  onSelectPlant: (plantType: PlantType) => void;
  onSelectPath: () => void;
  onSelectElement: (elementType: MyGardenElementType) => void;
};

const CATEGORIES: Array<{
  key: MyGardenInventoryCategory;
  name: string;
}> = [
  { key: "plants", name: "Plants" },
  { key: "paths", name: "Paths" },
  { key: "decor", name: "Decor" },
  { key: "nature", name: "Nature" },
  { key: "water", name: "Water" },
];

function UnlockLabel({ lifetimeCareRequired }: { lifetimeCareRequired: number }) {
  return <small>Unlocks at {lifetimeCareRequired.toLocaleString()} lifetime Care</small>;
}

export function GardenInventory({
  mode,
  open,
  selectedTool,
  lifetimeCare,
  guidePlantChoice = false,
  onboardingLocked = false,
  toggleLocked = false,
  onToggle,
  onSelectPlant,
  onSelectPath,
  onSelectElement,
}: GardenInventoryProps) {
  const [category, setCategory] =
    useState<MyGardenInventoryCategory>("plants");
  const availablePlantTypes = onboardingLocked
    ? GARDEN_ONBOARDING_PLANT_TYPES
    : mode === "personal"
      ? MY_GARDEN_PLANTS.map((plant) => plant.type)
      : PLANT_TYPES;
  const selectedElement = MY_GARDEN_ELEMENTS.find(
    (element) => element.type === selectedTool,
  );
  const selectedPlant = MY_GARDEN_PLANTS.find(
    (plant) => plant.type === selectedTool,
  );
  const selectedName =
    selectedTool === "path"
      ? "Path"
      : selectedElement?.name ??
        selectedPlant?.name ??
        getPlantDefinition(selectedTool as PlantType).name;
  const selectedClass =
    selectedTool === "path"
      ? "cg-path-icon"
      : selectedElement
        ? `cg-item-glyph ${getMyGardenElementGlyphClass(selectedElement.type)}`
        : `cg-plant-glyph is-${selectedTool}`;
  const currentCategory =
    mode === "personal" && !onboardingLocked ? category : "plants";
  const categoryElements = useMemo(
    () =>
      MY_GARDEN_ELEMENTS.filter(
        (element) => element.category === currentCategory,
      ),
    [currentCategory],
  );
  const nextCollection = MY_GARDEN_COLLECTIONS.find(
    (collection) => collection.lifetimeCareRequired > lifetimeCare,
  );

  return (
    <div className={`cg-inventory${open ? " is-open" : ""}`}>
      {open ? (
        <section className="cg-inventory-panel" aria-label="Garden inventory">
          <header>
            <strong>Inventory</strong>
            <small>
              {guidePlantChoice
                ? "Choose one flower to begin"
                : "Choose, then place it on the map"}
            </small>
          </header>

          {guidePlantChoice ? (
            <p className="cg-inventory-guide" role="status">
              Tap any flower below
            </p>
          ) : null}

          {mode === "personal" && !onboardingLocked ? (
            <>
              <div className="cg-inventory-progress" aria-label="Collection progress">
                <span>{lifetimeCare.toLocaleString()} lifetime Care</span>
                <small>
                  {nextCollection
                    ? `${nextCollection.lifetimeCareRequired - lifetimeCare} until ${nextCollection.name}`
                    : "Release 1 collections complete"}
                </small>
              </div>
              <nav className="cg-inventory-tabs" aria-label="Inventory categories">
                {CATEGORIES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={currentCategory === entry.key}
                    onClick={() => setCategory(entry.key)}
                  >
                    {entry.name}
                  </button>
                ))}
              </nav>
            </>
          ) : null}

          {currentCategory === "plants" ? (
            <div className="cg-inventory-section">
              <p>Plants</p>
              <div className="cg-inventory-grid">
                {availablePlantTypes.map((plantType) => {
                  const plant = getPlantDefinition(plantType);
                  const catalogPlant =
                    mode === "personal"
                      ? getMyGardenPlant(plantType as MyGardenPlantType)
                      : null;
                  const unlocked =
                    !catalogPlant ||
                    isMyGardenCatalogEntryUnlocked(catalogPlant, lifetimeCare);
                  return (
                    <button
                      key={plantType}
                      type="button"
                      aria-label={
                        unlocked
                          ? `Select ${plant.name} seeds`
                          : `${plant.name} locked until ${catalogPlant?.lifetimeCareRequired} lifetime Care`
                      }
                      aria-pressed={selectedTool === plantType}
                      className={[
                        guidePlantChoice ? "is-onboarding-choice" : "",
                        unlocked ? "" : "is-locked",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!unlocked}
                      onClick={() => {
                        if (
                          unlocked &&
                          (!onboardingLocked ||
                            isGardenOnboardingPlantType(plantType))
                        ) {
                          onSelectPlant(plantType);
                        }
                      }}
                    >
                      <span
                        className={`cg-plant-glyph is-${plantType}`}
                        aria-hidden="true"
                      />
                      <span>{plant.name}</span>
                      {catalogPlant && !unlocked ? (
                        <UnlockLabel
                          lifetimeCareRequired={
                            catalogPlant.lifetimeCareRequired
                          }
                        />
                      ) : catalogPlant ? (
                        <small>{catalogPlant.careCost} Care</small>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "personal" &&
          !onboardingLocked &&
          currentCategory === "paths" ? (
            <div className="cg-inventory-section">
              <p>Paths</p>
              <div className="cg-inventory-grid is-items">
                <button
                  type="button"
                  aria-label="Select the free path tool"
                  aria-pressed={selectedTool === "path"}
                  onClick={onSelectPath}
                >
                  <span className="cg-path-icon" aria-hidden="true" />
                  <span>Garden path</span>
                  <small>Free</small>
                </button>
                {categoryElements.map((element) => {
                  const unlocked = isMyGardenCatalogEntryUnlocked(
                    element,
                    lifetimeCare,
                  );
                  return (
                    <button
                      key={element.type}
                      type="button"
                      aria-label={
                        unlocked
                          ? `Select ${element.name}, ${element.careCost} Care`
                          : `${element.name} locked until ${element.lifetimeCareRequired} lifetime Care`
                      }
                      aria-pressed={selectedTool === element.type}
                      className={unlocked ? undefined : "is-locked"}
                      disabled={!unlocked}
                      onClick={() => onSelectElement(element.type)}
                    >
                      <span
                        className={`cg-item-glyph ${getMyGardenElementGlyphClass(element.type)}`}
                        aria-hidden="true"
                      />
                      <span>{element.name}</span>
                      <small>{element.careCost} Care</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "personal" &&
          !onboardingLocked &&
          currentCategory !== "plants" &&
          currentCategory !== "paths" ? (
            <div className="cg-inventory-section">
              <p>{CATEGORIES.find((entry) => entry.key === currentCategory)?.name}</p>
              <div className="cg-inventory-grid is-items">
                {categoryElements.map((element) => {
                  const unlocked = isMyGardenCatalogEntryUnlocked(
                    element,
                    lifetimeCare,
                  );
                  const collection = getMyGardenCollection(element.collection);
                  return (
                    <button
                      key={element.type}
                      type="button"
                      aria-label={
                        unlocked
                          ? `Select ${element.name}, ${element.careCost} Care`
                          : `${element.name} locked with ${collection.name}`
                      }
                      aria-pressed={selectedTool === element.type}
                      className={unlocked ? undefined : "is-locked"}
                      disabled={!unlocked}
                      onClick={() => onSelectElement(element.type)}
                    >
                      <span
                        className={`cg-item-glyph ${getMyGardenElementGlyphClass(element.type)}`}
                        aria-hidden="true"
                      />
                      <span>{element.name}</span>
                      {unlocked ? (
                        <small>
                          {element.careCost} Care
                          {element.footprintWidth > 1 ||
                          element.footprintHeight > 1
                            ? ` · ${element.footprintWidth}×${element.footprintHeight}`
                            : ""}
                        </small>
                      ) : (
                        <UnlockLabel
                          lifetimeCareRequired={element.lifetimeCareRequired}
                        />
                      )}
                    </button>
                  );
                })}
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
        disabled={toggleLocked}
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
