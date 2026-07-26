"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GardenShareScope } from "./GardenShare";
import {
  gridToWorld,
  renderGarden,
  screenToGrid,
  type GardenEffect,
  type GardenWorldMode,
  type SelectedCell,
  type WorldPoint,
} from "../game/gardenRenderer";
import type { MyGardenState } from "@/lib/communityGarden/myGarden";
import {
  getMyGardenElement,
  getMyGardenPlant,
  isMyGardenElementType,
  isMyGardenPlantType,
  type MyGardenElementType,
  type MyGardenPlantType,
} from "../lib/myGardenCatalog";
import {
  getBuilderAppendResult,
  getBuilderDirectionalCell,
  MY_GARDEN_BUILDER_MAX_TILES,
  type MyGardenBuilderCell,
} from "../lib/myGardenBuilder";
import type { MyGardenMutation } from "../lib/myGardenMutation";
import {
  GARDEN_CONFIG,
  getChunkKey,
  getLoadedBounds,
} from "../lib/gardenConfig";
import {
  canEarnWateringCare,
  getPlantDefinition,
  getPlantVisual,
  isPlantable,
  PLANT_TYPES,
  type CommunityPlantType,
  type PlantRecord,
  type PlantType,
} from "../lib/roseLifecycle";
import {
  advanceWateringSpray,
  MAX_WATERING_TARGETS,
  selectDirectionalWateringTargets,
  WATERING_TARGETS_PER_SPRAY,
} from "../lib/wateringSelection";
import {
  clearGardenWeed,
  fetchGardenRegionManifest,
  fetchGardenRegionWindow,
  fetchGardenSnapshot,
  fetchGardenWateringStatus,
  GardenConnectionError,
  type GardenContribution,
  type GardenMapPlant,
  type GardenRegionManifest,
  type GardenRegionStage,
  type GardenWeed,
  isGardenConfigured,
  plantGardenPlant,
  waterGardenPlants,
} from "../lib/supabaseGarden";
import type { HeritageMoment } from "../lib/heritageNotifications";

const WATERING_RANGE_TILES = 5;
const WATERING_APPROACH_TILES = 2.125;
const WATERING_CHAIN_REACH_TILES = 6;
const WATERING_STATUS_REFRESH_MS = 10 * 60 * 1000;
const MAX_VISIBLE_GARDEN_WORMS = 5;

export type GardenConnection = "connecting" | "online" | "offline" | "error";
export type GardenAction =
  | "plant"
  | "water"
  | "weed"
  | "uproot"
  | "expand"
  | "lay-path"
  | "remove-path"
  | "place-element"
  | "remove-element"
  | "builder-place"
  | "builder-remove"
  | null;
export type GardenTool = PlantType | "path" | MyGardenElementType;

export type GardenUiState = {
  action: GardenAction;
  actionLabel: string;
  actionEnabled: boolean;
  connection: GardenConnection;
  message: string;
  mapX: number;
  mapY: number;
  mapWidthPercentage: number;
  mapHeightPercentage: number;
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  selectedPlantType: PlantType;
  selectedElementType: MyGardenElementType | null;
  selectedTool: GardenTool;
  pathMapPoints: Array<{ x: number; y: number }>;
  plantMapPoints: Array<{ x: number; y: number; plantType: PlantType }>;
  regionMapCells: Array<{
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    stage: GardenRegionStage;
    supportLevel: 0 | 1 | 2 | 3;
    isOpen: boolean;
    plantCount: number;
    occupancyPercent: number;
    heritagePlantCount: number;
  }>;
  currentRegionStage: GardenRegionStage | null;
  recentlyOpenedRegionKey: string | null;
  nextMapUpdateAt: number | null;
  mode: GardenWorldMode;
  builder: {
    active: boolean;
    canEnter: boolean;
    length: number;
    maxLength: number;
    mode: "place" | "remove" | null;
    careDelta: number;
    helperText: string;
  };
};

export type GardenCanvasHandle = {
  performAction: () => Promise<void>;
  suggestPlantingSpot: () => void;
  suggestWateringSpot: () => void;
  goToMapPosition: (mapX: number, mapY: number) => void;
  goToGridPosition: (gridX: number, gridY: number) => void;
  selectPlant: (plantType: PlantType) => void;
  selectPathTool: () => void;
  selectElement: (elementType: MyGardenElementType) => void;
  toggleBuilderMode: () => void;
  undoBuilderStep: () => void;
  clearBuilder: () => void;
  captureGarden: (scope: GardenShareScope) => Promise<File | null>;
  showCareReward: (value: number, dailyBonus?: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  restoreView: (
    mapX: number,
    mapY: number,
    zoom: number,
    selectedTool: string,
  ) => void;
};

type Runtime = {
  mary: WorldPoint;
  duck: WorldPoint;
  camera: WorldPoint;
  zoom: number;
  target: WorldPoint | null;
  selected: SelectedCell;
  selectedPlantType: PlantType;
  selectedElementType: MyGardenElementType;
  toolMode: "plant" | "path" | "element";
  plants: Map<string, PlantRecord>;
  mapPlants: Map<string, GardenMapPlant>;
  communityPlants: Map<string, PlantRecord>;
  weeds: Map<string, GardenWeed>;
  communityWeeds: Map<string, GardenWeed>;
  recentlyClearedWeeds: Map<string, number>;
  clearedWeedsLoaded: boolean;
  recentCommunityPlants: Map<string, RecentCommunityPlant>;
  recentCommunityPlantsLoaded: boolean;
  wateringCareReadyPlantIds: Set<string>;
  wateringCareStatusLoaded: boolean;
  wateringCareStatusBoundsKey: string;
  wateringCareStatusNextRefreshAt: number;
  snapshotNextRefreshAt: number;
  regionManifest: GardenRegionManifest | null;
  loadedRegionWindowKey: string;
  effects: GardenEffect[];
  path: WorldPoint[];
  lastFrame: number;
  loadedChunkKey: string;
  requestId: number;
  actionBusy: boolean;
  pendingAction: GardenAction;
  wateringPumpCount: number;
  wateringPumpSelectionKey: string;
  mapRevision: number;
  cachedMapRevision: number;
  cachedPlantMapPoints: Array<{
    x: number;
    y: number;
    plantType: PlantType;
  }>;
  lastUiPublishAt: number;
  hasMoved: boolean;
  spawnApplied: boolean;
  moving: boolean;
  reducedMotion: boolean;
  configured: boolean;
  connection: GardenConnection;
  statusMessage: string;
  mode: GardenWorldMode;
  personalGarden: MyGardenState | null;
  suggestedPlantingCell: SelectedCell;
  suggestedWateringCell: SelectedCell;
  gardenWorms: Map<string, GardenWormMarker>;
  builder: BuilderDraft | null;
};

type BuilderDraft = {
  mode: "place" | "remove";
  category: "plant" | "path" | "element";
  itemType: GardenTool | null;
  cells: MyGardenBuilderCell[];
  invalidCell: MyGardenBuilderCell | null;
  invalidUntil: number;
};

type RecentCommunityPlant = {
  plant: PlantRecord;
  acceptedAt: number;
};

type GardenWormMarker = {
  gridX: number;
  gridY: number;
  surfacedAt: number;
};

const RECENT_COMMUNITY_PLANTS_KEY = "basil-recent-community-plants-v1";
const RECENT_COMMUNITY_PLANT_TTL_MS = 30 * 60 * 1000;
const RECENT_CLEARED_WEEDS_KEY = "basil-recent-cleared-weeds-v1";

function ensureClearedWeedsLoaded(runtime: Runtime) {
  if (runtime.clearedWeedsLoaded) return;
  runtime.clearedWeedsLoaded = true;
  if (typeof window === "undefined") return;
  try {
    const entries = JSON.parse(
      window.localStorage.getItem(RECENT_CLEARED_WEEDS_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(entries)) return;
    const cutoff = Date.now() - RECENT_COMMUNITY_PLANT_TTL_MS;
    for (const entry of entries) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
      const clearedAt = Number(entry[1]);
      if (Number.isFinite(clearedAt) && clearedAt >= cutoff) {
        runtime.recentlyClearedWeeds.set(entry[0], clearedAt);
      }
    }
  } catch {
    // A stale weed can be retried safely because server actions are idempotent.
  }
}

function rememberClearedWeed(runtime: Runtime, weedId: string) {
  runtime.recentlyClearedWeeds.set(weedId, Date.now());
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_CLEARED_WEEDS_KEY,
      JSON.stringify(Array.from(runtime.recentlyClearedWeeds.entries()).slice(-48)),
    );
  } catch {
    // The current in-memory session still hides the cleared weed.
  }
}

type WorldSnapshot = {
  mary: WorldPoint;
  duck: WorldPoint;
  camera: WorldPoint;
  path: WorldPoint[];
  hasMoved: boolean;
};

type GardenCanvasProps = {
  onStateChange: (state: GardenUiState) => void;
  onCommunityContribution?: (contribution: GardenContribution) => void;
  mode: GardenWorldMode;
  accountAccessToken?: string | null;
  personalGarden: MyGardenState | null;
  tutorialDimmed?: boolean;
  onPersonalGardenMutation?: (
    mutation: MyGardenMutation,
  ) => Promise<MyGardenState>;
  onActionCompleted?: (mode: GardenWorldMode, action: GardenAction) => void;
  onActionFailed?: (
    mode: GardenWorldMode,
    action: GardenAction,
    error: unknown,
  ) => void;
  onGardenWormDiscovered?: () => void;
  onHeritageMoments?: (moments: HeritageMoment[]) => void;
};

function sameSelectedCell(left: SelectedCell, right: SelectedCell) {
  return Boolean(
    left &&
      right &&
      left.gridX === right.gridX &&
      left.gridY === right.gridY,
  );
}

function canQueueCommunityPlant(runtime: Runtime, selected: SelectedCell) {
  return Boolean(
    selected &&
      runtime.mode === "community" &&
      runtime.toolMode === "plant" &&
      isWithinRuntime(runtime, selected.gridX, selected.gridY) &&
      !getPlantAt(runtime, selected.gridX, selected.gridY) &&
      !getWeedAt(runtime, selected.gridX, selected.gridY),
  );
}

function surfaceGardenWorm(runtime: Runtime, originX: number, originY: number) {
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, -1],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ] as const;
  const openSpot = offsets.find(([dx, dy]) => {
    const gridX = originX + dx;
    const gridY = originY + dy;
    const key = plantKey(gridX, gridY);
    return (
      isWithinRuntime(runtime, gridX, gridY) &&
      !getPlantAt(runtime, gridX, gridY) &&
      !getWeedAt(runtime, gridX, gridY) &&
      !runtime.gardenWorms.has(key)
    );
  });
  if (!openSpot) return null;

  const gridX = originX + openSpot[0];
  const gridY = originY + openSpot[1];
  const marker = {
    gridX,
    gridY,
    surfacedAt: Date.now(),
  };
  runtime.gardenWorms.set(plantKey(gridX, gridY), marker);
  while (runtime.gardenWorms.size > MAX_VISIBLE_GARDEN_WORMS) {
    const oldestKey = runtime.gardenWorms.keys().next().value;
    if (typeof oldestKey !== "string") break;
    runtime.gardenWorms.delete(oldestKey);
  }
  return marker;
}

function plantKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

function persistRecentCommunityPlants(runtime: Runtime) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_COMMUNITY_PLANTS_KEY,
      JSON.stringify(Array.from(runtime.recentCommunityPlants.values())),
    );
  } catch {
    // In-memory reconciliation still protects the current visit.
  }
}

function ensureRecentCommunityPlantsLoaded(runtime: Runtime) {
  if (runtime.recentCommunityPlantsLoaded) return;
  runtime.recentCommunityPlantsLoaded = true;
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(RECENT_COMMUNITY_PLANTS_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(stored)) return;
    const oldestAcceptedAt = Date.now() - RECENT_COMMUNITY_PLANT_TTL_MS;
    for (const candidate of stored.slice(-24)) {
      if (!candidate || typeof candidate !== "object") continue;
      const recent = candidate as Record<string, unknown>;
      const plantValue = recent.plant;
      const acceptedAt = Number(recent.acceptedAt);
      if (
        !plantValue ||
        typeof plantValue !== "object" ||
        !Number.isFinite(acceptedAt) ||
        acceptedAt < oldestAcceptedAt
      ) {
        continue;
      }
      const plant = plantValue as Record<string, unknown>;
      const gridX = Number(plant.grid_x);
      const gridY = Number(plant.grid_y);
      const plantType = plant.plant_type as PlantType;
      if (
        typeof plant.id !== "string" ||
        !Number.isInteger(gridX) ||
        !Number.isInteger(gridY) ||
        !PLANT_TYPES.some((type) => type === plantType)
      ) {
        continue;
      }
      const normalized = {
        ...plant,
        grid_x: gridX,
        grid_y: gridY,
        plant_type: plantType,
      } as PlantRecord;
      runtime.recentCommunityPlants.set(plantKey(gridX, gridY), {
        plant: normalized,
        acceptedAt,
      });
    }
  } catch {
    // Ignore malformed or unavailable local storage.
  }
}

function rememberRecentCommunityPlant(runtime: Runtime, plant: PlantRecord) {
  ensureRecentCommunityPlantsLoaded(runtime);
  runtime.recentCommunityPlants.set(plantKey(plant.grid_x, plant.grid_y), {
    plant,
    acceptedAt: Date.now(),
  });
  persistRecentCommunityPlants(runtime);
}

function overlayRecentCommunityPlants(runtime: Runtime) {
  ensureRecentCommunityPlantsLoaded(runtime);
  const oldestAcceptedAt = Date.now() - RECENT_COMMUNITY_PLANT_TTL_MS;
  let changed = false;
  for (const [key, recent] of runtime.recentCommunityPlants) {
    if (recent.acceptedAt < oldestAcceptedAt) {
      runtime.recentCommunityPlants.delete(key);
      changed = true;
      continue;
    }
    runtime.communityPlants.set(key, recent.plant);
  }
  if (changed) persistRecentCommunityPlants(runtime);
}

function reconcileCommunitySnapshot(
  runtime: Runtime,
  plants: PlantRecord[],
  generatedAt: string,
) {
  ensureRecentCommunityPlantsLoaded(runtime);
  const snapshotGeneratedAt = Date.parse(generatedAt);
  const oldestAcceptedAt = Date.now() - RECENT_COMMUNITY_PLANT_TTL_MS;
  const snapshotPlants = new Map(
    plants.map((plant) => [plantKey(plant.grid_x, plant.grid_y), plant]),
  );
  let changed = false;

  for (const [key, recent] of runtime.recentCommunityPlants) {
    const snapshotIsNewEnough =
      Number.isFinite(snapshotGeneratedAt) &&
      snapshotGeneratedAt >= recent.acceptedAt;
    if (recent.acceptedAt < oldestAcceptedAt) {
      runtime.recentCommunityPlants.delete(key);
      changed = true;
      continue;
    }
    if (snapshotIsNewEnough) {
      runtime.recentCommunityPlants.delete(key);
      changed = true;
      continue;
    }
    snapshotPlants.set(key, recent.plant);
  }

  runtime.communityPlants = snapshotPlants;
  if (changed) persistRecentCommunityPlants(runtime);
}

