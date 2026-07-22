"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  type MyGardenElementType,
} from "../lib/myGardenCatalog";
import type { MyGardenMutation } from "../lib/myGardenMutation";
import {
  clampWorldCoordinate,
  GARDEN_CONFIG,
  getChunkKey,
  getGridFromMapPercentage,
  getLoadedBounds,
  getMapPercentage,
} from "../lib/gardenConfig";
import {
  canEarnWateringCare,
  getPlantDefinition,
  getPlantVisual,
  isPlantable,
  PLANT_TYPES,
  type PlantRecord,
  type PlantType,
} from "../lib/roseLifecycle";
import {
  fetchGardenSnapshot,
  GardenConnectionError,
  type GardenContribution,
  type GardenMapPlant,
  isGardenConfigured,
  plantGardenPlant,
  waterGardenPlants,
} from "../lib/supabaseGarden";

const WATERING_RANGE_TILES = 5;
const WATERING_APPROACH_TILES = 4.25;
const MAX_WATERING_TARGETS = 4;

export type GardenConnection = "connecting" | "online" | "offline" | "error";
export type GardenAction =
  | "plant"
  | "water"
  | "uproot"
  | "expand"
  | "lay-path"
  | "remove-path"
  | "place-element"
  | "remove-element"
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
  nextMapUpdateAt: number | null;
  mode: GardenWorldMode;
};

export type GardenCanvasHandle = {
  performAction: () => Promise<void>;
  suggestPlantingSpot: () => void;
  goToMapPosition: (mapX: number, mapY: number) => void;
  selectPlant: (plantType: PlantType) => void;
  selectPathTool: () => void;
  selectElement: (elementType: MyGardenElementType) => void;
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
  recentCommunityPlants: Map<string, RecentCommunityPlant>;
  recentCommunityPlantsLoaded: boolean;
  snapshotNextRefreshAt: number;
  effects: GardenEffect[];
  path: WorldPoint[];
  lastFrame: number;
  loadedChunkKey: string;
  requestId: number;
  actionBusy: boolean;
  pendingAction: GardenAction;
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
};

type RecentCommunityPlant = {
  plant: PlantRecord;
  acceptedAt: number;
};

