"use client";

import { useEffect, useMemo, useState } from "react";
import type { GardenTool } from "./GardenCanvas";
import type { GardenWorldMode } from "../game/gardenRenderer";
import {
  getMyGardenCollection,
  getMyGardenElementGlyphClass,
  getMyGardenPlant,
  isMyGardenCatalogEntryUnlocked,
  MY_GARDEN_CATALOG_UNLOCKS,
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
  inventorySeenLifetimeCare: number;
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
  inventorySeenLifetimeCare,
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
      ).sort(
        (left, right) =>
          left.lifetimeCareRequired - right.lifetimeCareRequired,
      ),
    [currentCategory],
  );
  const nextUnlock = MY_GARDEN_CATALOG_UNLOCKS.find(
    (entry) => entry.lifetimeCareRequired > lifetimeCare,
  );
  const currentCollection = [...MY_GARDEN_COLLECTIONS]
    .reverse()
    .find((collection) => collection.lifetimeCareRequired <= lifetimeCare);
  const newUnlocks = useMemo(
    () =>
      new Set(
        MY_GARDEN_CATALOG_UNLOCKS.filter(
          (entry) =>
            entry.lifetimeCareRequired > inventorySeenLifetimeCare &&
            entry.lifetimeCareRequired <= lifetimeCare,
        ).map((entry) => entry.key),
      ),
    [inventorySeenLifetimeCare, lifetimeCare],
  );

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onToggle();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle, open]);

  return (
    <div
      className={`cg-inventory${open ? " is-open" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && open) onToggle();
      }}
    >
      {open ? (
        <section
          className="cg-inventory-panel"
          role="dialog"
          aria-label="Garden inventory"
        >
          <header>
            <span>
              <strong>Inventory</strong>
              <small>
                {guidePlantChoice
                  ? "Choose one flower to begin"
                  : "Choose an item, then place it on the map"}
              </small>
            </span>
            <button
              className="cg-inventory-close"
              type="button"
              aria-label="Close inventory"
              onClick={onToggle}
            >
              ×
            </button>
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
                  {nextUnlock
                    ? `${nextUnlock.lifetimeCareRequired - lifetimeCare} until ${nextUnlock.name}`
                    : "Release 1 collections complete"}
                </small>
                {currentCollection ? (
                  <strong>{currentCollection.name}</strong>
                ) : null}
              </div>
              <nav className="cg-inventory-tabs" aria-label="Inventory categories">
                {CATEGORIES.map((entry) => {
                  const hasNewUnlock = MY_GARDEN_CATALOG_UNLOCKS.some(
                    (unlock) =>
                      unlock.category === entry.key &&
                      newUnlocks.has(unlock.key),
                  );
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      aria-pressed={currentCategory === entry.key}
                      onClick={() => setCategory(entry.key)}
                    >
                      {entry.name}
                      {hasNewUnlock ? (
                        <i aria-label={`New ${entry.name} unlocks`}>!</i>
                      ) : null}
                    </button>
                  );
                })}
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
                  const isNew =
                    catalogPlant &&
                    newUnlocks.has(`plant:${catalogPlant.type}`);
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
                        isNew ? "is-new-unlock" : "",
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
                        <small>
                          {isNew ? "New · " : ""}
                          {catalogPlant.careCost} Care
                        </small>
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
                  const isNew = newUnlocks.has(`element:${element.type}`);
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
                      className={[
                        unlocked ? "" : "is-locked",
                        isNew ? "is-new-unlock" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                          {isNew ? "New · " : ""}
                          {element.careCost} Care
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
                  const isNew = newUnlocks.has(`element:${element.type}`);
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
                      className={[
                        unlocked ? "" : "is-locked",
                        isNew ? "is-new-unlock" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                          {isNew ? " · New" : ""}
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