function getCommunityBounds() {
  return {
    minX: GARDEN_CONFIG.worldMin,
    maxX: GARDEN_CONFIG.worldMax,
    minY: GARDEN_CONFIG.worldMin,
    maxY: GARDEN_CONFIG.worldMax,
  };
}

function getRuntimeBounds(runtime: Runtime) {
  if (runtime.mode === "community") {
    return runtime.regionManifest?.worldBounds ?? getCommunityBounds();
  }
  if (!runtime.personalGarden) {
    return getCommunityBounds();
  }
  return {
    minX: runtime.personalGarden.minX,
    maxX: runtime.personalGarden.minX + runtime.personalGarden.width - 1,
    minY: runtime.personalGarden.minY,
    maxY: runtime.personalGarden.minY + runtime.personalGarden.height - 1,
  };
}

function getRuntimeMapBounds(runtime: Runtime) {
  if (runtime.mode === "community") {
    return runtime.regionManifest?.mapBounds ?? getCommunityBounds();
  }
  if (!runtime.personalGarden) {
    return getCommunityBounds();
  }
  const expansion = runtime.personalGarden.nextExpansion;
  return expansion
    ? {
        minX: expansion.minX,
        maxX: expansion.minX + expansion.width - 1,
        minY: expansion.minY,
        maxY: expansion.minY + expansion.height - 1,
      }
    : getRuntimeBounds(runtime);
}

function isWithinRuntime(runtime: Runtime, gridX: number, gridY: number) {
  const bounds = getRuntimeBounds(runtime);
  const withinBounds =
    gridX >= bounds.minX &&
    gridX <= bounds.maxX &&
    gridY >= bounds.minY &&
    gridY <= bounds.maxY;
  if (!withinBounds || runtime.mode !== "community" || !runtime.regionManifest) {
    return withinBounds;
  }
  return runtime.regionManifest.regions.some(
    (region) =>
      region.isOpen &&
      gridX >= region.bounds.minX &&
      gridX <= region.bounds.maxX &&
      gridY >= region.bounds.minY &&
      gridY <= region.bounds.maxY,
  );
}

function getNearestOpenGrid(runtime: Runtime, gridX: number, gridY: number) {
  if (runtime.mode !== "community" || !runtime.regionManifest) {
    return { gridX, gridY };
  }
  if (isWithinRuntime(runtime, gridX, gridY)) return { gridX, gridY };
  const candidates = runtime.regionManifest.regions
    .filter((region) => region.isOpen)
    .map((region) => {
      const candidateX = Math.min(
        region.bounds.maxX,
        Math.max(region.bounds.minX, gridX),
      );
      const candidateY = Math.min(
        region.bounds.maxY,
        Math.max(region.bounds.minY, gridY),
      );
      return {
        gridX: candidateX,
        gridY: candidateY,
        distance: Math.hypot(candidateX - gridX, candidateY - gridY),
      };
    })
    .sort((left, right) => left.distance - right.distance);
  return candidates[0] ?? { gridX: 0, gridY: 0 };
}

function clampRuntimeCoordinate(
  runtime: Runtime,
  value: number,
  axis: "x" | "y",
) {
  const bounds = getRuntimeBounds(runtime);
  const minimum = (axis === "x" ? bounds.minX : bounds.minY) + 0.5;
  const maximum = (axis === "x" ? bounds.maxX : bounds.maxY) + 0.5;
  return Math.min(
    maximum * GARDEN_CONFIG.tileSize,
    Math.max(minimum * GARDEN_CONFIG.tileSize, value),
  );
}

function getRuntimeMapPercentage(
  runtime: Runtime,
  coordinate: number,
  axis: "x" | "y",
) {
  const bounds = getRuntimeMapBounds(runtime);
  const minimum = axis === "x" ? bounds.minX : bounds.minY;
  const maximum = axis === "x" ? bounds.maxX : bounds.maxY;
  return Math.min(
    100,
    Math.max(0, ((coordinate - minimum) / (maximum - minimum)) * 100),
  );
}

function getRuntimeGridFromMapPercentage(
  runtime: Runtime,
  percentage: number,
  axis: "x" | "y",
) {
  const bounds = getRuntimeMapBounds(runtime);
  const minimum = axis === "x" ? bounds.minX : bounds.minY;
  const maximum = axis === "x" ? bounds.maxX : bounds.maxY;
  return Math.round(
    minimum + (Math.min(100, Math.max(0, percentage)) / 100) * (maximum - minimum),
  );
}

function isPersonalBed(runtime: Runtime, gridX: number, gridY: number) {
  if (!runtime.personalGarden) return false;
  const bounds = getRuntimeBounds(runtime);
  return (
    gridX >= bounds.minX &&
    gridX <= bounds.maxX &&
    gridY >= bounds.minY &&
    gridY <= bounds.maxY
  );
}

function isNextExpansionCell(runtime: Runtime, gridX: number, gridY: number) {
  if (runtime.mode !== "personal" || !runtime.personalGarden?.nextExpansion) {
    return false;
  }
  const expansion = runtime.personalGarden.nextExpansion;
  const insideExpansion =
    gridX >= expansion.minX &&
    gridX < expansion.minX + expansion.width &&
    gridY >= expansion.minY &&
    gridY < expansion.minY + expansion.height;
  return insideExpansion && !isPersonalBed(runtime, gridX, gridY);
}

function toPersonalPlantRecord(
  plant: MyGardenState["plants"][number],
): PlantRecord {
  return {
    id: plant.id,
    grid_x: plant.gridX,
    grid_y: plant.gridY,
    plant_type: plant.plantType,
    planted_at: plant.plantedAt,
    last_watered_at: plant.plantedAt,
    created_at: plant.plantedAt,
    permanent: true,
  };
}

function applyPersonalGarden(runtime: Runtime, garden: MyGardenState) {
  runtime.personalGarden = garden;
  const plants = garden.plants.map(toPersonalPlantRecord);
  runtime.plants = new Map(
    plants.map((plant) => [plantKey(plant.grid_x, plant.grid_y), plant]),
  );
  runtime.mapPlants = new Map(
    plants.map((plant) => [plantKey(plant.grid_x, plant.grid_y), plant]),
  );
  runtime.mapRevision += 1;
}

function clampZoom(value: number) {
  return Math.min(
    GARDEN_CONFIG.maxCameraZoom,
    Math.max(GARDEN_CONFIG.minCameraZoom, value),
  );
}

function getPlantAt(runtime: Runtime, gridX: number, gridY: number) {
  return runtime.plants.get(plantKey(gridX, gridY));
}

function getWeedAt(runtime: Runtime, gridX: number, gridY: number) {
  return runtime.weeds.get(plantKey(gridX, gridY));
}

function getPendingActionLabel(action: NonNullable<GardenAction>) {
  switch (action) {
    case "plant":
      return "Planting...";
    case "water":
      return "Watering...";
    case "weed":
      return "Pulling weed...";
    case "uproot":
      return "Uprooting...";
    case "expand":
      return "Opening parcel...";
    case "lay-path":
    case "remove-path":
      return "Updating path...";
    case "place-element":
      return "Placing item...";
    case "remove-element":
      return "Picking up item...";
    case "builder-place":
      return "Building string...";
    case "builder-remove":
      return "Clearing string...";
  }

  return "Working...";
}

function hasPersonalPath(runtime: Runtime, gridX: number, gridY: number) {
  return Boolean(
    runtime.personalGarden?.paths.some(
      (path) => path.gridX === gridX && path.gridY === gridY,
    ),
  );
}

function getPersonalElement(runtime: Runtime, gridX: number, gridY: number) {
  return runtime.personalGarden?.elements.find((element) => {
    const definition = getMyGardenElement(element.elementType);
    return (
      gridX >= element.gridX &&
      gridX < element.gridX + definition.footprintWidth &&
      gridY >= element.gridY &&
      gridY < element.gridY + definition.footprintHeight
    );
  });
}

function getBuilderCareDelta(runtime: Runtime, builder: BuilderDraft) {
  if (builder.mode === "place") {
    if (builder.category === "path") return 0;
    if (builder.category === "plant") {
      return -(
        getMyGardenPlant(builder.itemType as MyGardenPlantType).careCost *
        builder.cells.length
      );
    }
    return -(
      getMyGardenElement(builder.itemType as MyGardenElementType).careCost *
      builder.cells.length
    );
  }
  if (builder.category === "plant") {
    return (runtime.personalGarden?.uprootReturn ?? 1) * builder.cells.length;
  }
  if (builder.category === "element") {
    return builder.cells.reduce((total, cell) => {
      const element = getPersonalElement(runtime, cell.gridX, cell.gridY);
      return total + (element?.careCost ?? 0);
    }, 0);
  }
  return 0;
}

function canUseBuilderCell(
  runtime: Runtime,
  builder: BuilderDraft,
  cell: MyGardenBuilderCell,
) {
  if (!isPersonalBed(runtime, cell.gridX, cell.gridY)) return false;
  const plant = getPlantAt(runtime, cell.gridX, cell.gridY);
  const path = hasPersonalPath(runtime, cell.gridX, cell.gridY);
  const element = getPersonalElement(runtime, cell.gridX, cell.gridY);
  if (builder.mode === "place") {
    return !plant && !path && !element;
  }
  if (builder.category === "plant") return Boolean(plant);
  if (builder.category === "path") return path;
  if (!element) return false;
  const definition = getMyGardenElement(element.elementType);
  return (
    definition.footprintWidth === 1 &&
    definition.footprintHeight === 1 &&
    element.gridX === cell.gridX &&
    element.gridY === cell.gridY
  );
}

function createBuilderDraft(runtime: Runtime): BuilderDraft | null {
  if (
    runtime.mode !== "personal" ||
    !runtime.personalGarden ||
    runtime.personalGarden.preview ||
    !runtime.selected
  ) {
    return null;
  }
  const cell = {
    gridX: runtime.selected.gridX,
    gridY: runtime.selected.gridY,
  };
  if (!isPersonalBed(runtime, cell.gridX, cell.gridY)) return null;
  const element = getPersonalElement(runtime, cell.gridX, cell.gridY);
  if (element) {
    const definition = getMyGardenElement(element.elementType);
    if (
      definition.footprintWidth !== 1 ||
      definition.footprintHeight !== 1 ||
      element.gridX !== cell.gridX ||
      element.gridY !== cell.gridY
    ) {
      return null;
    }
    return {
      mode: "remove",
      category: "element",
      itemType: null,
      cells: [cell],
      invalidCell: null,
      invalidUntil: 0,
    };
  }
  if (getPlantAt(runtime, cell.gridX, cell.gridY)) {
    return {
      mode: "remove",
      category: "plant",
      itemType: null,
      cells: [cell],
      invalidCell: null,
      invalidUntil: 0,
    };
  }
  if (hasPersonalPath(runtime, cell.gridX, cell.gridY)) {
    return {
      mode: "remove",
      category: "path",
      itemType: null,
      cells: [cell],
      invalidCell: null,
      invalidUntil: 0,
    };
  }
  if (runtime.toolMode === "element") {
    const definition = getMyGardenElement(runtime.selectedElementType);
    if (definition.footprintWidth !== 1 || definition.footprintHeight !== 1) {
      return null;
    }
    return {
      mode: "place",
      category: "element",
      itemType: runtime.selectedElementType,
      cells: [cell],
      invalidCell: null,
      invalidUntil: 0,
    };
  }
  return {
    mode: "place",
    category: runtime.toolMode === "path" ? "path" : "plant",
    itemType:
      runtime.toolMode === "path" ? "path" : runtime.selectedPlantType,
    cells: [cell],
    invalidCell: null,
    invalidUntil: 0,
  };
}

function getBuilderHelperText(runtime: Runtime) {
  const builder = runtime.builder;
  if (!builder) {
    return createBuilderDraft(runtime)
      ? "Select Builder to begin from this square."
      : "Choose an open square or a one-tile item first.";
  }
  if (builder.mode === "remove") {
    return "Tap a neighboring matching square. Tap the previous square to undo.";
  }
  return "Tap beside the newest square to extend the string.";
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function canPlacePersonalElement(
  runtime: Runtime,
  gridX: number,
  gridY: number,
  elementType: MyGardenElementType,
) {
  const garden = runtime.personalGarden;
  if (!garden) return false;
  const definition = getMyGardenElement(elementType);
  const candidate = {
    x: gridX,
    y: gridY,
    width: definition.footprintWidth,
    height: definition.footprintHeight,
  };
  const maxX = garden.minX + garden.width - 1;
  const maxY = garden.minY + garden.height - 1;
  if (
    gridX < garden.minX ||
    gridY < garden.minY ||
    gridX + candidate.width - 1 > maxX ||
    gridY + candidate.height - 1 > maxY
  ) {
    return false;
  }

  for (let y = gridY; y < gridY + candidate.height; y += 1) {
    for (let x = gridX; x < gridX + candidate.width; x += 1) {
      if (getPlantAt(runtime, x, y) || hasPersonalPath(runtime, x, y)) {
        return false;
      }
    }
  }

  return !garden.elements.some((element) => {
    const existing = getMyGardenElement(element.elementType);
    return rectanglesOverlap(candidate, {
      x: element.gridX,
      y: element.gridY,
      width: existing.footprintWidth,
      height: existing.footprintHeight,
    });
  });
}

function isValidTutorialPlantingCell(runtime: Runtime, gridX: number, gridY: number) {
  if (!isWithinRuntime(runtime, gridX, gridY)) return false;
  if (!isPlantable(getPlantAt(runtime, gridX, gridY))) return false;
  if (getWeedAt(runtime, gridX, gridY)) return false;
  if (runtime.mode === "personal") {
    if (hasPersonalPath(runtime, gridX, gridY)) return false;
    if (getPersonalElement(runtime, gridX, gridY)) return false;
  }
  return true;
}

function findSuggestedPlantingCell(runtime: Runtime): NonNullable<SelectedCell> | null {
  const originX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
  const originY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
  const bounds = getRuntimeBounds(runtime);
  const maxRadius = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
  );

  for (let radius = 2; radius <= maxRadius; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const gridX = originX + offsetX;
        const gridY = originY + offsetY;
        if (isValidTutorialPlantingCell(runtime, gridX, gridY)) {
          return { gridX, gridY };
        }
      }
    }
  }

  return null;
}