const RECENT_COMMUNITY_PLANTS_KEY = "basil-recent-community-plants-v1";
const RECENT_COMMUNITY_PLANT_TTL_MS = 30 * 60 * 1000;

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
  personalGarden: MyGardenState | null;
  onPersonalGardenMutation?: (
    mutation: MyGardenMutation,
  ) => Promise<MyGardenState>;
  onActionCompleted?: (mode: GardenWorldMode, action: GardenAction) => void;
  onActionFailed?: (
    mode: GardenWorldMode,
    action: GardenAction,
    error: unknown,
  ) => void;
};

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
        !PLANT_TYPES.includes(plantType)
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
  if (runtime.mode === "community" || !runtime.personalGarden) {
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
  if (runtime.mode === "community" || !runtime.personalGarden) {
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
  return (
    gridX >= bounds.minX &&
    gridX <= bounds.maxX &&
    gridY >= bounds.minY &&
    gridY <= bounds.maxY
  );
}

function clampRuntimeCoordinate(
  runtime: Runtime,
  value: number,
  axis: "x" | "y",
) {
  if (runtime.mode === "community") return clampWorldCoordinate(value);
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
  if (runtime.mode === "community") return getMapPercentage(coordinate);
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
  if (runtime.mode === "community") return getGridFromMapPercentage(percentage);
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

function getPendingActionLabel(action: NonNullable<GardenAction>) {
  switch (action) {
    case "plant":
      return "Planting...";
    case "water":
      return "Watering...";
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
  return runtime.personalGarden?.elements.find(
    (element) => element.gridX === gridX && element.gridY === gridY,
  );
}

function findSuggestedPlantingCell(runtime: Runtime): NonNullable<SelectedCell> | null {
  const originX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
  const originY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
  const offsets = [
    [-2, 0],
    [-2, -1],
    [-1, 2],
    [-1, -2],
    [-3, 0],
    [0, -3],
    [1, -2],
    [0, 3],
    [2, 0],
    [2, 1],
    [1, 2],
    [3, 0],
  ] as const;

  for (const [offsetX, offsetY] of offsets) {
    const gridX = originX + offsetX;
    const gridY = originY + offsetY;
    if (!isWithinRuntime(runtime, gridX, gridY)) continue;
    if (getPlantAt(runtime, gridX, gridY)) continue;
    if (runtime.mode === "personal") {
      if (hasPersonalPath(runtime, gridX, gridY)) continue;
      if (getPersonalElement(runtime, gridX, gridY)) continue;
    }
    return { gridX, gridY };
  }

  return null;
}

function getDistanceToCell(runtime: Runtime, selected: NonNullable<SelectedCell>) {
  const point = gridToWorld(selected.gridX, selected.gridY);
  return Math.hypot(runtime.mary.x - point.x, runtime.mary.y - point.y);
}

function getWateringCluster(
  runtime: Runtime,
  selected: NonNullable<SelectedCell>,
) {
  const first = getPlantAt(runtime, selected.gridX, selected.gridY);
  if (!first || getPlantVisual(first).state === "expired") return [];

  const squareOrigins = [
    [selected.gridX, selected.gridY],
    [selected.gridX - 1, selected.gridY],
    [selected.gridX, selected.gridY - 1],
    [selected.gridX - 1, selected.gridY - 1],
  ] as const;
  for (const [originX, originY] of squareOrigins) {
    const square = [
      getPlantAt(runtime, originX, originY),
      getPlantAt(runtime, originX + 1, originY),
      getPlantAt(runtime, originX, originY + 1),
      getPlantAt(runtime, originX + 1, originY + 1),
    ];
    if (
      square.every(
        (plant): plant is PlantRecord =>
          Boolean(plant) &&
          getPlantVisual(plant as PlantRecord).state !== "expired" &&
          getPlantVisual(plant as PlantRecord).state !== "dead",
      )
    ) {
      return square;
    }
  }

  const targets: PlantRecord[] = [];
  const visited = new Set<string>();
  const queue = [{ gridX: first.grid_x, gridY: first.grid_y }];
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;

  while (queue.length > 0 && targets.length < MAX_WATERING_TARGETS) {
    const cell = queue.shift();
    if (!cell) break;
    const key = plantKey(cell.gridX, cell.gridY);
    if (visited.has(key)) continue;
    visited.add(key);

    const plant = getPlantAt(runtime, cell.gridX, cell.gridY);
    if (!plant) continue;
    const visual = getPlantVisual(plant);
    if (visual.state === "expired" || visual.state === "dead") continue;
    targets.push(plant);

    for (const [offsetX, offsetY] of neighbors) {
      queue.push({ gridX: cell.gridX + offsetX, gridY: cell.gridY + offsetY });
    }
  }

  return targets;
}

function getWateringApproachTarget(runtime: Runtime, gridX: number, gridY: number) {
  const center = gridToWorld(gridX, gridY);
  const dx = runtime.mary.x - center.x;
  const dy = runtime.mary.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= GARDEN_CONFIG.tileSize * WATERING_RANGE_TILES) return null;
  const scale = (GARDEN_CONFIG.tileSize * WATERING_APPROACH_TILES) / distance;
  return {
    x: clampRuntimeCoordinate(runtime, center.x + dx * scale, "x"),
    y: clampRuntimeCoordinate(runtime, center.y + dy * scale, "y"),
  };
}

function getActionState(runtime: Runtime) {
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
          ? "Unlock land · Join"
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
    if (runtime.toolMode === "path") {
      if (plant) {
        return {
          action: null as GardenAction,
          label: "A flower is growing here",
          enabled: false,
        };
      }
      const hasPath = hasPersonalPath(
        runtime,
        runtime.selected.gridX,
        runtime.selected.gridY,
      );
      return {
        action: (hasPath ? "remove-path" : "lay-path") as GardenAction,
        label: hasPath ? "Remove path · Free" : "Lay path · Free",
        enabled: nearby && !runtime.actionBusy,
      };
    }
    if (runtime.toolMode === "element") {
      if (plant || hasPersonalPath(runtime, runtime.selected.gridX, runtime.selected.gridY)) {
        return {
          action: null as GardenAction,
          label: "Choose an open tile",
          enabled: false,
        };
      }
      const definition = getMyGardenElement(runtime.selectedElementType);
      const preview = Boolean(runtime.personalGarden?.preview);
      const care = runtime.personalGarden?.careBalance ?? 0;
      return {
        action: "place-element" as GardenAction,
        label: preview
          ? `Place ${definition.name} · Join`
          : `Place ${definition.name} · ${definition.careCost} Care`,
        enabled:
          nearby &&
          !runtime.actionBusy &&
          (preview || care >= definition.careCost),
      };
    }
    if (plant) {
      return {
        action: "uproot" as GardenAction,
        label: `Uproot ${getPlantDefinition(plant.plant_type).name} · +${runtime.personalGarden?.uprootReturn ?? 1} Care`,
        enabled: nearby && !runtime.actionBusy,
      };
    }
    if (hasPersonalPath(runtime, runtime.selected.gridX, runtime.selected.gridY)) {
      return {
        action: null as GardenAction,
        label: "A path is here",
        enabled: false,
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
        label: "Keep growing · Join",
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

  if (plant && visual && visual.state !== "expired") {
    const definition = getPlantDefinition(plant.plant_type);
    if (visual.state === "dead") {
      return { action: null as GardenAction, label: "This spot is resting", enabled: false };
    }
    const wateringTargets = getWateringCluster(runtime, runtime.selected);
    const inWateringRange =
      getDistanceToCell(runtime, runtime.selected) <=
      GARDEN_CONFIG.tileSize * WATERING_RANGE_TILES;
    const label =
      wateringTargets.length > 1
        ? `Water ${wateringTargets.length} flowers`
        : `Water ${definition.name}`;
    return {
      action: "water" as GardenAction,
      label: wateringTargets.some((target) => canEarnWateringCare(target))
        ? `${label} · +1 Care`
        : label,
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

export const GardenCanvas = forwardRef<GardenCanvasHandle, GardenCanvasProps>(
  function GardenCanvas(
    {
      onStateChange,
      onCommunityContribution,
      mode,
      personalGarden,
      onPersonalGardenMutation,
      onActionCompleted,
      onActionFailed,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onStateChangeRef = useRef(onStateChange);
    const onCommunityContributionRef = useRef(onCommunityContribution);
    const onPersonalGardenMutationRef = useRef(onPersonalGardenMutation);
    const onActionCompletedRef = useRef(onActionCompleted);
    const onActionFailedRef = useRef(onActionFailed);
    const personalGardenRef = useRef(personalGarden);
    const worldSnapshotsRef = useRef<
      Partial<Record<GardenWorldMode, WorldSnapshot>>
    >({});
    const loadPlantsRef = useRef<() => Promise<void>>(async () => undefined);
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
      recentCommunityPlants: new Map(),
      recentCommunityPlantsLoaded: false,
      snapshotNextRefreshAt: 0,
      effects: [],
      path: [{ ...start }],
      lastFrame: 0,
      loadedChunkKey: "",
      requestId: 0,
      actionBusy: false,
      pendingAction: null,
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
    });

    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

    useEffect(() => {
      onCommunityContributionRef.current = onCommunityContribution;
    }, [onCommunityContribution]);

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
            : 100,
        mapHeightPercentage:
          runtime.mode === "personal" && runtime.personalGarden
            ? (runtime.personalGarden.height / runtime.personalGarden.maxHeight) * 100
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
        nextMapUpdateAt:
          runtime.mode === "community" && runtime.snapshotNextRefreshAt > 0
            ? runtime.snapshotNextRefreshAt
            : null,
        mode: runtime.mode,
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
      if (mode === "community") runtime.toolMode = "plant";

      const currentPersonalGarden = personalGardenRef.current;
      if (mode === "personal" && currentPersonalGarden) {
        applyPersonalGarden(runtime, currentPersonalGarden);
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
      overlayRecentCommunityPlants(runtime);

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

      if (
        runtime.snapshotNextRefreshAt > 0 &&
        Date.now() < runtime.snapshotNextRefreshAt
      ) {
        showLocalSnapshot();
        publishUi();
        return;
      }

      const requestId = ++runtime.requestId;
      try {
        const snapshot = await fetchGardenSnapshot();
        if (requestId !== runtime.requestId) return;

        reconcileCommunitySnapshot(
          runtime,
          snapshot.plants,
          snapshot.generatedAt,
        );
        runtime.mapRevision += 1;
        runtime.snapshotNextRefreshAt = Date.parse(snapshot.nextRefreshAt);
        if (
          !runtime.spawnApplied &&
          !runtime.hasMoved &&
          !runtime.target &&
          snapshot.spawnPoints.length > 0
        ) {
          const spawn =
            snapshot.spawnPoints[
              Math.floor(Math.random() * snapshot.spawnPoints.length)
            ];
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
        }
        showLocalSnapshot();
        runtime.connection = "online";
        runtime.statusMessage = "The shared garden is connected.";
      } catch (error) {
        runtime.connection = "error";
        runtime.statusMessage =
          error instanceof Error ? error.message : "The garden could not refresh.";
      }
      publishUi();
    }, [publishUi]);

    useEffect(() => {
      loadPlantsRef.current = loadPlants;
    }, [loadPlants]);

    useImperativeHandle(
      ref,
      () => ({
        suggestPlantingSpot() {
          const runtime = runtimeRef.current;
          runtime.toolMode = "plant";
          runtime.suggestedPlantingCell = findSuggestedPlantingCell(runtime);
          runtime.statusMessage = runtime.suggestedPlantingCell
            ? "Tap the glowing patch to walk over and plant."
            : "Choose any open patch nearby to plant.";
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
            (selectedTool === "birdhouse" ||
              selectedTool === "bench" ||
              selectedTool === "stone_paver") &&
            runtime.mode === "personal"
          ) {
            runtime.toolMode = "element";
            runtime.selectedElementType = selectedTool;
          } else if (
            selectedTool === "rose" ||
            selectedTool === "sunflower" ||
            selectedTool === "lavender"
          ) {
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
          runtime.statusMessage = `${getPlantDefinition(plantType).name} seeds selected.`;
          publishUi();
        },
        selectPathTool() {
          const runtime = runtimeRef.current;
          if (runtime.mode !== "personal") return;
          runtime.toolMode = "path";
          runtime.statusMessage =
            "Path tool selected. Choose a spot to lay or remove a path for free.";
          publishUi();
        },
        selectElement(elementType) {
          const runtime = runtimeRef.current;
          if (runtime.mode !== "personal") return;
          runtime.selectedElementType = elementType;
          runtime.toolMode = "element";
          runtime.statusMessage = `${getMyGardenElement(elementType).name} selected. Choose an open tile.`;
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
          const gridX = Math.min(bounds.maxX, Math.max(bounds.minX, requestedGridX));
          const gridY = Math.min(bounds.maxY, Math.max(bounds.minY, requestedGridY));
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
        async performAction() {
          const runtime = runtimeRef.current;
          const selected = runtime.selected;
          const actionState = getActionState(runtime);
          if (!selected || !actionState.enabled || !actionState.action) return;

          runtime.actionBusy = true;
          runtime.pendingAction = actionState.action;
          runtime.requestId += 1;
          const selectedDefinition = getPlantDefinition(runtime.selectedPlantType);
          runtime.statusMessage =
            actionState.action === "expand"
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
              const mutation: MyGardenMutation =
                actionState.action === "expand"
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
              if (actionState.action !== "expand") {
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
              runtime.selected =
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
              runtime.statusMessage =
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
              const existing = getPlantAt(runtime, selected.gridX, selected.gridY);
              if (!isPlantable(existing)) throw new Error("Another plant is already here.");
              const result = runtime.configured
                ? await plantGardenPlant(
                    selected.gridX,
                    selected.gridY,
                    runtime.selectedPlantType,
                  )
                : {
                    plant: makeLocalPlant(
                      selected.gridX,
                      selected.gridY,
                      runtime.selectedPlantType,
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
              runtime.selected = { ...selected, plantId: plant.id };
              runtime.effects.push({
                kind: "plant",
                gridX: plant.grid_x,
                gridY: plant.grid_y,
                startedAt: Date.now(),
              });
              runtime.statusMessage = `A new ${selectedDefinition.name.toLowerCase()} has taken root.`;
              if (contribution) onCommunityContributionRef.current?.(contribution);
            } else {
              const current = getPlantAt(runtime, selected.gridX, selected.gridY);
              if (!current) throw new Error("That plant is no longer here.");
              const wateringTargets = getWateringCluster(runtime, selected);
              if (wateringTargets.length === 0) {
                throw new Error("Those flowers are no longer here.");
              }
              const wateredAt = new Date().toISOString();
              const result = runtime.configured
                ? await waterGardenPlants(
                    wateringTargets.map((target) => target.id),
                  )
                : {
                    plant: { ...current, last_watered_at: wateredAt },
                    plants: wateringTargets.map((target) => ({
                      ...target,
                      last_watered_at: wateredAt,
                    })),
                    contribution: null,
                  };
              const { plants, contribution } = result;
              const effectStartedAt = Date.now();
              runtime.effects.push({
                kind: "spray",
                fromX: runtime.mary.x,
                fromY: runtime.mary.y,
                gridX: current.grid_x,
                gridY: current.grid_y,
                startedAt: effectStartedAt,
              });
              for (const [index, plant] of plants.entries()) {
                runtime.plants.set(plantKey(plant.grid_x, plant.grid_y), plant);
                runtime.communityPlants.set(
                  plantKey(plant.grid_x, plant.grid_y),
                  plant,
                );
                if (runtime.configured) {
                  rememberRecentCommunityPlant(runtime, plant);
                }
                runtime.effects.push({
                  kind: "water",
                  gridX: plant.grid_x,
                  gridY: plant.grid_y,
                  startedAt: effectStartedAt + index * 80,
                });
              }
              runtime.statusMessage =
                plants.length === 1
                  ? `The ${getPlantDefinition(plants[0].plant_type).name.toLowerCase()} looks brighter already.`
                  : `${plants.length} nearby flowers look brighter already.`;
              if (contribution) onCommunityContributionRef.current?.(contribution);
            }
            if (actionState.action === "plant") {
              runtime.suggestedPlantingCell = null;
            }
            onActionCompletedRef.current?.(runtime.mode, actionState.action);
            runtime.connection = runtime.configured ? "online" : "offline";
          } catch (error) {
            onActionFailedRef.current?.(runtime.mode, actionState.action, error);
            if (error instanceof GardenConnectionError) {
              runtime.connection = navigator.onLine ? "error" : "offline";
              console.warn("Basil garden action connection issue", {
                action: actionState.action,
                online: navigator.onLine,
                visibility: document.visibilityState,
                message: error.message,
              });
            }
            runtime.statusMessage =
              error instanceof Error ? error.message : "That did not work. Please try again.";
          } finally {
            runtime.actionBusy = false;
            runtime.pendingAction = null;
            publishUi();
          }
        },
      }),
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
        runtime.camera.x += (runtime.mary.x - runtime.camera.x) * cameraEase;
        runtime.camera.y += (runtime.mary.y - runtime.camera.y) * cameraEase;
        const wallClockNow = Date.now();
        runtime.effects = runtime.effects.filter(
          (effect) =>
            wallClockNow - effect.startedAt < (effect.kind === "care" ? 1100 : 900),
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
          selected: runtime.selected,
          wateringTargets:
            runtime.mode === "community" &&
            runtime.selected &&
            getPlantAt(
              runtime,
              runtime.selected.gridX,
              runtime.selected.gridY,
            ) &&
            getDistanceToCell(runtime, runtime.selected) <=
              GARDEN_CONFIG.tileSize * WATERING_RANGE_TILES
              ? getWateringCluster(runtime, runtime.selected).map((plant) => ({
                  gridX: plant.grid_x,
                  gridY: plant.grid_y,
                  plantId: plant.id,
                }))
              : [],
          suggestedPlantingCell: runtime.suggestedPlantingCell,
          effects: runtime.reducedMotion ? [] : runtime.effects,
          moving: runtime.reducedMotion ? false : runtime.moving,
          now: Date.now(),
          mode: runtime.mode,
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
      const lockedParcel = isNextExpansionCell(runtime, gridX, gridY);
      if (!isWithinRuntime(runtime, gridX, gridY) && !lockedParcel) {
        runtime.statusMessage = "You have reached the garden edge.";
        publishUi();
        return;
      }

      if (lockedParcel) {
        const garden = runtime.personalGarden;
        const cost = garden?.nextExpansion?.careCost ?? 0;
        runtime.selected = { gridX, gridY };
        runtime.target = getLockedParcelApproach(runtime, gridX, gridY);
        if (
          garden &&
          !garden.preview &&
          garden.careBalance >= cost &&
          onPersonalGardenMutationRef.current &&
          !runtime.actionBusy
        ) {
          runtime.actionBusy = true;
          runtime.pendingAction = "expand";
          runtime.statusMessage = `Opening this parcel for ${cost} Care...`;
          publishUi();
          void onPersonalGardenMutationRef.current({ action: "expand" })
            .then((updatedGarden) => {
              applyPersonalGarden(runtime, updatedGarden);
              runtime.selected = null;
              runtime.statusMessage = `Parcel opened. ${updatedGarden.careBalance} Care remains.`;
            })
            .catch((error) => {
              runtime.statusMessage =
                error instanceof Error
                  ? error.message
                  : "That parcel could not be opened.";
            })
            .finally(() => {
              runtime.actionBusy = false;
              runtime.pendingAction = null;
              publishUi();
            });
          return;
        }
        runtime.statusMessage = garden?.preview
          ? "Garden Membership saves and expands this land."
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
      runtime.selected = { gridX, gridY, plantId: plant?.id };
      runtime.target =
        runtime.mode === "community" && plant
          ? getWateringApproachTarget(runtime, gridX, gridY)
          : getAdjacentTarget(runtime, gridX, gridY);
      runtime.statusMessage = plant
        ? runtime.target
          ? `Walking into watering range of the ${getPlantDefinition(plant.plant_type).name.toLowerCase()}...`
          : "Choose Water to care for the highlighted flowers."
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
        const cell = getPointerCell(event);
        if (cell) selectCell(cell.gridX, cell.gridY);
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

    function onKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
      const directions: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        w: [0, -1],
        W: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
        S: [0, 1],
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        A: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
        D: [1, 0],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const runtime = runtimeRef.current;
      const currentGridX = Math.floor(runtime.mary.x / GARDEN_CONFIG.tileSize);
      const currentGridY = Math.floor(runtime.mary.y / GARDEN_CONFIG.tileSize);
      const nextGridX = currentGridX + direction[0];
      const nextGridY = currentGridY + direction[1];
      if (!isWithinRuntime(runtime, nextGridX, nextGridY)) {
        runtime.target = null;
        runtime.statusMessage = "You have reached the garden edge.";
        publishUi();
        return;
      }
      runtime.selected = null;
      runtime.target = gridToWorld(nextGridX, nextGridY);
      runtime.statusMessage =
        runtime.mode === "personal"
          ? "Exploring My Garden..."
          : "Exploring the garden...";
      publishUi();
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
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  },
);

