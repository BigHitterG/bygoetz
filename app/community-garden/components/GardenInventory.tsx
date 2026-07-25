"use client";

import { useEffect, useMemo, useState } from "react";
import type { GardenTool } from "./GardenCanvas";
import type { GardenWorldMode } from "../game/gardenRenderer";
import {
  BASIL_LIFETIME_CARE_GOAL,
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
import { GardenCatalogSprite } from "./GardenCatalogSprite";

type GardenInventoryProps = {
  mode: GardenWorldMode;
  open: boolean;
  selectedTool: GardenTool;
  lifetimeCare: number;
  inventorySeenLifetimeCare: number;
  guidePlantChoice?: boolean;
  onboardingLocked?: boolean;
  toggleLocked?: boolean;
  designPreviewEnabled?: boolean;
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

const DESIGN_PREVIEW_STEPS = [
  ...new Set([
    ...MY_GARDEN_CATALOG_UNLOCKS.map((entry) => entry.lifetimeCareRequired),
    ...MY_GARDEN_COLLECTIONS.map((entry) => entry.lifetimeCareRequired),
    BASIL_LIFETIME_CARE_GOAL,
  ]),
].sort((left, right) => left - right);

function getPreviewStepLabel(lifetimeCare: number) {
  const collection = MY_GARDEN_COLLECTIONS.find(
    (entry) => entry.lifetimeCareRequired === lifetimeCare,
  );
  const items = MY_GARDEN_CATALOG_UNLOCKS.filter(
    (entry) => entry.lifetimeCareRequired === lifetimeCare,
  );
  return [
    lifetimeCare.toLocaleString(),
    collection?.name,
    items.map((entry) => entry.name).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");
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
  designPreviewEnabled = false,
  onToggle,
  onSelectPlant,
  onSelectPath,
  onSelectElement,
}: GardenInventoryProps) {
  const [category, setCategory] =
    useState<MyGardenInventoryCategory>("plants");
  const [previewLifetimeCare, setPreviewLifetimeCare] = useState<number | null>(
    null,
  );
  const effectivePreviewLifetimeCare = designPreviewEnabled
    ? previewLifetimeCare
    : null;
  const displayedLifetimeCare =
    effectivePreviewLifetimeCare ?? lifetimeCare;
  const designPreviewActive = effectivePreviewLifetimeCare !== null;
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
    (entry) => entry.lifetimeCareRequired > displayedLifetimeCare,
  );
  const currentCollection = [...MY_GARDEN_COLLECTIONS]
    .reverse()
    .find(
      (collection) =>
        collection.lifetimeCareRequired <= displayedLifetimeCare,
    );
  const nextCollectionCompletion = MY_GARDEN_COLLECTIONS.find(
    (collection) =>
      collection.completionLifetimeCareRequired > displayedLifetimeCare,
  );
  const nextProgressMessage = nextUnlock
    ? `${(
        nextUnlock.lifetimeCareRequired - displayedLifetimeCare
      ).toLocaleString()} until ${nextUnlock.name}`
    : nextCollectionCompletion
      ? `${(
          nextCollectionCompletion.completionLifetimeCareRequired -
          displayedLifetimeCare
        ).toLocaleString()} until ${nextCollectionCompletion.name} complete`
      : displayedLifetimeCare < BASIL_LIFETIME_CARE_GOAL
        ? `${(
            BASIL_LIFETIME_CARE_GOAL - displayedLifetimeCare
          ).toLocaleString()} until Basil I`
        : "Basil I achieved";
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
                <span>
                  {designPreviewActive ? "Previewing " : ""}
                  {displayedLifetimeCare.toLocaleString()} lifetime Care
                </span>
                <small>{nextProgressMessage}</small>
                {currentCollection ? (
                  <strong>{currentCollection.name}</strong>
                ) : null}
              </div>
              {designPreviewEnabled ? (
                <div className="cg-inventory-design-preview">
                  <label htmlFor="garden-design-preview">
                    Owner progression preview
                  </label>
                  <select
                    id="garden-design-preview"
                    value={previewLifetimeCare ?? ""}
                    onChange={(event) => {
                      setPreviewLifetimeCare(
                        event.target.value
                          ? Number(event.target.value)
                          : null,
                      );
                    }}
                  >
                    <option value="">
                      Actual progress · {lifetimeCare.toLocaleString()}
                    </option>
                    {DESIGN_PREVIEW_STEPS.map((step) => (
                      <option key={step} value={step}>
                        {getPreviewStepLabel(step)}
                      </option>
                    ))}
                  </select>
                  <small>
                    Preview only. Your Care, unlocks and saved garden never change.
                  </small>
                </div>
              ) : null}
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
                    isMyGardenCatalogEntryUnlocked(
                      catalogPlant,
                      displayedLifetimeCare,
                    );
                  const placeable =
                    !catalogPlant ||
                    isMyGardenCatalogEntryUnlocked(catalogPlant, lifetimeCare);
                  const previewOnly =
                    designPreviewActive && unlocked && !placeable;
                  const isNew =
                    catalogPlant &&
                    !designPreviewActive &&
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
                      aria-disabled={previewOnly}
                      className={[
                        guidePlantChoice ? "is-onboarding-choice" : "",
                        unlocked ? "" : "is-locked",
                        previewOnly ? "is-design-preview" : "",
                        isNew ? "is-new-unlock" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!unlocked}
                      onClick={() => {
                        if (
                          unlocked &&
                          placeable &&
                          (!onboardingLocked ||
                            isGardenOnboardingPlantType(plantType))
                        ) {
                          onSelectPlant(plantType);
                        }
                      }}
                    >
                      <GardenCatalogSprite
                        kind="plant"
                        type={plantType as MyGardenPlantType}
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
                    displayedLifetimeCare,
                  );
                  const placeable = isMyGardenCatalogEntryUnlocked(
                    element,
                    lifetimeCare,
                  );
                  const previewOnly =
                    designPreviewActive && unlocked && !placeable;
                  const isNew =
                    !designPreviewActive &&
                    newUnlocks.has(`element:${element.type}`);
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
                      aria-disabled={previewOnly}
                      className={[
                        unlocked ? "" : "is-locked",
                        previewOnly ? "is-design-preview" : "",
                        isNew ? "is-new-unlock" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!unlocked}
                      onClick={() => {
                        if (placeable) onSelectElement(element.type);
                      }}
                    >
                      <GardenCatalogSprite kind="element" type={element.type} />
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
                    displayedLifetimeCare,
                  );
                  const placeable = isMyGardenCatalogEntryUnlocked(
                    element,
                    lifetimeCare,
                  );
                  const previewOnly =
                    designPreviewActive && unlocked && !placeable;
                  const collection = getMyGardenCollection(element.collection);
                  const isNew =
                    !designPreviewActive &&
                    newUnlocks.has(`element:${element.type}`);
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
                      aria-disabled={previewOnly}
                      className={[
                        unlocked ? "" : "is-locked",
                        previewOnly ? "is-design-preview" : "",
                        isNew ? "is-new-unlock" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!unlocked}
                      onClick={() => {
                        if (placeable) onSelectElement(element.type);
                      }}
                    >
                      <GardenCatalogSprite kind="element" type={element.type} />
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