function findSuggestedWateringCell(runtime: Runtime): NonNullable<SelectedCell> | null {
  const bounds = getRuntimeBounds(runtime);
  const readyPlants = Array.from(runtime.plants.values())
    .filter((plant) => {
      const state = getPlantVisual(plant).state;
      return (
        state !== "expired" &&
        state !== "dead" &&
        canEarnWateringCareInRuntime(runtime, plant)
      );
    });
  const candidates = readyPlants
    .filter((plant) => plant.grid_y <= bounds.maxY - 4)
    .sort((first, second) => {
      const firstPoint = gridToWorld(first.grid_x, first.grid_y);
      const secondPoint = gridToWorld(second.grid_x, second.grid_y);
      return (
        Math.hypot(runtime.mary.x - firstPoint.x, runtime.mary.y - firstPoint.y) -
        Math.hypot(runtime.mary.x - secondPoint.x, runtime.mary.y - secondPoint.y)
      );
    });
  const visibleAboveCandidates = candidates.filter((plant) =>
    isTutorialWateringCellVisibleAboveMary(runtime, {
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      plantId: plant.id,
    }),
  );
  const plant = visibleAboveCandidates[0] ?? candidates[0];
  return plant
    ? { gridX: plant.grid_x, gridY: plant.grid_y, plantId: plant.id }
    : null;
}

function isTutorialWateringCellVisibleAboveMary(
  runtime: Runtime,
  cell: NonNullable<SelectedCell>,
) {
  const maryGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
  const maryGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
  const horizontalDistance = Math.abs(cell.gridX - maryGridX);
  const rowsAboveMary = maryGridY - cell.gridY;
  return horizontalDistance <= 7 && rowsAboveMary >= 2 && rowsAboveMary <= 10;
}

function isTutorialWateringInteractionActive(runtime: Runtime) {
  const suggested = runtime.suggestedWateringCell;
  if (!suggested) return false;
  return Boolean(
    runtime.target ||
      (runtime.selected &&
        runtime.selected.gridX === suggested.gridX &&
        runtime.selected.gridY === suggested.gridY),
  );
}

function refreshTutorialWateringTarget(runtime: Runtime) {
  if (!runtime.suggestedWateringCell) return;
  if (isTutorialWateringInteractionActive(runtime)) return;
  const previousTarget = runtime.suggestedWateringCell;
  const nextTarget = findSuggestedWateringCell(runtime);
  runtime.suggestedWateringCell = nextTarget;
  const targetChanged =
    previousTarget.gridX !== nextTarget?.gridX ||
    previousTarget.gridY !== nextTarget?.gridY;
  if (targetChanged) {
    runtime.selected = null;
    runtime.target = null;
  }
  if (nextTarget && targetChanged) {
    guideMaryTowardTutorialWateringTarget(runtime, nextTarget);
  }
  runtime.statusMessage = nextTarget
    ? "Tap the blue square around a flower with a water drop."
    : "The garden is finding a flower with a water drop.";
}

function bringTutorialTargetIntoView(
  runtime: Runtime,
  cell: NonNullable<SelectedCell>,
) {
  const point = gridToWorld(cell.gridX, cell.gridY);
  const distance = Math.hypot(runtime.mary.x - point.x, runtime.mary.y - point.y);
  if (distance <= GARDEN_CONFIG.tileSize * 5) return;
  const bounds = getRuntimeBounds(runtime);
  const approachCandidates = [
    {
      gridX: cell.gridX > 0 ? cell.gridX - 2 : cell.gridX + 2,
      gridY: cell.gridY > 0 ? cell.gridY - 1 : cell.gridY + 1,
    },
  ];
  const approachCell =
    approachCandidates.find(
      (candidate) =>
        candidate.gridX >= bounds.minX &&
        candidate.gridX <= bounds.maxX &&
        candidate.gridY >= bounds.minY &&
        candidate.gridY <= bounds.maxY &&
        isPlantable(getPlantAt(runtime, candidate.gridX, candidate.gridY)) &&
        !getWeedAt(runtime, candidate.gridX, candidate.gridY),
    ) ?? approachCandidates[0];
  const approach = gridToWorld(
    Math.max(bounds.minX, Math.min(bounds.maxX, approachCell.gridX)),
    Math.max(bounds.minY, Math.min(bounds.maxY, approachCell.gridY)),
  );
  runtime.mary = { ...approach };
  runtime.camera = { ...approach };
  runtime.duck = {
    x: clampRuntimeCoordinate(runtime, approach.x - 18, "x"),
    y: clampRuntimeCoordinate(runtime, approach.y + 10, "y"),
  };
  runtime.path = [{ ...approach }];
  runtime.target = null;
  runtime.loadedChunkKey = "";
}

function guideMaryTowardTutorialWateringTarget(
  runtime: Runtime,
  cell: NonNullable<SelectedCell>,
) {
  if (isTutorialWateringCellVisibleAboveMary(runtime, cell)) return;

  const bounds = getRuntimeBounds(runtime);
  const approachCandidates = [4, 5, 6, 7].flatMap((rowDistance) =>
    [0, 1, -1, 2, -2, 3, -3].map((columnOffset) => ({
      gridX: cell.gridX + columnOffset,
      gridY: cell.gridY + rowDistance,
    })),
  );
  const approachCell =
    approachCandidates.find(
      (candidate) =>
        candidate.gridX >= bounds.minX &&
        candidate.gridX <= bounds.maxX &&
        candidate.gridY >= bounds.minY &&
        candidate.gridY <= bounds.maxY &&
        isPlantable(getPlantAt(runtime, candidate.gridX, candidate.gridY)) &&
        !getWeedAt(runtime, candidate.gridX, candidate.gridY),
    ) ?? approachCandidates[0];
  const approach = gridToWorld(
    Math.max(bounds.minX, Math.min(bounds.maxX, approachCell.gridX)),
    Math.max(bounds.minY, Math.min(bounds.maxY, approachCell.gridY)),
  );

  // Tutorial guidance must use the same frame-by-frame movement as a normal
  // garden tap. Never replace Mary's position, camera, or companion position.
  runtime.target = approach;
}

function getDistanceToCell(runtime: Runtime, selected: NonNullable<SelectedCell>) {
  const point = gridToWorld(selected.gridX, selected.gridY);
  return Math.hypot(runtime.mary.x - point.x, runtime.mary.y - point.y);
}

function getWateringCluster(
  runtime: Runtime,
  selected: NonNullable<SelectedCell>,
) {
  const anchorPlant = getPlantAt(runtime, selected.gridX, selected.gridY);
  if (!anchorPlant) return [];
  const maryGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
  const maryGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
  const livePlants: PlantRecord[] = [];
  for (
    let gridY = selected.gridY - WATERING_CHAIN_REACH_TILES;
    gridY <= selected.gridY + WATERING_CHAIN_REACH_TILES;
    gridY += 1
  ) {
    for (
      let gridX = selected.gridX - WATERING_CHAIN_REACH_TILES;
      gridX <= selected.gridX + WATERING_CHAIN_REACH_TILES;
      gridX += 1
    ) {
      const plant = getPlantAt(runtime, gridX, gridY);
      if (!plant) continue;
      const visual = getPlantVisual(plant);
      if (visual.state !== "expired" && visual.state !== "dead") {
        livePlants.push(plant);
      }
    }
  }
  const plantsById = new Map(livePlants.map((plant) => [plant.id, plant]));
  return selectDirectionalWateringTargets({
    clickedGridX: selected.gridX,
    clickedGridY: selected.gridY,
    maryGridX,
    maryGridY,
    anchorCandidateId: anchorPlant.id,
    candidates: livePlants.map((plant) => ({
      id: plant.id,
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      careReady: canEarnWateringCareInRuntime(runtime, plant),
    })),
    maxTargets: MAX_WATERING_TARGETS,
    maxReach: WATERING_CHAIN_REACH_TILES,
  })
    .map((candidate) => plantsById.get(candidate.id))
    .filter((plant): plant is PlantRecord => Boolean(plant));
}

function getWateringSelection(
  runtime: Runtime,
  selected: NonNullable<SelectedCell>,
) {
  return getWateringCluster(runtime, selected);
}

function canEarnWateringCareInRuntime(runtime: Runtime, plant: PlantRecord) {
  if (
    runtime.mode === "community" &&
    runtime.configured &&
    runtime.wateringCareStatusLoaded
  ) {
    return runtime.wateringCareReadyPlantIds.has(plant.id);
  }
  return canEarnWateringCare(plant);
}

function getActionState(runtime: Runtime) {
  if (runtime.builder) {
    const builder = runtime.builder;
    const count = builder.cells.length;
    const careDelta = getBuilderCareDelta(runtime, builder);
    const care = runtime.personalGarden?.careBalance ?? 0;
    const name =
      builder.category === "path"
        ? count === 1
          ? "path"
          : "paths"
        : builder.category === "plant"
          ? builder.mode === "place"
            ? getMyGardenPlant(builder.itemType as MyGardenPlantType).name
            : count === 1
              ? "plant"
              : "plants"
          : builder.mode === "place"
            ? getMyGardenElement(builder.itemType as MyGardenElementType).name
            : count === 1
              ? "item"
              : "items";
    const verb =
      builder.mode === "place"
        ? builder.category === "path"
          ? "Lay"
          : builder.category === "plant"
            ? "Plant"
            : "Place"
        : builder.category === "plant"
          ? "Uproot"
          : builder.category === "path"
            ? "Remove"
            : "Pick up";
    const careCopy =
      careDelta < 0
        ? ` · ${Math.abs(careDelta)} Care`
        : careDelta > 0
          ? ` · +${careDelta} Care`
          : " · Free";
    return {
      action: (builder.mode === "place"
        ? "builder-place"
        : "builder-remove") as GardenAction,
      label: `${verb} ${count} ${name}${careCopy}`,
      enabled:
        !runtime.actionBusy &&
        count >= 1 &&
        count <= MY_GARDEN_BUILDER_MAX_TILES &&
        care + careDelta >= 0,
    };
  }

  if (runtime.actionBusy && runtime.pendingAction) {
    return {
      action: runtime.pendingAction,
      label: getPendingActionLabel(runtime.pendingAction),
      enabled: false,
    };
  }

  if (!runtime.selected) {
    return { action: null as GardenAction, label: "Choose a spot", enabled: false };
  }

  const plant = getPlantAt(runtime, runtime.selected.gridX, runtime.selected.gridY);
  const weed = getWeedAt(runtime, runtime.selected.gridX, runtime.selected.gridY);
  const visual = plant ? getPlantVisual(plant) : null;
  const nearby = getDistanceToCell(runtime, runtime.selected) <= GARDEN_CONFIG.tileSize * 1.8;

  if (runtime.mode === "personal") {
    if (
      isNextExpansionCell(
        runtime,
        runtime.selected.gridX,
        runtime.selected.gridY,
      )
    ) {
      const expansion = runtime.personalGarden?.nextExpansion;
      const cost = expansion?.careCost ?? 0;
      const preview = Boolean(runtime.personalGarden?.preview);
      const care = runtime.personalGarden?.careBalance ?? 0;
      return {
        action: "expand" as GardenAction,
        label: preview
          ? "Unlock land · Upgrade"
          : care >= cost
            ? `Unlock parcel · ${cost} Care`
            : `${cost - care} more Care to unlock`,
        enabled: !runtime.actionBusy && (preview || care >= cost),
      };
    }
    if (!isPersonalBed(runtime, runtime.selected.gridX, runtime.selected.gridY)) {
      return {
        action: null as GardenAction,
        label: "Walk around My Garden",
        enabled: false,
      };
    }
    const element = getPersonalElement(
      runtime,
      runtime.selected.gridX,
      runtime.selected.gridY,
    );
    if (element) {
      const definition = getMyGardenElement(element.elementType);
      return {
        action: "remove-element" as GardenAction,
        label: `Pick up ${definition.name} · +${element.careCost} Care`,
        enabled: nearby && !runtime.actionBusy,
      };
    }
    if (plant) {
      return {
        action: "uproot" as GardenAction,
        label: `Uproot ${getPlantDefinition(plant.plant_type).name} · +${runtime.personalGarden?.uprootReturn ?? 1} Care`,
        enabled: nearby && !runtime.actionBusy,
      };
    }
    const hasPath = hasPersonalPath(
      runtime,
      runtime.selected.gridX,
      runtime.selected.gridY,
    );
    if (hasPath) {
      return {
        action: "remove-path" as GardenAction,
        label: "Remove path · Free",
        enabled: nearby && !runtime.actionBusy,
      };
    }
    if (runtime.toolMode === "path") {
      return {
        action: "lay-path" as GardenAction,
        label: "Lay path · Free",
        enabled: nearby && !runtime.actionBusy,
      };
    }
    if (runtime.toolMode === "element") {
      const definition = getMyGardenElement(runtime.selectedElementType);
      if (
        !canPlacePersonalElement(
          runtime,
          runtime.selected.gridX,
          runtime.selected.gridY,
          runtime.selectedElementType,
        )
      ) {
        return {
          action: null as GardenAction,
          label:
            definition.footprintWidth > 1 ||
            definition.footprintHeight > 1
              ? `Choose ${definition.footprintWidth}×${definition.footprintHeight} open tiles`
              : "Choose an open tile",
          enabled: false,
        };
      }
      const preview = Boolean(runtime.personalGarden?.preview);
      const care = runtime.personalGarden?.careBalance ?? 0;
      return {
        action: "place-element" as GardenAction,
        label: preview
          ? `Place ${definition.name} · Upgrade`
          : `Place ${definition.name} · ${definition.careCost} Care`,
        enabled:
          nearby &&
          !runtime.actionBusy &&
          (preview || care >= definition.careCost),
      };
    }
    const cost = runtime.personalGarden?.plantCost ?? 2;
    const preview = runtime.personalGarden?.preview;
    if (
      preview &&
      preview.plantingsUsed >= preview.plantingLimit
    ) {
      return {
        action: "plant" as GardenAction,
        label: "Keep growing · Upgrade",
        enabled: nearby && !runtime.actionBusy,
      };
    }
    return {
      action: "plant" as GardenAction,
      label: `Plant ${getPlantDefinition(runtime.selectedPlantType).name} · ${cost} Care`,
      enabled:
        nearby &&
        !runtime.actionBusy &&
        (runtime.personalGarden?.careBalance ?? 0) >= cost,
    };
  }

  if (weed) {
    return {
      action: "weed" as GardenAction,
      label: "Pull weed · Care",
      enabled: nearby && !runtime.actionBusy,
    };
  }

  const wateringTargets = getWateringSelection(runtime, runtime.selected);
  if (plant && visual && visual.state !== "expired") {
    if (visual?.state === "dead") {
      return { action: null as GardenAction, label: "This spot is resting", enabled: false };
    }
    const inWateringRange =
      getDistanceToCell(runtime, runtime.selected) <=
      GARDEN_CONFIG.tileSize * WATERING_RANGE_TILES;
    if (wateringTargets.length === 0) {
      return {
        action: null as GardenAction,
        label: "Choose a flower with a water drop",
        enabled: false,
      };
    }
    return {
      action: "water" as GardenAction,
      label:
        wateringTargets.length > WATERING_TARGETS_PER_SPRAY
          ? runtime.wateringPumpCount > 0
            ? "Water again"
            : "Water · double tap"
          : "Water",
      enabled: inWateringRange && !runtime.actionBusy,
    };
  }

  return {
    action: "plant" as GardenAction,
    label: `Plant ${getPlantDefinition(runtime.selectedPlantType).name}`,
    enabled: nearby && !runtime.actionBusy,
  };
}

function getAdjacentTarget(runtime: Runtime, gridX: number, gridY: number) {
  const center = gridToWorld(gridX, gridY);
  const offset = GARDEN_CONFIG.tileSize;
  const bounds = getRuntimeBounds(runtime);
  const canStandLeft = gridX > bounds.minX;
  const canStandRight = gridX < bounds.maxX;
  const approachFromLeft = runtime.mary.x <= center.x;

  const standOnLeft = canStandLeft && (!canStandRight || approachFromLeft);
  center.x += standOnLeft ? -offset : offset;

  return {
    x: clampRuntimeCoordinate(runtime, center.x, "x"),
    y: clampRuntimeCoordinate(runtime, center.y, "y"),
  };
}

function getWateringApproachTarget(
  runtime: Runtime,
  gridX: number,
  gridY: number,
) {
  const center = gridToWorld(gridX, gridY);
  const dx = runtime.mary.x - center.x;
  const dy = runtime.mary.y - center.y;
  const distance = Math.hypot(dx, dy);
  const standOff = GARDEN_CONFIG.tileSize * WATERING_APPROACH_TILES;
  if (distance <= standOff) return null;
  const scale = standOff / distance;
  return {
    x: clampRuntimeCoordinate(runtime, center.x + dx * scale, "x"),
    y: clampRuntimeCoordinate(runtime, center.y + dy * scale, "y"),
  };
}

function getLockedParcelApproach(runtime: Runtime, gridX: number, gridY: number) {
  const bounds = getRuntimeBounds(runtime);
  return gridToWorld(
    Math.min(bounds.maxX, Math.max(bounds.minX, gridX)),
    Math.min(bounds.maxY, Math.max(bounds.minY, gridY)),
  );
}

function makeLocalPlant(
  gridX: number,
  gridY: number,
  plantType: PlantType,
): PlantRecord {
  const now = new Date().toISOString();
  return {
    id: `local-${plantType}-${gridX}-${gridY}-${Date.now()}`,
    grid_x: gridX,
    grid_y: gridY,
    plant_type: plantType,
    planted_at: now,
    last_watered_at: now,
    created_at: now,
  };
}

function seedLocalPlants() {
  const now = Date.now();
  const create = (
    id: string,
    gridX: number,
    gridY: number,
    ageHours: number,
    plantType: PlantType,
  ): PlantRecord => ({
    id,
    grid_x: gridX,
    grid_y: gridY,
    plant_type: plantType,
    planted_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
    last_watered_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - ageHours * 60 * 60 * 1000).toISOString(),
  });

  return [
    create("local-welcome-1", 2, -1, 32, "rose"),
    create("local-welcome-2", -2, 1, 18, "sunflower"),
    create("local-welcome-3", 3, 2, 52, "lavender"),
  ];
}

const GARDEN_SHARE_RENDER_WIDTH = 1600;
const GARDEN_SHARE_RENDER_HEIGHT = 1400;
const GARDEN_SHARE_MIN_WIDTH = 320;
const GARDEN_SHARE_MIN_HEIGHT = 240;
const GARDEN_SHARE_MAX_DIMENSION = 2400;

function getVisibleCanvasBounds(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX >= minX && maxY >= minY
    ? { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : null;
}

function renderPersonalGardenShare(
  runtime: Runtime,
  sourceCanvas: HTMLCanvasElement,
  scope: GardenShareScope,
) {
  const garden = runtime.personalGarden;
  if (runtime.mode !== "personal" || !garden || runtime.builder) return null;

  const source = document.createElement("canvas");
  source.width =
    scope === "whole"
      ? GARDEN_SHARE_RENDER_WIDTH
      : Math.max(GARDEN_CONFIG.minLogicalWidth, sourceCanvas.width);
  source.height =
    scope === "whole"
      ? GARDEN_SHARE_RENDER_HEIGHT
      : Math.max(240, sourceCanvas.height);
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return null;

  let camera = { ...runtime.camera };
  let zoom = runtime.zoom;
  if (scope === "whole") {
    const horizontalZoom =
      (source.width - 320) / (garden.width * GARDEN_CONFIG.tileSize);
    const verticalZoom =
      (source.height - 700) /
      (garden.height * GARDEN_CONFIG.tileScreenHeight);
    zoom = Math.max(0.28, Math.min(5, horizontalZoom, verticalZoom));
    const centerX =
      (garden.minX + garden.width / 2) * GARDEN_CONFIG.tileSize;
    const centerY =
      (garden.minY + garden.height / 2) * GARDEN_CONFIG.tileSize;
    const yScale =
      GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
    camera = {
      x: centerX,
      y:
        centerY +
        ((GARDEN_CONFIG.maryScreenYRatio - 0.5) * source.height) /
          (yScale * zoom),
    };
  }

  const hiddenCharacter = {
    x: camera.x + 1_000_000,
    y: camera.y + 1_000_000,
  };
  renderGarden(sourceContext, {
    viewport: { width: source.width, height: source.height },
    camera,
    zoom,
    mary: hiddenCharacter,
    duck: hiddenCharacter,
    plants: Array.from(runtime.plants.values()),
    weeds: [],
    selected: null,
    wateringTargets: [],
    suggestedPlantingCell: null,
    suggestedWateringCell: null,
    gardenWorms: [],
    tutorialDimmed: false,
    effects: [],
    moving: false,
    now: Date.now(),
    mode: "personal",
    shareOnly: true,
    personalGarden: {
      minX: garden.minX,
      minY: garden.minY,
      width: garden.width,
      height: garden.height,
      maxWidth: garden.width,
      maxHeight: garden.height,
      elements: garden.elements,
      paths: garden.paths,
      nextExpansion: null,
    },
  });

  const bounds = getVisibleCanvasBounds(source);
  if (!bounds) return null;
  const padding = Math.max(8, Math.round(8 * zoom));
  const cropX = Math.max(0, bounds.minX - padding);
  const cropY = Math.max(0, bounds.minY - padding);
  const cropWidth = Math.min(source.width - cropX, bounds.width + padding * 2);
  const cropHeight = Math.min(source.height - cropY, bounds.height + padding * 2);
  const minimumScale = Math.max(
    1,
    GARDEN_SHARE_MIN_WIDTH / cropWidth,
    GARDEN_SHARE_MIN_HEIGHT / cropHeight,
  );
  const maximumScale = Math.min(
    GARDEN_SHARE_MAX_DIMENSION / cropWidth,
    GARDEN_SHARE_MAX_DIMENSION / cropHeight,
  );
  const scale = Math.min(minimumScale, maximumScale);

  const card = document.createElement("canvas");
  card.width = Math.round(cropWidth * scale);
  card.height = Math.round(cropHeight * scale);
  const context = card.getContext("2d");
  if (!context) return null;

  context.imageSmoothingEnabled = false;
  context.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    card.width,
    card.height,
  );

  return new Promise<File | null>((resolve) => {
    card.toBlob(
      (blob) => {
        resolve(
          blob
            ? new File([blob], "basil-my-garden.png", { type: "image/png" })
            : null,
        );
      },
      "image/png",
    );
  });
}

export const GardenCanvas = forwardRef<GardenCanvasHandle, GardenCanvasProps>(
  function GardenCanvas(
    {
      onStateChange,
      onCommunityContribution,
      mode,
      accountAccessToken = null,
      personalGarden,
      tutorialDimmed = false,
      onPersonalGardenMutation,
      onActionCompleted,
      onActionFailed,
      onGardenWormDiscovered,
      onHeritageMoments,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onStateChangeRef = useRef(onStateChange);
    const onCommunityContributionRef = useRef(onCommunityContribution);
    const onPersonalGardenMutationRef = useRef(onPersonalGardenMutation);
    const onActionCompletedRef = useRef(onActionCompleted);
    const onActionFailedRef = useRef(onActionFailed);
    const onGardenWormDiscoveredRef = useRef(onGardenWormDiscovered);
    const onHeritageMomentsRef = useRef(onHeritageMoments);
    const accountAccessTokenRef = useRef(accountAccessToken);
    const tutorialDimmedRef = useRef(tutorialDimmed);
    const personalGardenRef = useRef(personalGarden);
    const worldSnapshotsRef = useRef<
      Partial<Record<GardenWorldMode, WorldSnapshot>>
    >({});
    const loadPlantsRef = useRef<() => Promise<void>>(async () => undefined);
    const performActionRef = useRef<() => Promise<void>>(async () => undefined);
    const queuedPlantingRef = useRef<SelectedCell>(null);
    const lastUiKeyRef = useRef("");
    const pointerGestureRef = useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      dragged: boolean;
    } | null>(null);
    const start = gridToWorld(0, 0);
    const runtimeRef = useRef<Runtime>({
      mary: { ...start },
      duck: { x: start.x - 18, y: start.y + 10 },
      camera: { ...start },
      zoom: GARDEN_CONFIG.defaultCameraZoom,
      target: null,
      selected: null,
      selectedPlantType: "rose",
      selectedElementType: "stone_paver",
      toolMode: "plant",
      plants: new Map(),
      mapPlants: new Map(),
      communityPlants: new Map(),
      weeds: new Map(),
      communityWeeds: new Map(),
      recentlyClearedWeeds: new Map(),
      clearedWeedsLoaded: false,
      recentCommunityPlants: new Map(),
      recentCommunityPlantsLoaded: false,
      wateringCareReadyPlantIds: new Set(),
      wateringCareStatusLoaded: false,
      wateringCareStatusBoundsKey: "",
      wateringCareStatusNextRefreshAt: 0,
      snapshotNextRefreshAt: 0,
      regionManifest: null,
      loadedRegionWindowKey: "",
      effects: [],
      path: [{ ...start }],
      lastFrame: 0,
      loadedChunkKey: "",
      requestId: 0,
      actionBusy: false,
      pendingAction: null,
      wateringPumpCount: 0,
      wateringPumpSelectionKey: "",
      mapRevision: 0,
      cachedMapRevision: -1,
      cachedPlantMapPoints: [],
      lastUiPublishAt: 0,
      hasMoved: false,
      spawnApplied: false,
      moving: false,
      reducedMotion: false,
      configured: isGardenConfigured(),
      connection: isGardenConfigured() ? "connecting" : "offline",
      statusMessage: isGardenConfigured()
        ? "Connecting to the shared garden..."
        : "Preview mode: shared planting is not connected.",
      mode,
      personalGarden,
      suggestedPlantingCell: null,
      suggestedWateringCell: null,
      gardenWorms: new Map(),
      builder: null,
    });

    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    useEffect(() => {
      onCommunityContributionRef.current = onCommunityContribution;
    }, [onCommunityContribution]);

    useEffect(() => {
      accountAccessTokenRef.current = accountAccessToken;
    }, [accountAccessToken]);

    useEffect(() => {
      onPersonalGardenMutationRef.current = onPersonalGardenMutation;
    }, [onPersonalGardenMutation]);

    useEffect(() => {
      onActionCompletedRef.current = onActionCompleted;
    }, [onActionCompleted]);

    useEffect(() => {
      onActionFailedRef.current = onActionFailed;
    }, [onActionFailed]);

    useEffect(() => {
      onGardenWormDiscoveredRef.current = onGardenWormDiscovered;
    }, [onGardenWormDiscovered]);

    useEffect(() => {
      onHeritageMomentsRef.current = onHeritageMoments;
    }, [onHeritageMoments]);

    useEffect(() => {
      const runtime = runtimeRef.current;
      const hadTutorialTarget = Boolean(
        runtime.suggestedPlantingCell || runtime.suggestedWateringCell,
      );
      tutorialDimmedRef.current = tutorialDimmed;
      if (!tutorialDimmed && hadTutorialTarget) {
        runtime.suggestedPlantingCell = null;
        runtime.suggestedWateringCell = null;
        runtime.selected = null;
        runtime.target = null;
        runtime.wateringPumpCount = 0;
        runtime.wateringPumpSelectionKey = "";
      }
    }, [tutorialDimmed]);

    useEffect(() => {
      personalGardenRef.current = personalGarden;
    }, [personalGarden]);

    const publishUi = useCallback(() => {
      const runtime = runtimeRef.current;
      runtime.lastUiPublishAt = Date.now();
      const action = getActionState(runtime);
      const selectedElement = runtime.selected
        ? getPersonalElement(
            runtime,
            runtime.selected.gridX,
            runtime.selected.gridY,
          )
        : undefined;
      const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      if (runtime.cachedMapRevision !== runtime.mapRevision) {
        runtime.cachedPlantMapPoints = Array.from(runtime.mapPlants.values()).map(
          (plant) => ({
            x: getRuntimeMapPercentage(runtime, plant.grid_x, "x"),
            y: getRuntimeMapPercentage(runtime, plant.grid_y, "y"),
            plantType: plant.plant_type,
          }),
        );
        runtime.cachedMapRevision = runtime.mapRevision;
      }
      const plantMapPoints = runtime.cachedPlantMapPoints;
      const pathMapPoints = (runtime.personalGarden?.paths ?? []).map((path) => ({
        x: getRuntimeMapPercentage(runtime, path.gridX, "x"),
        y: getRuntimeMapPercentage(runtime, path.gridY, "y"),
      }));
      const mapBounds = getRuntimeMapBounds(runtime);
      const mapWidth = Math.max(1, mapBounds.maxX - mapBounds.minX + 1);
      const mapHeight = Math.max(1, mapBounds.maxY - mapBounds.minY + 1);
      const regionMapCells =
        runtime.mode === "community"
          ? (runtime.regionManifest?.regions ?? []).map((region) => ({
              key: region.regionKey,
              x: ((region.bounds.minX - mapBounds.minX) / mapWidth) * 100,
              y: ((region.bounds.minY - mapBounds.minY) / mapHeight) * 100,
              width:
                ((region.bounds.maxX - region.bounds.minX + 1) / mapWidth) * 100,
              height:
                ((region.bounds.maxY - region.bounds.minY + 1) / mapHeight) * 100,
              stage: region.publicStage,
              supportLevel: region.supportLevel,
              isOpen: region.isOpen,
              plantCount: region.plantCount,
              occupancyPercent: region.occupancyPercent,
              heritagePlantCount: region.heritagePlantCount,
            }))
          : [];
      const currentRegion = runtime.regionManifest?.regions.find(
        (region) =>
          gridX >= region.bounds.minX &&
          gridX <= region.bounds.maxX &&
          gridY >= region.bounds.minY &&
          gridY <= region.bounds.maxY,
      );
      const recentlyOpenedRegion = runtime.regionManifest?.regions.find(
        (region) => region.newlyOpened,
      );
      const state: GardenUiState = {
        action: action.action,
        actionLabel: action.label,
        actionEnabled: action.enabled,
        connection: runtime.connection,
        message: runtime.statusMessage,
        mapX:
          Math.round(getRuntimeMapPercentage(runtime, gridX, "x") * 10) / 10,
        mapY:
          Math.round(getRuntimeMapPercentage(runtime, gridY, "y") * 10) / 10,
        mapWidthPercentage:
          runtime.mode === "personal" && runtime.personalGarden
            ? (runtime.personalGarden.width / runtime.personalGarden.maxWidth) * 100
            : runtime.regionManifest
              ? ((runtime.regionManifest.worldBounds.maxX -
                  runtime.regionManifest.worldBounds.minX +
                  1) /
                  mapWidth) *
                100
              : 100,
        mapHeightPercentage:
          runtime.mode === "personal" && runtime.personalGarden
            ? (runtime.personalGarden.height / runtime.personalGarden.maxHeight) * 100
            : runtime.regionManifest
              ? ((runtime.regionManifest.worldBounds.maxY -
                  runtime.regionManifest.worldBounds.minY +
                  1) /
                  mapHeight) *
                100
              : 100,
        zoom: runtime.zoom,
        canZoomIn: runtime.zoom < GARDEN_CONFIG.maxCameraZoom,
        canZoomOut: runtime.zoom > GARDEN_CONFIG.minCameraZoom,
        selectedPlantType: runtime.selectedPlantType,
        selectedElementType:
          selectedElement?.elementType ??
          (runtime.toolMode === "element" ? runtime.selectedElementType : null),
        selectedTool:
          runtime.toolMode === "path"
            ? "path"
            : runtime.toolMode === "element"
              ? runtime.selectedElementType
              : runtime.selectedPlantType,
        pathMapPoints,
        plantMapPoints,
        regionMapCells,
        currentRegionStage: currentRegion?.publicStage ?? null,
        recentlyOpenedRegionKey: recentlyOpenedRegion?.regionKey ?? null,
        nextMapUpdateAt:
          runtime.mode === "community" && runtime.snapshotNextRefreshAt > 0
            ? runtime.snapshotNextRefreshAt
            : null,
        mode: runtime.mode,
        builder: {
          active: Boolean(runtime.builder),
          canEnter:
            !runtime.actionBusy &&
            Boolean(createBuilderDraft(runtime)),
          length: runtime.builder?.cells.length ?? 0,
          maxLength: MY_GARDEN_BUILDER_MAX_TILES,
          mode: runtime.builder?.mode ?? null,
          careDelta: runtime.builder
            ? getBuilderCareDelta(runtime, runtime.builder)
            : 0,
          helperText: getBuilderHelperText(runtime),
        },
      };
      const key = JSON.stringify({
        ...state,
        plantMapPoints: runtime.mapRevision,
      });
      if (key === lastUiKeyRef.current) return;
      lastUiKeyRef.current = key;
      onStateChangeRef.current(state);
    }, []);

    useEffect(() => {
      const runtime = runtimeRef.current;
      const previousMode = runtime.mode;
      if (previousMode !== mode) {
        runtime.requestId += 1;
        worldSnapshotsRef.current[previousMode] = {
          mary: { ...runtime.mary },
          duck: { ...runtime.duck },
          camera: { ...runtime.camera },
          path: runtime.path.map((point) => ({ ...point })),
          hasMoved: runtime.hasMoved,
        };
      }
      runtime.mode = mode;
      runtime.selected = null;
      runtime.target = null;
      runtime.loadedChunkKey = "";
      runtime.effects = [];
      runtime.suggestedPlantingCell = null;
      runtime.suggestedWateringCell = null;
      runtime.builder = null;
      if (mode === "community") {
        runtime.toolMode = "plant";
        if (!PLANT_TYPES.some((type) => type === runtime.selectedPlantType)) {
          runtime.selectedPlantType = "rose";
        }
      }

      const currentPersonalGarden = personalGardenRef.current;
      if (mode === "personal" && currentPersonalGarden) {
        applyPersonalGarden(runtime, currentPersonalGarden);
        runtime.weeds = new Map();
        const saved = worldSnapshotsRef.current.personal;
        if (saved) {
          runtime.mary = {
            x: clampRuntimeCoordinate(runtime, saved.mary.x, "x"),
            y: clampRuntimeCoordinate(runtime, saved.mary.y, "y"),
          };
          runtime.camera = { ...saved.camera };
          runtime.duck = { ...saved.duck };
          runtime.path = saved.path.map((point) => ({ ...point }));
          runtime.hasMoved = saved.hasMoved;
        } else {
          const destination = gridToWorld(
            currentPersonalGarden.minX +
              Math.floor((currentPersonalGarden.width - 1) / 2),
            currentPersonalGarden.minY +
              Math.floor((currentPersonalGarden.height - 1) / 2),
          );
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.duck = { x: destination.x - 18, y: destination.y + 10 };
          runtime.path = [{ ...destination }];
        }
        runtime.connection = "online";
        runtime.statusMessage =
          "Welcome home. Plant anywhere inside the fence or explore your land.";
      } else {
        runtime.personalGarden = null;
        runtime.plants = new Map();
        runtime.weeds = new Map();
        runtime.mapPlants = new Map();
        runtime.mapRevision += 1;
        const saved = worldSnapshotsRef.current.community;
        if (saved) {
          runtime.mary = { ...saved.mary };
          runtime.camera = { ...saved.camera };
          runtime.duck = { ...saved.duck };
          runtime.path = saved.path.map((point) => ({ ...point }));
          runtime.hasMoved = saved.hasMoved;
        } else {
          const destination = gridToWorld(0, 0);
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.duck = { x: destination.x - 18, y: destination.y + 10 };
          runtime.path = [{ ...destination }];
        }
        runtime.connection = runtime.configured ? "connecting" : "offline";
        runtime.statusMessage = runtime.configured
          ? "Connecting to the shared garden..."
          : "Preview mode: shared planting is not connected.";
      }
      lastUiKeyRef.current = "";
      publishUi();
    }, [mode, publishUi]);

    useEffect(() => {
      if (mode !== "personal" || !personalGarden) return;
      const runtime = runtimeRef.current;
      applyPersonalGarden(runtime, personalGarden);
      publishUi();
    }, [mode, personalGarden, publishUi]);

    const loadPlants = useCallback(async () => {
      const runtime = runtimeRef.current;
      if (runtime.mode === "personal") {
        publishUi();
        return;
      }
      const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      let bounds = getLoadedBounds(gridX, gridY);
      const requestId = ++runtime.requestId;
      overlayRecentCommunityPlants(runtime);
      ensureClearedWeedsLoaded(runtime);

      const showLocalSnapshot = () => {
        runtime.plants = new Map(
          Array.from(runtime.communityPlants.values())
            .filter(
              (plant) =>
                plant.grid_x >= bounds.minX &&
                plant.grid_x <= bounds.maxX &&
                plant.grid_y >= bounds.minY &&
                plant.grid_y <= bounds.maxY &&
                getPlantVisual(plant).state !== "expired",
            )
            .map((plant) => [plantKey(plant.grid_x, plant.grid_y), plant]),
        );
        runtime.mapPlants = new Map(
          Array.from(runtime.communityPlants.values()).map((plant) => [
            plantKey(plant.grid_x, plant.grid_y),
            plant,
          ]),
        );
        runtime.weeds = new Map(
          Array.from(runtime.communityWeeds.values())
            .filter(
              (weed) =>
                weed.grid_x >= bounds.minX &&
                weed.grid_x <= bounds.maxX &&
                weed.grid_y >= bounds.minY &&
                weed.grid_y <= bounds.maxY,
            )
            .map((weed) => [plantKey(weed.grid_x, weed.grid_y), weed]),
        );
        runtime.mapRevision += 1;
      };

      if (!runtime.configured) {
        if (runtime.communityPlants.size === 0) {
          const localPlants = seedLocalPlants();
          runtime.communityPlants = new Map(
            localPlants.map((plant) => [plantKey(plant.grid_x, plant.grid_y), plant]),
          );
          runtime.mapRevision += 1;
        }
        showLocalSnapshot();
        publishUi();
        return;
      }

      const applyInitialSpawn = (
        spawnPoints: Array<{ gridX: number; gridY: number }>,
      ) => {
        if (
          runtime.spawnApplied ||
          runtime.hasMoved ||
          runtime.target ||
          spawnPoints.length === 0
        ) {
          return;
        }
        let spawnIndex = -1;
        try {
          const savedIndex = Number(
            window.sessionStorage.getItem("basil-community-spawn-index-v1"),
          );
          if (Number.isSafeInteger(savedIndex) && savedIndex >= 0) {
            spawnIndex = savedIndex % spawnPoints.length;
          }
        } catch {
          // A random balanced spawn remains safe when session storage is blocked.
        }
        if (spawnIndex < 0) {
          spawnIndex = Math.floor(Math.random() * spawnPoints.length);
          try {
            window.sessionStorage.setItem(
              "basil-community-spawn-index-v1",
              String(spawnIndex),
            );
          } catch {
            // The selected spawn still applies for this running client.
          }
        }
        const spawn = spawnPoints[spawnIndex];
        const destination = gridToWorld(spawn.gridX, spawn.gridY);
        runtime.mary = { ...destination };
        runtime.camera = { ...destination };
        runtime.duck = {
          x: clampRuntimeCoordinate(runtime, destination.x - 18, "x"),
          y: clampRuntimeCoordinate(runtime, destination.y + 10, "y"),
        };
        runtime.path = [{ ...destination }];
        runtime.loadedChunkKey = "";
        runtime.spawnApplied = true;
        bounds = getLoadedBounds(spawn.gridX, spawn.gridY);
      };

      let regionalDeliveryAvailable = true;
      try {
        if (
          !runtime.regionManifest ||
          Date.now() >= runtime.snapshotNextRefreshAt
        ) {
          const manifest = await fetchGardenRegionManifest();
          if (requestId !== runtime.requestId) return;
          runtime.regionManifest = manifest;
          runtime.snapshotNextRefreshAt = Date.parse(manifest.nextRefreshAt);
          runtime.mapRevision += 1;
        }
        applyInitialSpawn(runtime.regionManifest.spawnPoints);
      } catch {
        regionalDeliveryAvailable = false;
      }

      const centerGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const centerGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      const regionSize = runtime.regionManifest?.regionSize ?? GARDEN_CONFIG.chunkSize;
      const centerRegionX = Math.floor(centerGridX / regionSize);
      const centerRegionY = Math.floor(centerGridY / regionSize);
      const desiredRegionWindowKey = runtime.regionManifest
        ? `${runtime.regionManifest.snapshotVersion}:${centerRegionX}:${centerRegionY}:2`
        : "";

      const refreshWateringStatus = async () => {
        const boundsKey = `${bounds.minX}:${bounds.maxX}:${bounds.minY}:${bounds.maxY}`;
        if (
          runtime.wateringCareStatusLoaded &&
          runtime.wateringCareStatusBoundsKey === boundsKey &&
          Date.now() < runtime.wateringCareStatusNextRefreshAt
        ) {
          return;
        }
        try {
          const status = await fetchGardenWateringStatus(
            bounds,
            accountAccessTokenRef.current,
          );
          if (requestId !== runtime.requestId) return;
          const activeTutorialPlantId =
            tutorialDimmedRef.current &&
            isTutorialWateringInteractionActive(runtime)
              ? runtime.suggestedWateringCell?.plantId
              : null;
          const readyPlantIds = new Set(status.readyPlantIds);
          if (
            activeTutorialPlantId &&
            runtime.wateringCareReadyPlantIds.has(activeTutorialPlantId)
          ) {
            // Once the player chooses the tutorial flower, finish that
            // interaction before reconciling a possibly newer watering view.
            // The server remains authoritative when Water is submitted.
            readyPlantIds.add(activeTutorialPlantId);
          }
          runtime.wateringCareReadyPlantIds = readyPlantIds;
          runtime.wateringCareStatusLoaded = true;
          runtime.wateringCareStatusBoundsKey = boundsKey;
          runtime.wateringCareStatusNextRefreshAt =
            Date.now() + WATERING_STATUS_REFRESH_MS;
          if (tutorialDimmedRef.current) {
            refreshTutorialWateringTarget(runtime);
          }
          publishUi();
        } catch {
          // Shared hydration remains usable if the private Care cues cannot
          // refresh. The existing flower timestamps provide a safe fallback.
          if (requestId === runtime.requestId) {
            runtime.wateringCareStatusLoaded = false;
            runtime.wateringCareStatusNextRefreshAt =
              Date.now() + GARDEN_CONFIG.pollIntervalMs;
          }
        }
      };

      if (
        desiredRegionWindowKey.length > 0 &&
        runtime.loadedRegionWindowKey === desiredRegionWindowKey &&
        runtime.snapshotNextRefreshAt > 0 &&
        Date.now() < runtime.snapshotNextRefreshAt
      ) {
        showLocalSnapshot();
        publishUi();
        await refreshWateringStatus();
        return;
      }

      try {
        if (!regionalDeliveryAvailable || !runtime.regionManifest) {
          throw new Error("Regional delivery is temporarily unavailable.");
        }
        const regionalWindow = await fetchGardenRegionWindow(
          centerRegionX,
          centerRegionY,
          runtime.regionManifest.snapshotVersion,
          2,
        );
        if (requestId !== runtime.requestId) return;
        reconcileCommunitySnapshot(
          runtime,
          regionalWindow.plants,
          regionalWindow.generatedAt,
        );
        runtime.communityWeeds = new Map(
          regionalWindow.weeds
            .filter((weed) => !runtime.recentlyClearedWeeds.has(weed.id))
            .map((weed) => [plantKey(weed.grid_x, weed.grid_y), weed]),
        );
        runtime.loadedRegionWindowKey = desiredRegionWindowKey;
        runtime.snapshotNextRefreshAt = Date.parse(regionalWindow.nextRefreshAt);
        runtime.mapRevision += 1;
        showLocalSnapshot();
        runtime.connection = "online";
        runtime.statusMessage = "The shared garden is connected.";
      } catch {
        try {
          const snapshot = await fetchGardenSnapshot();
          if (requestId !== runtime.requestId) return;
          reconcileCommunitySnapshot(runtime, snapshot.plants, snapshot.generatedAt);
          runtime.communityWeeds = new Map(
            snapshot.weeds
              .filter((weed) => !runtime.recentlyClearedWeeds.has(weed.id))
              .map((weed) => [plantKey(weed.grid_x, weed.grid_y), weed]),
          );
          applyInitialSpawn(snapshot.spawnPoints);
          runtime.loadedRegionWindowKey = "full-snapshot-fallback";
          runtime.snapshotNextRefreshAt = Date.parse(snapshot.nextRefreshAt);
          runtime.mapRevision += 1;
          showLocalSnapshot();
          runtime.connection = "online";
          runtime.statusMessage = "The shared garden is connected.";
        } catch (error) {
          runtime.connection = "error";
          runtime.statusMessage =
            error instanceof Error ? error.message : "The garden could not refresh.";
        }
      }
      publishUi();
      await refreshWateringStatus();
    }, [publishUi]);

    useEffect(() => {
      loadPlantsRef.current = loadPlants;
    }, [loadPlants]);

    useImperativeHandle(
      ref,
      () => {
        const handle: GardenCanvasHandle = {
        async captureGarden(scope) {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          return renderPersonalGardenShare(runtimeRef.current, canvas, scope);
        },
        suggestPlantingSpot() {
          if (!tutorialDimmedRef.current) return;
          const runtime = runtimeRef.current;
          runtime.toolMode = "plant";
          runtime.suggestedPlantingCell = findSuggestedPlantingCell(runtime);
          runtime.suggestedWateringCell = null;
          runtime.selected = null;
          runtime.target = null;
          if (runtime.suggestedPlantingCell) {
            bringTutorialTargetIntoView(runtime, runtime.suggestedPlantingCell);
          }
          runtime.statusMessage = runtime.suggestedPlantingCell
            ? "Tap the glowing patch to walk over and plant."
            : "The garden is finding an open patch for you.";
          publishUi();
        },
        suggestWateringSpot() {
          if (!tutorialDimmedRef.current) return;
          const runtime = runtimeRef.current;
          runtime.suggestedWateringCell = findSuggestedWateringCell(runtime);
          runtime.suggestedPlantingCell = null;
          runtime.selected = null;
          runtime.target = null;
          if (runtime.suggestedWateringCell) {
            guideMaryTowardTutorialWateringTarget(
              runtime,
              runtime.suggestedWateringCell,
            );
          }
          runtime.statusMessage = runtime.suggestedWateringCell
            ? "Tap the blue square around a flower with a water drop."
            : "The garden is finding a flower with a water drop.";
          publishUi();
        },
        showCareReward(value, dailyBonus = false) {
          const runtime = runtimeRef.current;
          if (runtime.mode !== "community") return;
          runtime.effects.push({
            kind: "care",
            x: runtime.mary.x,
            y: runtime.mary.y,
            value,
            dailyBonus,
            startedAt: Date.now(),
          });
          runtime.statusMessage = dailyBonus
            ? `${value} daily Care earned.`
            : `${value} Care earned.`;
          publishUi();
        },
        zoomIn() {
          const runtime = runtimeRef.current;
          runtime.zoom = clampZoom(runtime.zoom + GARDEN_CONFIG.cameraZoomStep);
          runtime.statusMessage = "Zoomed in for a closer garden view.";
          publishUi();
        },
        zoomOut() {
          const runtime = runtimeRef.current;
          runtime.zoom = clampZoom(runtime.zoom - GARDEN_CONFIG.cameraZoomStep);
          runtime.statusMessage = "Zoomed out to see more of the garden.";
          publishUi();
        },
        restoreView(mapX, mapY, zoom, selectedTool) {
          const runtime = runtimeRef.current;
          if (runtime.mode === "community") runtime.spawnApplied = true;
          const requestedGridX = getRuntimeGridFromMapPercentage(
            runtime,
            mapX,
            "x",
          );
          const requestedGridY = getRuntimeGridFromMapPercentage(
            runtime,
            mapY,
            "y",
          );
          const bounds = getRuntimeBounds(runtime);
          const destination = gridToWorld(
            Math.min(bounds.maxX, Math.max(bounds.minX, requestedGridX)),
            Math.min(bounds.maxY, Math.max(bounds.minY, requestedGridY)),
          );
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.target = null;
          runtime.zoom = clampZoom(zoom);
          if (selectedTool === "path" && runtime.mode === "personal") {
            runtime.toolMode = "path";
          } else if (
            isMyGardenElementType(selectedTool) &&
            runtime.mode === "personal"
          ) {
            runtime.toolMode = "element";
            runtime.selectedElementType = selectedTool;
          } else if (isMyGardenPlantType(selectedTool)) {
            runtime.toolMode = "plant";
            runtime.selectedPlantType = selectedTool;
          }
          runtime.loadedChunkKey = "";
          publishUi();
        },
        selectPlant(plantType) {
          const runtime = runtimeRef.current;
          runtime.selectedPlantType = plantType;
          runtime.toolMode = "plant";
          if (runtime.builder?.mode === "place") {
            runtime.builder.category = "plant";
            runtime.builder.itemType = plantType;
            runtime.builder.cells = runtime.builder.cells.slice(0, 1);
            runtime.statusMessage = `${getPlantDefinition(plantType).name} selected for this Builder string.`;
          } else {
            runtime.statusMessage = `${getPlantDefinition(plantType).name} seeds selected.`;
          }
          publishUi();
        },
        selectPathTool() {
          const runtime = runtimeRef.current;
          if (runtime.mode !== "personal") return;
          runtime.toolMode = "path";
          if (runtime.builder?.mode === "place") {
            runtime.builder.category = "path";
            runtime.builder.itemType = "path";
            runtime.builder.cells = runtime.builder.cells.slice(0, 1);
            runtime.statusMessage =
              "Path selected for this Builder string. Paths remain free.";
          } else {
            runtime.statusMessage =
              "Path tool selected. Choose a spot to lay or remove a path for free.";
          }
          publishUi();
        },
        selectElement(elementType) {
          const runtime = runtimeRef.current;
          if (runtime.mode !== "personal") return;
          runtime.selectedElementType = elementType;
          runtime.toolMode = "element";
          const definition = getMyGardenElement(elementType);
          if (runtime.builder?.mode === "place") {
            if (
              definition.footprintWidth !== 1 ||
              definition.footprintHeight !== 1
            ) {
              runtime.statusMessage =
                "Builder supports one-tile items only. Exit Builder to place that item normally.";
            } else {
              runtime.builder.category = "element";
              runtime.builder.itemType = elementType;
              runtime.builder.cells = runtime.builder.cells.slice(0, 1);
              runtime.statusMessage = `${definition.name} selected for this Builder string.`;
            }
          } else {
            runtime.statusMessage = `${definition.name} selected. Choose an open tile.`;
          }
          publishUi();
        },
        toggleBuilderMode() {
          const runtime = runtimeRef.current;
          if (runtime.builder) {
            runtime.builder = null;
            runtime.statusMessage =
              "Builder closed. Returning to Mary and normal garden play.";
            publishUi();
            return;
          }
          const builder = createBuilderDraft(runtime);
          if (!builder) {
            runtime.statusMessage =
              runtime.personalGarden?.preview
                ? "Builder Mode is included with Garden Membership."
                : "Choose an open square or a one-tile item before opening Builder.";
            publishUi();
            return;
          }
          runtime.target = null;
          runtime.moving = false;
          runtime.builder = builder;
          runtime.statusMessage =
            "Builder open. Tap beside the newest square to extend your string.";
          publishUi();
        },
        undoBuilderStep() {
          const runtime = runtimeRef.current;
          if (!runtime.builder || runtime.builder.cells.length <= 1) return;
          runtime.builder.cells.pop();
          const head =
            runtime.builder.cells[runtime.builder.cells.length - 1];
          runtime.selected = { ...head };
          runtime.statusMessage = "Last Builder square removed.";
          publishUi();
        },
        clearBuilder() {
          const runtime = runtimeRef.current;
          if (!runtime.builder) return;
          runtime.builder.cells = runtime.builder.cells.slice(0, 1);
          runtime.selected = { ...runtime.builder.cells[0] };
          runtime.statusMessage = "Builder string reset to its first square.";
          publishUi();
        },
        goToMapPosition(mapX, mapY) {
          const runtime = runtimeRef.current;
          const requestedGridX = getRuntimeGridFromMapPercentage(
            runtime,
            mapX,
            "x",
          );
          const requestedGridY = getRuntimeGridFromMapPercentage(
            runtime,
            mapY,
            "y",
          );
          const bounds = getRuntimeBounds(runtime);
          const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, requestedGridX));
          const clampedY = Math.min(bounds.maxY, Math.max(bounds.minY, requestedGridY));
          const { gridX, gridY } = getNearestOpenGrid(
            runtime,
            clampedX,
            clampedY,
          );
          const destination = gridToWorld(gridX, gridY);
          runtime.selected = null;
          runtime.target = null;
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.duck = {
            x: clampRuntimeCoordinate(runtime, destination.x - 18, "x"),
            y: clampRuntimeCoordinate(runtime, destination.y + 10, "y"),
          };
          runtime.path = [{ ...destination }];
          runtime.loadedChunkKey = "";
          runtime.hasMoved = true;
          runtime.statusMessage =
            runtime.mode === "personal"
              ? "Exploring another part of My Garden."
              : "Exploring a new part of the garden.";
          publishUi();
        },
        goToGridPosition(requestedGridX, requestedGridY) {
          const runtime = runtimeRef.current;
          const bounds = getRuntimeBounds(runtime);
          const clampedX = Math.min(
            bounds.maxX,
            Math.max(bounds.minX, Math.round(requestedGridX)),
          );
          const clampedY = Math.min(
            bounds.maxY,
            Math.max(bounds.minY, Math.round(requestedGridY)),
          );
          const { gridX, gridY } = getNearestOpenGrid(
            runtime,
            clampedX,
            clampedY,
          );
          const destination = gridToWorld(gridX, gridY);
          runtime.selected = null;
          runtime.target = null;
          runtime.mary = { ...destination };
          runtime.camera = { ...destination };
          runtime.duck = {
            x: clampRuntimeCoordinate(runtime, destination.x - 18, "x"),
            y: clampRuntimeCoordinate(runtime, destination.y + 10, "y"),
          };
          runtime.path = [{ ...destination }];
          runtime.loadedChunkKey = "";
          runtime.hasMoved = true;
          runtime.statusMessage = "Visiting a Heritage Flower.";
          publishUi();
        },
        async performAction() {
          const runtime = runtimeRef.current;
          const selected = runtime.selected;
          const actionState = getActionState(runtime);
          if (!selected) return;
          if (!actionState.enabled || !actionState.action) {
            if (canQueueCommunityPlant(runtime, selected)) {
              queuedPlantingRef.current = { ...selected };
              runtime.statusMessage = runtime.actionBusy
                ? "Your next planting is ready and will follow this one."
                : "Planting ready. Mary will plant when she reaches the patch.";
              publishUi();
            }
            return;
          }
          queuedPlantingRef.current = null;

          if (actionState.action === "water") {
            const wateringTargets = getWateringSelection(runtime, selected);
            const selectionKey = wateringTargets[0]?.id ?? "";
            if (!selectionKey) return;
            if (runtime.wateringPumpSelectionKey !== selectionKey) {
              runtime.wateringPumpSelectionKey = selectionKey;
              runtime.wateringPumpCount = 0;
            }
            const spray = advanceWateringSpray(
              runtime.wateringPumpCount,
              wateringTargets.length,
            );
            const sprayTargets = wateringTargets.slice(
              spray.targetStartIndex,
              spray.targetEndIndex,
            );
            if (sprayTargets.length === 0) return;
            const effectStartedAt = Date.now();
            sprayTargets.forEach((target, index) => {
              const delay = index * 55;
              runtime.effects.push({
                kind: "spray",
                fromX: runtime.mary.x,
                fromY: runtime.mary.y,
                gridX: target.grid_x,
                gridY: target.grid_y,
                startedAt: effectStartedAt + delay,
              });
              runtime.effects.push({
                kind: "water",
                gridX: target.grid_x,
                gridY: target.grid_y,
                startedAt: effectStartedAt + delay + 80,
              });
            });
            if (!spray.shouldSubmit) {
              runtime.wateringPumpCount = spray.nextSprayCount;
              runtime.statusMessage =
                `The first spray reached ${sprayTargets.length} flowers. Tap Water again for the next three.`;
              publishUi();
              return;
            }
          }

          runtime.actionBusy = true;
          runtime.pendingAction = actionState.action;
          runtime.requestId += 1;
          const selectedDefinition = getPlantDefinition(runtime.selectedPlantType);
          runtime.statusMessage =
            actionState.action === "builder-place"
              ? "Building that garden string..."
              : actionState.action === "builder-remove"
                ? "Clearing that garden string..."
            : actionState.action === "expand"
              ? "Opening your next garden parcel..."
              : actionState.action === "place-element"
                ? `Placing ${getMyGardenElement(runtime.selectedElementType).name.toLowerCase()}...`
                : actionState.action === "remove-element"
                  ? "Picking up that garden item..."
              : actionState.action === "lay-path" ||
                actionState.action === "remove-path"
              ? "Updating your garden path..."
              : actionState.action === "plant"
              ? `Planting ${selectedDefinition.name.toLowerCase()}...`
              : actionState.action === "uproot"
                ? "Uprooting the plant..."
                : actionState.action === "weed"
                  ? "Pulling a weed to help this patch recover..."
                : "Watering the plant...";
          publishUi();

          try {
            if (runtime.mode === "personal") {
              const mutate = onPersonalGardenMutationRef.current;
              if (!mutate || !runtime.personalGarden) {
                throw new Error("My Garden could not be updated.");
              }

              const current = getPlantAt(runtime, selected.gridX, selected.gridY);
              const currentElement = getPersonalElement(
                runtime,
                selected.gridX,
                selected.gridY,
              );
              const isPathAction =
                actionState.action === "lay-path" ||
                actionState.action === "remove-path";
              const isElementAction =
                actionState.action === "place-element" ||
                actionState.action === "remove-element";
              const builder = runtime.builder
                ? {
                    ...runtime.builder,
                    cells: runtime.builder.cells.map((cell) => ({ ...cell })),
                  }
                : null;
              const isBuilderAction =
                actionState.action === "builder-place" ||
                actionState.action === "builder-remove";
              const builderCareDelta = builder
                ? getBuilderCareDelta(runtime, builder)
                : 0;
              const mutation: MyGardenMutation =
                isBuilderAction && builder
                  ? {
                      action: "builder",
                      actionId: crypto.randomUUID(),
                      mode: builder.mode,
                      category: builder.category,
                      itemType:
                        builder.mode === "remove"
                          ? null
                          : (builder.itemType as
                              | MyGardenElementType
                              | MyGardenPlantType
                              | "path"),
                      cells: builder.cells,
                    }
                  : actionState.action === "expand"
                  ? { action: "expand" }
                  : actionState.action === "place-element"
                    ? {
                        action: "place-element",
                        gridX: selected.gridX,
                        gridY: selected.gridY,
                        elementType: runtime.selectedElementType,
                      }
                    : actionState.action === "remove-element"
                      ? {
                          action: "remove-element",
                          elementId: currentElement?.id ?? "",
                        }
                  : isPathAction
                  ? {
                      action: "toggle-path",
                      gridX: selected.gridX,
                      gridY: selected.gridY,
                    }
                  : actionState.action === "plant"
                  ? {
                      action: "plant",
                      gridX: selected.gridX,
                      gridY: selected.gridY,
                      plantType: runtime.selectedPlantType,
                    }
                  : {
                      action: "uproot",
                      plantId: current?.id ?? "",
                    };
              const updatedGarden = await mutate(mutation);
              applyPersonalGarden(runtime, updatedGarden);
              if (isBuilderAction && builder) {
                const startedAt = Date.now();
                builder.cells.forEach((cell, index) => {
                  runtime.effects.push({
                    kind:
                      builder.mode === "remove"
                        ? "uproot"
                        : builder.category === "plant"
                          ? "plant"
                          : "path",
                    gridX: cell.gridX,
                    gridY: cell.gridY,
                    startedAt: startedAt + index * 35,
                  });
                });
                const count = builder.cells.length;
                runtime.builder = null;
                runtime.selected = null;
                runtime.statusMessage =
                  builder.mode === "place"
                    ? `${count} ${count === 1 ? "square" : "squares"} built. ${updatedGarden.careBalance} Care remains.`
                    : `${count} ${count === 1 ? "square" : "squares"} cleared${builderCareDelta > 0 ? ` for ${builderCareDelta} Care` : ""}.`;
              } else if (actionState.action !== "expand") {
                runtime.effects.push({
                  kind: isPathAction || isElementAction
                    ? "path"
                    : actionState.action === "plant"
                      ? "plant"
                      : "uproot",
                  gridX: selected.gridX,
                  gridY: selected.gridY,
                  startedAt: Date.now(),
                });
              }
              if (!isBuilderAction) runtime.selected =
                actionState.action === "expand"
                  ? null
                  : isPathAction || isElementAction
                  ? { gridX: selected.gridX, gridY: selected.gridY }
                  : actionState.action === "plant"
                  ? {
                      ...selected,
                      plantId: getPlantAt(runtime, selected.gridX, selected.gridY)?.id,
                    }
                  : { gridX: selected.gridX, gridY: selected.gridY };
              if (!isBuilderAction) runtime.statusMessage =
                actionState.action === "expand"
                  ? `Parcel opened. The next piece of land is ready when you have ${updatedGarden.nextExpansion?.careCost ?? "more"} Care.`
                  : actionState.action === "place-element"
                    ? `${getMyGardenElement(runtime.selectedElementType).name} placed. ${updatedGarden.careBalance} Care remains.`
                    : actionState.action === "remove-element"
                      ? `Item picked up. ${updatedGarden.careBalance} Care is available.`
                  : isPathAction
                  ? actionState.action === "lay-path"
                    ? "Path added for free."
                    : "Path removed."
                  : actionState.action === "plant"
                  ? `${selectedDefinition.name} planted. ${updatedGarden.careBalance} Care remains.`
                  : `Plant uprooted. ${updatedGarden.careBalance} Care is available.`;
            } else if (actionState.action === "plant") {
              if (
                !PLANT_TYPES.some(
                  (type) => type === runtime.selectedPlantType,
                )
              ) {
                runtime.selectedPlantType = "rose";
              }
              const communityPlantType =
                runtime.selectedPlantType as (typeof PLANT_TYPES)[number];
              const existing = getPlantAt(runtime, selected.gridX, selected.gridY);
              if (!isPlantable(existing)) throw new Error("Another plant is already here.");
              if (getWeedAt(runtime, selected.gridX, selected.gridY)) {
                throw new Error("Pull this weed before planting here.");
              }
              const result = runtime.configured
                ? await plantGardenPlant(
                    selected.gridX,
                    selected.gridY,
                    communityPlantType,
                    accountAccessTokenRef.current,
                  )
                : {
                    plant: makeLocalPlant(
                      selected.gridX,
                      selected.gridY,
                      communityPlantType,
                    ),
                    contribution: null,
                  };
              const { plant, contribution } = result;
              runtime.plants.set(plantKey(plant.grid_x, plant.grid_y), plant);
              runtime.mapPlants.set(plantKey(plant.grid_x, plant.grid_y), plant);
              runtime.communityPlants.set(
                plantKey(plant.grid_x, plant.grid_y),
                plant,
              );
              if (runtime.configured) {
                rememberRecentCommunityPlant(runtime, plant);
              }
              runtime.mapRevision += 1;
              const selectionStillCurrent = sameSelectedCell(
                runtime.selected,
                selected,
              );
              if (selectionStillCurrent) {
                runtime.selected = { ...selected, plantId: plant.id };
              }
              runtime.effects.push({
                kind: "plant",
                gridX: plant.grid_x,
                gridY: plant.grid_y,
                startedAt: Date.now(),
              });
              if (contribution?.gardenWorm) {
                const worm = surfaceGardenWorm(
                  runtime,
                  plant.grid_x,
                  plant.grid_y,
                );
                runtime.effects.push({
                  kind: "worm",
                  gridX: worm?.gridX ?? plant.grid_x,
                  gridY: worm?.gridY ?? plant.grid_y,
                  startedAt: Date.now(),
                });
              }
              if (selectionStillCurrent) {
                runtime.statusMessage = `A new ${selectedDefinition.name.toLowerCase()} has taken root.`;
              }
              if (contribution) onCommunityContributionRef.current?.(contribution);
            } else if (actionState.action === "weed") {
              const weed = getWeedAt(runtime, selected.gridX, selected.gridY);
              if (!weed) throw new Error("That weed has already been cleared.");
              const result = await clearGardenWeed(
                weed.id,
                accountAccessTokenRef.current,
              );
              runtime.weeds.delete(plantKey(weed.grid_x, weed.grid_y));
              runtime.communityWeeds.delete(plantKey(weed.grid_x, weed.grid_y));
              rememberClearedWeed(runtime, weed.id);
              runtime.effects.push({
                kind: "uproot",
                gridX: weed.grid_x,
                gridY: weed.grid_y,
                startedAt: Date.now(),
              });
              runtime.selected = { gridX: weed.grid_x, gridY: weed.grid_y };
              runtime.statusMessage = "The patch has room to breathe again.";
              if (result.contribution) {
                onCommunityContributionRef.current?.(result.contribution);
              }
            } else {
              const wateringTargets = getWateringSelection(runtime, selected);
              if (wateringTargets.length === 0) {
                throw new Error("Those flowers are no longer here.");
              }
              const current =
                getPlantAt(runtime, selected.gridX, selected.gridY) ??
                wateringTargets[0];
              const wateredAt = new Date().toISOString();
              const result = runtime.configured
                  ? await waterGardenPlants(
                      wateringTargets.map((target) => target.id),
                      accountAccessTokenRef.current,
                    )
                : {
                    plant: { ...current, last_watered_at: wateredAt },
                    plants: wateringTargets.map((target) => ({
                      ...target,
                      last_watered_at: wateredAt,
                    })),
                    wateringClaimedPlantIds: [],
                    heritagePlantIds: [],
                    heritageMoments: [],
                    contribution: null,
                  };
              const { plants, contribution } = result;
              const heritagePlantIds =
                "heritagePlantIds" in result && Array.isArray(result.heritagePlantIds)
                  ? result.heritagePlantIds
                  : [];
              const responseHeritageMoments =
                "heritageMoments" in result &&
                Array.isArray(result.heritageMoments)
                  ? result.heritageMoments
                  : [];
              const reportedHeritagePlantIds = new Set(
                responseHeritageMoments.map((moment) => moment.plantId),
              );
              const compatibilityHeritageMoments = heritagePlantIds.flatMap(
                (plantId): HeritageMoment[] => {
                  if (reportedHeritagePlantIds.has(plantId)) return [];
                  const candidate = plants.find((plant) => plant.id === plantId);
                  if (!candidate) return [];
                  if (
                    !PLANT_TYPES.includes(
                      candidate.plant_type as CommunityPlantType,
                    )
                  ) {
                    return [];
                  }
                  const becameHeritageAt =
                    candidate.heritage_at ?? new Date().toISOString();
                  return [{
                    eventId: `legacy:${plantId}`,
                    plantId,
                    plantType: candidate.plant_type as CommunityPlantType,
                    gridX: candidate.grid_x,
                    gridY: candidate.grid_y,
                    role: "helper",
                    becameHeritageAt,
                  }];
                },
              );
              const heritageSet = new Set(heritagePlantIds);
              for (const candidate of plants) {
                const plant = heritageSet.has(candidate.id)
                  ? { ...candidate, heritage_at: new Date().toISOString() }
                  : candidate;
                runtime.wateringCareReadyPlantIds.delete(plant.id);
                runtime.plants.set(plantKey(plant.grid_x, plant.grid_y), plant);
                runtime.communityPlants.set(
                  plantKey(plant.grid_x, plant.grid_y),
                  plant,
                );
                if (runtime.configured) {
                  rememberRecentCommunityPlant(runtime, plant);
                }
              }
              runtime.statusMessage =
                heritagePlantIds.length > 0
                  ? `${heritagePlantIds.length === 1 ? "A flower has" : `${heritagePlantIds.length} flowers have`} become part of the garden's heritage.`
                : plants.length === 1
                  ? `The ${getPlantDefinition(plants[0].plant_type).name.toLowerCase()} looks brighter already.`
                  : `${plants.length} nearby flowers look brighter already.`;
              const heritageMoments = [
                ...responseHeritageMoments,
                ...compatibilityHeritageMoments,
              ];
              if (heritageMoments.length > 0) {
                onHeritageMomentsRef.current?.(heritageMoments);
              }
              runtime.wateringPumpCount = 0;
              runtime.wateringPumpSelectionKey = "";
              runtime.selected = null;
              if (contribution) onCommunityContributionRef.current?.(contribution);
            }
            if (actionState.action === "plant") {
              runtime.suggestedPlantingCell = null;
            } else if (actionState.action === "water") {
              runtime.suggestedWateringCell = null;
            }
            onActionCompletedRef.current?.(runtime.mode, actionState.action);
            runtime.connection = runtime.configured ? "online" : "offline";
          } catch (error) {
            onActionFailedRef.current?.(runtime.mode, actionState.action, error);
            const retryTutorialWatering =
              tutorialDimmedRef.current && actionState.action === "water";
            if (retryTutorialWatering) {
              runtime.selected = null;
              runtime.wateringCareStatusLoaded = false;
              runtime.wateringCareStatusNextRefreshAt = 0;
              queueMicrotask(() => {
                void loadPlantsRef.current();
              });
            }
            if (error instanceof GardenConnectionError) {
              runtime.connection = navigator.onLine ? "error" : "offline";
              console.warn("Basil garden action connection issue", {
                action: actionState.action,
                online: navigator.onLine,
                visibility: document.visibilityState,
                message: error.message,
              });
            }
            runtime.statusMessage = retryTutorialWatering
              ? "Another gardener reached that flower first. Finding a fresh water drop..."
              : error instanceof Error
                ? error.message
                : "That did not work. Please try again.";
          } finally {
            runtime.actionBusy = false;
            runtime.pendingAction = null;
            publishUi();
          }
        },
        };
        performActionRef.current = handle.performAction;
        return handle;
      },
      [publishUi],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const resizeCanvas = () => {
        const bounds = canvas.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return;
        const responsiveWidth = Math.round(
          GARDEN_CONFIG.logicalHeight * (bounds.width / bounds.height),
        );
        canvas.width = Math.min(
          GARDEN_CONFIG.maxLogicalWidth,
          Math.max(GARDEN_CONFIG.minLogicalWidth, responsiveWidth),
        );
        canvas.height = GARDEN_CONFIG.logicalHeight;
      };
      resizeCanvas();
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(resizeCanvas);
      resizeObserver?.observe(canvas);
      const scheduleResize = () => {
        window.requestAnimationFrame(() => {
          resizeCanvas();
          window.requestAnimationFrame(resizeCanvas);
        });
      };
      window.addEventListener("resize", scheduleResize);
      window.addEventListener("orientationchange", scheduleResize);
      window.visualViewport?.addEventListener("resize", scheduleResize);
      runtimeRef.current.reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      publishUi();

      let frameId = 0;
      const tick = (now: number) => {
        const runtime = runtimeRef.current;
        const deltaSeconds = Math.min(
          0.05,
          runtime.lastFrame ? (now - runtime.lastFrame) / 1000 : 0,
        );
        runtime.lastFrame = now;
        runtime.moving = false;

        if (runtime.target) {
          const dx = runtime.target.x - runtime.mary.x;
          const dy = runtime.target.y - runtime.mary.y;
          const distance = Math.hypot(dx, dy);
          const step = GARDEN_CONFIG.moveSpeed * deltaSeconds;
          if (distance <= Math.max(1, step)) {
            runtime.mary = {
              x: clampRuntimeCoordinate(runtime, runtime.target.x, "x"),
              y: clampRuntimeCoordinate(runtime, runtime.target.y, "y"),
            };
            runtime.target = null;
          } else {
            runtime.mary.x = clampRuntimeCoordinate(
              runtime,
              runtime.mary.x + (dx / distance) * step,
              "x",
            );
            runtime.mary.y = clampRuntimeCoordinate(
              runtime,
              runtime.mary.y + (dy / distance) * step,
              "y",
            );
            runtime.moving = true;
            runtime.hasMoved = true;
          }
        }

        const queuedPlanting = queuedPlantingRef.current;
        if (queuedPlanting) {
          if (
            !sameSelectedCell(runtime.selected, queuedPlanting) ||
            !canQueueCommunityPlant(runtime, queuedPlanting)
          ) {
            queuedPlantingRef.current = null;
          } else if (!runtime.actionBusy) {
            const queuedActionState = getActionState(runtime);
            if (
              queuedActionState.action === "plant" &&
              queuedActionState.enabled
            ) {
              queuedPlantingRef.current = null;
              queueMicrotask(() => void performActionRef.current());
            }
          }
        }

        if (runtime.moving) {
          const lastPath = runtime.path[runtime.path.length - 1];
          if (
            !lastPath ||
            Math.hypot(runtime.mary.x - lastPath.x, runtime.mary.y - lastPath.y) >= 2
          ) {
            runtime.path.push({ ...runtime.mary });
            if (runtime.path.length > 120) runtime.path.shift();
          }
        }

        const duckTarget = runtime.path[Math.max(0, runtime.path.length - 18)] ?? runtime.mary;
        const duckDx = duckTarget.x - runtime.duck.x;
        const duckDy = duckTarget.y - runtime.duck.y;
        const duckDistance = Math.hypot(duckDx, duckDy);
        if (duckDistance > 0.5) {
          const duckStep = Math.min(duckDistance, GARDEN_CONFIG.moveSpeed * 1.15 * deltaSeconds);
          runtime.duck.x += (duckDx / duckDistance) * duckStep;
          runtime.duck.y += (duckDy / duckDistance) * duckStep;
        }

        const cameraEase = runtime.reducedMotion ? 1 : Math.min(1, deltaSeconds * 7);
        const builderHead =
          runtime.builder?.cells[runtime.builder.cells.length - 1];
        const cameraTarget = builderHead
          ? gridToWorld(builderHead.gridX, builderHead.gridY)
          : runtime.mary;
        runtime.camera.x += (cameraTarget.x - runtime.camera.x) * cameraEase;
        runtime.camera.y += (cameraTarget.y - runtime.camera.y) * cameraEase;
        const wallClockNow = Date.now();
        runtime.effects = runtime.effects.filter(
          (effect) =>
            wallClockNow - effect.startedAt <
            (effect.kind === "care" ? 1100 : effect.kind === "worm" ? 1800 : 900),
        );

        const gridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
        const gridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
        const chunkKey = getChunkKey(gridX, gridY);
        if (chunkKey !== runtime.loadedChunkKey) {
          runtime.loadedChunkKey = chunkKey;
          void loadPlantsRef.current();
        }

        renderGarden(ctx, {
          viewport: { width: canvas.width, height: canvas.height },
          camera: runtime.camera,
          zoom: runtime.zoom,
          mary: runtime.mary,
          duck: runtime.duck,
          plants: Array.from(runtime.plants.values()),
          weeds: Array.from(runtime.weeds.values()),
          selected: runtime.selected,
          wateringTargets:
            runtime.mode === "community" &&
            runtime.selected &&
            getDistanceToCell(runtime, runtime.selected) <=
              GARDEN_CONFIG.tileSize * WATERING_RANGE_TILES
              ? getWateringSelection(runtime, runtime.selected)
                  .slice(
                    0,
                    (runtime.wateringPumpCount + 1) *
                      WATERING_TARGETS_PER_SPRAY,
                  )
                  .map((plant) => ({
                  gridX: plant.grid_x,
                  gridY: plant.grid_y,
                  plantId: plant.id,
                  }))
              : [],
          wateringCareReadyPlantIds: runtime.wateringCareReadyPlantIds,
          wateringCareStatusLoaded: runtime.wateringCareStatusLoaded,
          suggestedPlantingCell: runtime.suggestedPlantingCell,
          suggestedWateringCell: runtime.suggestedWateringCell,
          gardenWorms: Array.from(runtime.gardenWorms.values()),
          tutorialDimmed: tutorialDimmedRef.current,
          effects: runtime.reducedMotion ? [] : runtime.effects,
          moving: runtime.reducedMotion ? false : runtime.moving,
          now: Date.now(),
          mode: runtime.mode,
          communityRegions:
            runtime.mode === "community"
              ? runtime.regionManifest?.regions.map((region) => ({
                  regionX: region.regionX,
                  regionY: region.regionY,
                  isOpen: region.isOpen,
                  publicStage: region.publicStage,
                }))
              : undefined,
          personalGarden: runtime.personalGarden
            ? {
                minX: runtime.personalGarden.minX,
                minY: runtime.personalGarden.minY,
                width: runtime.personalGarden.width,
                height: runtime.personalGarden.height,
                maxWidth: runtime.personalGarden.maxWidth,
                maxHeight: runtime.personalGarden.maxHeight,
                elements: runtime.personalGarden.elements,
                paths: runtime.personalGarden.paths,
                nextExpansion: runtime.personalGarden.nextExpansion
                  ? {
                      minX: runtime.personalGarden.nextExpansion.minX,
                      minY: runtime.personalGarden.nextExpansion.minY,
                      width: runtime.personalGarden.nextExpansion.width,
                      height: runtime.personalGarden.nextExpansion.height,
                      careCost: runtime.personalGarden.nextExpansion.careCost,
                    }
                  : null,
              }
            : undefined,
          builderPreview: runtime.builder
            ? {
                mode: runtime.builder.mode,
                cells: runtime.builder.cells,
                invalidCell:
                  runtime.builder.invalidCell &&
                  Date.now() < runtime.builder.invalidUntil
                    ? runtime.builder.invalidCell
                    : null,
              }
            : undefined,
        });
        const uiPublishInterval = runtime.moving || runtime.target ? 100 : 1_000;
        if (wallClockNow - runtime.lastUiPublishAt >= uiPublishInterval) {
          publishUi();
        }
        frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
      const pollId = window.setInterval(() => {
        void loadPlantsRef.current();
      }, GARDEN_CONFIG.pollIntervalMs);

      return () => {
        cancelAnimationFrame(frameId);
        window.clearInterval(pollId);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", scheduleResize);
        window.removeEventListener("orientationchange", scheduleResize);
        window.visualViewport?.removeEventListener("resize", scheduleResize);
      };
    }, [publishUi]);

    function selectCell(gridX: number, gridY: number) {
      const runtime = runtimeRef.current;
      queuedPlantingRef.current = null;
      if (runtime.builder) {
        const next = { gridX, gridY };
        const result = getBuilderAppendResult(runtime.builder.cells, next);
        if (result.kind === "unchanged") return;
        if (result.kind === "undo") {
          runtime.builder.cells.pop();
          const head =
            runtime.builder.cells[runtime.builder.cells.length - 1];
          runtime.selected = { ...head };
          runtime.statusMessage = "Last Builder square removed.";
          publishUi();
          return;
        }
        if (result.kind === "invalid") {
          runtime.builder.invalidCell = next;
          runtime.builder.invalidUntil = Date.now() + 700;
          runtime.statusMessage = result.reason;
          publishUi();
          return;
        }
        if (!canUseBuilderCell(runtime, runtime.builder, next)) {
          runtime.builder.invalidCell = next;
          runtime.builder.invalidUntil = Date.now() + 700;
          runtime.statusMessage =
            runtime.builder.mode === "place"
              ? "That Builder square must be empty and inside the fence."
              : "That square does not contain the same kind of one-tile item.";
          publishUi();
          return;
        }
        runtime.builder.cells.push(next);
        runtime.builder.invalidCell = null;
        runtime.selected = { ...next };
        runtime.statusMessage =
          runtime.builder.cells.length === MY_GARDEN_BUILDER_MAX_TILES
            ? "String full. Build these 10 squares or undo one."
            : `${runtime.builder.cells.length} squares ready. Add another or build now.`;
        publishUi();
        return;
      }
      const requiredTutorialCell =
        runtime.suggestedPlantingCell ?? runtime.suggestedWateringCell;
      if (tutorialDimmedRef.current && !requiredTutorialCell) {
        runtime.statusMessage = "Follow the highlighted garden guide to continue.";
        publishUi();
        return;
      }
      if (
        tutorialDimmedRef.current &&
        requiredTutorialCell &&
        (requiredTutorialCell.gridX !== gridX ||
          requiredTutorialCell.gridY !== gridY)
      ) {
        runtime.statusMessage = runtime.suggestedWateringCell
          ? "Tap the highlighted watering square to continue."
          : "Tap the glowing Plant Here patch to continue.";
        publishUi();
        return;
      }
      const lockedParcel = isNextExpansionCell(runtime, gridX, gridY);
      const lockedCommunityRegion =
        runtime.mode === "community"
          ? runtime.regionManifest?.regions.find(
              (region) =>
                !region.isOpen &&
                region.publicStage !== "wild" &&
                gridX >= region.bounds.minX &&
                gridX <= region.bounds.maxX &&
                gridY >= region.bounds.minY &&
                gridY <= region.bounds.maxY,
            )
          : null;
      if (!isWithinRuntime(runtime, gridX, gridY) && !lockedParcel) {
        runtime.statusMessage = lockedCommunityRegion
          ? "This Growing Edge land is locked for now. Garden on the open side of the boundary."
          : "You have reached the garden edge.";
        publishUi();
        return;
      }

      const wormKey = plantKey(gridX, gridY);
      if (runtime.mode === "community" && runtime.gardenWorms.has(wormKey)) {
        runtime.gardenWorms.delete(wormKey);
        runtime.effects.push({
          kind: "worm",
          gridX,
          gridY,
          startedAt: Date.now(),
        });
        runtime.statusMessage =
          "You found a Garden Worm—the soil is especially lively here.";
        onGardenWormDiscoveredRef.current?.();
        publishUi();
        return;
      }

      if (lockedParcel) {
        const garden = runtime.personalGarden;
        const cost = garden?.nextExpansion?.careCost ?? 0;
        runtime.selected = { gridX, gridY };
        runtime.target = getLockedParcelApproach(runtime, gridX, gridY);
        runtime.statusMessage = garden?.preview
          ? "Garden Membership saves and expands this land."
          : (garden?.careBalance ?? 0) >= cost
            ? `Parcel selected. Confirm below to unlock it for ${cost} Care.`
            : `Earn ${Math.max(0, cost - (garden?.careBalance ?? 0))} more Care to open this parcel.`;
        publishUi();
        return;
      }

      const maryGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const maryGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      if (maryGridX === gridX && maryGridY === gridY) {
        runtime.statusMessage = "Mary is standing there. Choose a nearby spot.";
        publishUi();
        return;
      }

      const plant = getPlantAt(runtime, gridX, gridY);
      const weed = getWeedAt(runtime, gridX, gridY);
      const nextWateringSelectionKey =
        runtime.mode === "community" && !weed ? plant?.id ?? "" : "";
      if (
        runtime.wateringPumpSelectionKey &&
        runtime.wateringPumpSelectionKey !== nextWateringSelectionKey
      ) {
        runtime.wateringPumpCount = 0;
        runtime.wateringPumpSelectionKey = "";
      }
      runtime.selected = { gridX, gridY, plantId: plant?.id, weedId: weed?.id };
      const wateringTargets =
        runtime.mode === "community" && !weed
          ? getWateringSelection(runtime, runtime.selected)
          : [];
      const isWateringSelection =
        runtime.mode === "community" &&
        wateringTargets.length > 0;
      const unavailableWateringPlant =
        runtime.mode === "community" &&
        Boolean(plant) &&
        !weed &&
        !isWateringSelection;
      runtime.target = isWateringSelection
        ? getWateringApproachTarget(runtime, gridX, gridY)
        : getAdjacentTarget(runtime, gridX, gridY);
      runtime.statusMessage = weed
        ? "Walking over to pull this weed..."
        : isWateringSelection
        ? runtime.target
          ? "Walking into watering range of the highlighted flowers..."
          : wateringTargets.length > WATERING_TARGETS_PER_SPRAY
            ? "Double tap Water to spray both strings of flowers."
            : "Tap Water to spray the highlighted flowers."
        : unavailableWateringPlant
          ? "Walking to that flower. Look for a water drop to earn Care."
        : "Walking to that spot...";
      publishUi();
    }

    function getPointerCell(
      event: ReactPointerEvent<HTMLCanvasElement>,
    ) {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const bounds = canvas.getBoundingClientRect();
      const screenX = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
      const screenY = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
      return screenToGrid(
        screenX,
        screenY,
        runtimeRef.current.camera,
        { width: canvas.width, height: canvas.height },
        runtimeRef.current.zoom,
      );
    }

    function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      if (pointerGestureRef.current) return;
      pointerGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        dragged: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
    }

    function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      if (
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
        ) >= 12
      ) {
        gesture.dragged = true;
      }
    }

    function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      pointerGestureRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const runtime = runtimeRef.current;
      if (!gesture.dragged) {
        if (runtime.builder) {
          const bounds = event.currentTarget.getBoundingClientRect();
          const head =
            runtime.builder.cells[runtime.builder.cells.length - 1];
          const next = getBuilderDirectionalCell(head, {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
            width: bounds.width,
            height: bounds.height,
          });
          selectCell(next.gridX, next.gridY);
          return;
        }
        const cell = getPointerCell(event);
        if (cell) selectCell(cell.gridX, cell.gridY);
        return;
      }

      if (tutorialDimmedRef.current) {
        runtime.statusMessage =
          "Finish the highlighted garden step before exploring.";
        publishUi();
        return;
      }

      if (runtime.builder) {
        runtime.statusMessage =
          "Builder Mode is active. Tap neighboring squares or close Builder.";
        publishUi();
        return;
      }

      const worldDx = -(event.clientX - gesture.startX) / runtime.zoom;
      const worldDy = -(event.clientY - gesture.startY) / runtime.zoom;
      runtime.selected = null;
      runtime.target = {
        x: clampRuntimeCoordinate(runtime, runtime.mary.x + worldDx, "x"),
        y: clampRuntimeCoordinate(runtime, runtime.mary.y + worldDy, "y"),
      };
      runtime.statusMessage =
        runtime.mode === "personal"
          ? "Exploring My Garden..."
          : "Exploring the garden...";
      publishUi();
    }

    function onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (pointerGestureRef.current?.pointerId !== event.pointerId) return;
      pointerGestureRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    return (
      <canvas
        ref={canvasRef}
        className="cg-canvas"
        role="application"
        aria-label={
          mode === "personal"
            ? "Basil My Garden. Tap a location to walk, plant, or uproot one of your flowers."
            : "Basil Community Garden. Tap a location to walk, plant, or water a flower."
        }
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  },
);

