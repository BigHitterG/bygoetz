"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
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
  isMyGardenElementType,
  isMyGardenPlantType,
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
  advanceWateringSpray,
  MAX_WATERING_TARGETS,
  selectDirectionalWateringTargets,
  WATERING_TARGETS_PER_SPRAY,
} from "../lib/wateringSelection";
import {
  clearGardenWeed,
  fetchGardenSnapshot,
  fetchGardenWateringStatus,
  GardenConnectionError,
  type GardenContribution,
  type GardenMapPlant,
  type GardenWeed,
  isGardenConfigured,
  plantGardenPlant,
  waterGardenPlants,
} from "../lib/supabaseGarden";

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
  suggestWateringSpot: () => void;
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
  const maximum = axis === "x" ? bounds.maxX : bounds.max×Þ´âÚ$z{-®éÜj×"À¢“°¢'VçF–ÖRæÖ'’ç’Ò6Æ×'VçF–ÖT6ö÷&F–æFR€¢'VçF–ÖRÀ¢'VçF–ÖRæÖ'’ç’²†G’òF—7Fæ6R’¢7FWÀ¢'’"À¢“°¢'VçF–ÖRæÖ÷f–ærÒG'VS°¢'VçF–ÖRæ†4Ö÷fVBÒG'VS°¢Ð¢Ð ¢6öç7BVWVVEÆçF–ærÒVWVVEÆçF–æu&Vbæ7W'&VçC°¢–b‡VWVVEÆçF–ær’°¢–b€¢6ÖU6VÆV7FVD6VÆÂ‡'VçF–ÖRç6VÆV7FVBÂVWVVEÆçF–ær’ÇÀ¢6åVWVT6öÖ×Væ—G•ÆçB‡'VçF–ÖRÂVWVVEÆçF–ær¢’°¢VWVVEÆçF–æu&Vbæ7W'&VçBÒçVÆÃ°¢ÒVÇ6R–b‚'VçF–ÖRæ7F–öä'W7’’°¢6öç7BVWVVD7F–öå7FFRÒvWD7F–öå7FFR‡'VçF–ÖR“°¢–b€¢VWVVD7F–öå7FFRæ7F–öâÓÓÒ'ÆçB"b`¢VWVVD7F–öå7FFRæVæ&ÆV@¢’°¢VWVVEÆçF–æu&Vbæ7W'&VçBÒçVÆÃ°¢VWVTÖ–7&÷F6²‚‚’Óâfö–BW&f÷&Ô7F–öå&Vbæ7W'&VçB‚’“°¢Ð¢Ð¢Ð ¢–b‡'VçF–ÖRæÖ÷f–ær’°¢6öç7BÆ7EF‚Ò'VçF–ÖRçF…·'VçF–ÖRçF‚æÆVæwF‚ÒÓ°¢–b€¢Æ7EF‚ÇÀ¢ÖF‚æ‡—÷B‡'VçF–ÖRæÖ'’ç‚ÒÆ7EF‚ç‚Â'VçF–ÖRæÖ'’ç’ÒÆ7EF‚ç’’ãÒ ¢’°¢'VçF–ÖRçF‚çW6‚‡²ââç'VçF–ÖRæÖ'’Ò“°¢–b‡'VçF–ÖRçF‚æÆVæwF‚â#’'VçF–ÖRçF‚ç6†–gB‚“°¢Ð¢Ð ¢6öç7BGV6µF&vWBÒ'VçF–ÖRçF…´ÖF‚æÖ‚ƒÂ'VçF–ÖRçF‚æÆVæwF‚Ò‚•Òóò'VçF–ÖRæÖ'“°¢6öç7BGV6´G‚ÒGV6µF&vWBç‚Ò'VçF–ÖRæGV6²çƒ°¢6öç7BGV6´G’ÒGV6µF&vWBç’Ò'VçF–ÖRæGV6²ç“°¢6öç7BGV6´F—7Fæ6RÒÖF‚æ‡—÷B†GV6´G‚ÂGV6´G’“°¢–b†GV6´F—7Fæ6RâãR’°¢6öç7BGV6µ7FWÒÖF‚æÖ–â†GV6´F—7Fæ6RÂt$DTåô4ôäd”ræÖ÷fU7VVB¢ãR¢FVÇF6V6öæG2“°¢'VçF–ÖRæGV6²ç‚³Ò†GV6´G‚òGV6´F—7Fæ6R’¢GV6µ7FW°¢'VçF–ÖRæGV6²ç’³Ò†GV6´G’òGV6´F—7Fæ6R’¢GV6µ7FW°¢Ð ¢6öç7B6ÖW&V6RÒ'VçF–ÖRç&VGV6VDÖ÷F–öâò¢ÖF‚æÖ–âƒÂFVÇF6V6öæG2¢r“°¢'VçF–ÖRæ6ÖW&ç‚³Ò‡'VçF–ÖRæÖ'’ç‚Ò'VçF–ÖRæ6ÖW&ç‚’¢6ÖW&V6S°¢'VçF–ÖRæ6ÖW&ç’³Ò‡'VçF–ÖRæÖ'’ç’Ò'VçF–ÖRæ6ÖW&ç’’¢6ÖW&V6S°¢6öç7BvÆÄ6Æö6´æ÷rÒFFRææ÷r‚“°¢'VçF–ÖRæVffV7G2Ò'VçF–ÖRæVffV7G2æf–ÇFW"€¢†VffV7B’Óà¢vÆÄ6Æö6´æ÷rÒVffV7Bç7F'FVDBÀ¢†VffV7Bæ¶–æBÓÓÒ&6&R"ò¢VffV7Bæ¶–æBÓÓÒ'v÷&Ò"òƒ¢“’À¢“° ¢6öç7Bw&–E‚ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç‚òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢6öç7Bw&–E’ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç’òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢6öç7B6‡Væ´¶W’ÒvWD6‡Væ´¶W’†w&–E‚Âw&–E’“°¢–b†6‡Væ´¶W’ÓÒ'VçF–ÖRæÆöFVD6‡Væ´¶W’’°¢'VçF–ÖRæÆöFVD6‡Væ´¶W’Ò6‡Væ´¶W“°¢fö–BÆöEÆçG5&Vbæ7W'&VçB‚“°¢Ð ¢&VæFW$v&FVâ†7G‚Â°¢f–Ww÷'C¢²v–GFƒ¢6çf2çv–GF‚Â†V–v‡C¢6çf2æ†V–v‡BÒÀ¢6ÖW&¢'VçF–ÖRæ6ÖW&À¢¦ööÓ¢'VçF–ÖRç¦ööÒÀ¢Ö'“¢'VçF–ÖRæÖ'’À¢GV6³¢'VçF–ÖRæGV6²À¢ÆçG3¢'&’æg&öÒ‡'VçF–ÖRçÆçG2çfÇVW2‚’’À¢vVVG3¢'&’æg&öÒ‡'VçF–ÖRçvVVG2çfÇVW2‚’’À¢6VÆV7FVC¢'VçF–ÖRç6VÆV7FVBÀ¢vFW&–æuF&vWG3 ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"b`¢'VçF–ÖRç6VÆV7FVBb`¢vWDF—7Fæ6UFô6VÆÂ‡'VçF–ÖRÂ'VçF–ÖRç6VÆV7FVB’ÃÐ¢t$DTåô4ôäd”rçF–ÆU6—¦R¢tDU$”äuõ$ätUõD”ÄU0¢òvWEvFW&–æu6VÆV7F–öâ‡'VçF–ÖRÂ'VçF–ÖRç6VÆV7FVB¢ç6Æ–6R€¢À¢‡'VçF–ÖRçvFW&–æuV×6÷VçB²’ ¢tDU$”äuõD$tUE5õU%õ5$’À¢¢æÖ‚‡ÆçB’Óâ‡°¢w&–Eƒ¢ÆçBæw&–E÷‚À¢w&–E“¢ÆçBæw&–E÷’À¢ÆçD–C¢ÆçBæ–BÀ¢Ò’¢¢µÒÀ¢vFW&–æt6&U&VG•ÆçD–G3¢'VçF–ÖRçvFW&–æt6&U&VG•ÆçD–G2À¢vFW&–æt6&U7FGW4ÆöFVC¢'VçF–ÖRçvFW&–æt6&U7FGW4ÆöFVBÀ¢7VvvW7FVEÆçF–æt6VÆÃ¢'VçF–ÖRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7VvvW7FVEvFW&–æt6VÆÃ¢'VçF–ÖRç7VvvW7FVEvFW&–æt6VÆÂÀ¢v&FVåv÷&×3¢'&’æg&öÒ‡'VçF–ÖRæv&FVåv÷&×2çfÇVW2‚’’À¢GWF÷&–ÄF–ÖÖVC¢GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBÀ¢VffV7G3¢'VçF–ÖRç&VGV6VDÖ÷F–öâòµÒ¢'VçF–ÖRæVffV7G2À¢Ö÷f–æs¢'VçF–ÖRç&VGV6VDÖ÷F–öâòfÇ6R¢'VçF–ÖRæÖ÷f–ærÀ¢æ÷s¢FFRææ÷r‚’À¢ÖöFS¢'VçF–ÖRæÖöFRÀ¢W'6öæÄv&FVã¢'VçF–ÖRçW'6öæÄv&FVà¢ò°¢Ö–åƒ¢'VçF–ÖRçW'6öæÄv&FVâæÖ–å‚À¢Ö–å“¢'VçF–ÖRçW'6öæÄv&FVâæÖ–å’À¢v–GFƒ¢'VçF–ÖRçW'6öæÄv&FVâçv–GF‚À¢†V–v‡C¢'VçF–ÖRçW'6öæÄv&FVâæ†V–v‡BÀ¢Ö…v–GFƒ¢'VçF–ÖRçW'6öæÄv&FVâæÖ…v–GF‚À¢Ö„†V–v‡C¢'VçF–ÖRçW'6öæÄv&FVâæÖ„†V–v‡BÀ¢VÆVÖVçG3¢'VçF–ÖRçW'6öæÄv&FVâæVÆVÖVçG2À¢F‡3¢'VçF–ÖRçW'6öæÄv&FVâçF‡2À¢æW‡DW‡ç6–öã¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öà¢ò°¢Ö–åƒ¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öâæÖ–å‚À¢Ö–å“¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öâæÖ–å’À¢v–GFƒ¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öâçv–GF‚À¢†V–v‡C¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öâæ†V–v‡BÀ¢6&T6÷7C¢'VçF–ÖRçW'6öæÄv&FVâææW‡DW‡ç6–öâæ6&T6÷7BÀ¢Ð¢¢çVÆÂÀ¢Ð¢¢VæFVf–æVBÀ¢Ò“°¢6öç7BV•V&Æ—6„–çFW'fÂÒ'VçF–ÖRæÖ÷f–ærÇÂ'VçF–ÖRçF&vWBò¢ó°¢–b‡vÆÄ6Æö6´æ÷rÒ'VçF–ÖRæÆ7EV•V&Æ—6„BãÒV•V&Æ—6„–çFW'fÂ’°¢V&Æ—6…V’‚“°¢Ð¢g&ÖT–BÒ&WVW7Dæ–ÖF–öäg&ÖR‡F–6²“°¢Ó° ¢g&ÖT–BÒ&WVW7Dæ–ÖF–öäg&ÖR‡F–6²“°¢6öç7BöÆÄ–BÒv–æF÷rç6WD–çFW'fÂ‚‚’Óâ°¢fö–BÆöEÆçG5&Vbæ7W'&VçB‚“°¢ÒÂt$DTåô4ôäd”rçöÆÄ–çFW'fÄ×2“° ¢&WGW&â‚’Óâ°¢6æ6VÄæ–ÖF–öäg&ÖR†g&ÖT–B“°¢v–æF÷ræ6ÆV$–çFW'fÂ‡öÆÄ–B“°¢&W6—¦Tö'6W'fW#òæF—66öææV7B‚“°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚'&W6—¦R"Â66†VGVÆU&W6—¦R“°¢v–æF÷rç&VÖ÷fTWfVçDÆ—7FVæW"‚&÷&–VçFF–öæ6†ævR"Â66†VGVÆU&W6—¦R“°¢v–æF÷rçf—7VÅf–Ww÷'Còç&VÖ÷fTWfVçDÆ—7FVæW"‚'&W6—¦R"Â66†VGVÆU&W6—¦R“°¢Ó°¢ÒÂ·V&Æ—6…V•Ò“° ¢gVæ7F–öâ6VÆV7D6VÆÂ†w&–Eƒ¢çVÖ&W"Âw&–E“¢çVÖ&W"’°¢6öç7B'VçF–ÖRÒ'VçF–ÖU&Vbæ7W'&VçC°¢VWVVEÆçF–æu&Vbæ7W'&VçBÒçVÆÃ°¢6öç7B&WV—&VEGWF÷&–Ä6VÆÂÐ¢'VçF–ÖRç7VvvW7FVEÆçF–æt6VÆÂóò'VçF–ÖRç7VvvW7FVEvFW&–æt6VÆÃ°¢–b‡GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBbb&WV—&VEGWF÷&–Ä6VÆÂ’°¢'VçF–ÖRç7FGW4ÖW76vRÒ$föÆÆ÷rF†R†–v†Æ–v‡FVBv&FVâwV–FRFò6öçF–çVRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢–b€¢GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBb`¢&WV—&VEGWF÷&–Ä6VÆÂb`¢‡&WV—&VEGWF÷&–Ä6VÆÂæw&–E‚ÓÒw&–E‚ÇÀ¢&WV—&VEGWF÷&–Ä6VÆÂæw&–E’ÓÒw&–E’¢’°¢'VçF–ÖRç7FGW4ÖW76vRÒ'VçF–ÖRç7VvvW7FVEvFW&–æt6VÆÀ¢ò%FF†R†–v†Æ–v‡FVBvFW&–ær7V&RFò6öçF–çVRâ ¢¢%FF†RvÆ÷v–ærÆçB†W&RF6‚Fò6öçF–çVRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢6öç7BÆö6¶VE&6VÂÒ—4æW‡DW‡ç6–öä6VÆÂ‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢–b‚—5v—F†–å'VçF–ÖR‡'VçF–ÖRÂw&–E‚Âw&–E’’bbÆö6¶VE&6VÂ’°¢'VçF–ÖRç7FGW4ÖW76vRÒ%–÷R†fR&V6†VBF†Rv&FVâVFvRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7Bv÷&Ô¶W’ÒÆçD¶W’†w&–E‚Âw&–E’“°¢–b‡'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bb'VçF–ÖRæv&FVåv÷&×2æ†2‡v÷&Ô¶W’’’°¢'VçF–ÖRæv&FVåv÷&×2æFVÆWFR‡v÷&Ô¶W’“°¢'VçF–ÖRæVffV7G2çW6‚‡°¢¶–æC¢'v÷&Ò"À¢w&–E‚À¢w&–E’À¢7F'FVDC¢FFRææ÷r‚’À¢Ò“°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢%–÷Rf÷VæBv&FVâv÷&Þ(	GF†R6ö–Â—2W7V6–ÆÇ’Æ—fVÇ’†W&Râ#°¢öäv&FVåv÷&ÔF—66÷fW&VE&Vbæ7W'&VçCòâ‚“°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢–b†Æö6¶VE&6VÂ’°¢6öç7Bv&FVâÒ'VçF–ÖRçW'6öæÄv&FVã°¢6öç7B6÷7BÒv&FVãòææW‡DW‡ç6–öãòæ6&T6÷7Bóò°¢'VçF–ÖRç6VÆV7FVBÒ²w&–E‚Âw&–E’Ó°¢'VçF–ÖRçF&vWBÒvWDÆö6¶VE&6VÄ&ö6‚‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢–b€¢v&FVâb`¢v&FVâç&Wf–Wrb`¢v&FVâæ6&T&Ææ6RãÒ6÷7Bb`¢öåW'6öæÄv&FVä×WFF–öå&Vbæ7W'&VçBb`¢'VçF–ÖRæ7F–öä'W7¢’°¢'VçF–ÖRæ7F–öä'W7’ÒG'VS°¢'VçF–ÖRçVæF–æt7F–öâÒ&W‡æB#°¢'VçF–ÖRç7FGW4ÖW76vRÒ÷Væ–ærF†—2&6VÂf÷"G¶6÷7GÒ6&Rââæ°¢V&Æ—6…V’‚“°¢fö–BöåW'6öæÄv&FVä×WFF–öå&Vbæ7W'&VçB‡²7F–öã¢&W‡æB"Ò¢çF†Vâ‚‡WFFVDv&FVâ’Óâ°¢Ç•W'6öæÄv&FVâ‡'VçF–ÖRÂWFFVDv&FVâ“°¢'VçF–ÖRç6VÆV7FVBÒçVÆÃ°¢'VçF–ÖRç7FGW4ÖW76vRÒ&6VÂ÷VæVBâG·WFFVDv&FVâæ6&T&Ææ6WÒ6&R&VÖ–ç2æ°¢Ò¢æ6F6‚‚†W'&÷"’Óâ°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢W'&÷"–ç7Fæ6VöbW'&÷ ¢òW'&÷"æÖW76vP¢¢%F†B&6VÂ6÷VÆBæ÷B&R÷VæVBâ#°¢Ò¢æf–æÆÇ’‚‚’Óâ°¢'VçF–ÖRæ7F–öä'W7’ÒfÇ6S°¢'VçF–ÖRçVæF–æt7F–öâÒçVÆÃ°¢V&Æ—6…V’‚“°¢Ò“°¢&WGW&ã°¢Ð¢'VçF–ÖRç7FGW4ÖW76vRÒv&FVãòç&Wf–Wp¢ò$v&FVâÖVÖ&W'6†—6fW2æBW‡æG2F†—2ÆæBâ ¢¢V&âG´ÖF‚æÖ‚ƒÂ6÷7BÒ†v&FVãòæ6&T&Ææ6Róò’—ÒÖ÷&R6&RFò÷VâF†—2&6VÂæ°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7BÖ'”w&–E‚ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç‚òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢6öç7BÖ'”w&–E’ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç’òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢–b†Ö'”w&–E‚ÓÓÒw&–E‚bbÖ'”w&–E’ÓÓÒw&–E’’°¢'VçF–ÖRç7FGW4ÖW76vRÒ$Ö'’—27FæF–ærF†W&Râ6†ö÷6RæV&'’7÷Bâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7BÆçBÒvWEÆçDB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢6öç7BvVVBÒvWEvVVDB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢6öç7BæW‡EvFW&–æu6VÆV7F–öä¶W’Ð¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bbvVVBòÆçCòæ–Bóò""¢"#°¢–b€¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’b`¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’ÓÒæW‡EvFW&–æu6VÆV7F–öä¶W¢’°¢'VçF–ÖRçvFW&–æuV×6÷VçBÒ°¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’Ò"#°¢Ð¢'VçF–ÖRç6VÆV7FVBÒ²w&–E‚Âw&–E’ÂÆçD–C¢ÆçCòæ–BÂvVVD–C¢vVVCòæ–BÓ°¢6öç7BvFW&–æuF&vWG2Ð¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bbvVV@¢òvWEvFW&–æu6VÆV7F–öâ‡'VçF–ÖRÂ'VçF–ÖRç6VÆV7FVB¢¢µÓ°¢6öç7B—5vFW&–æu6VÆV7F–öâÐ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"b`¢vFW&–æuF&vWG2æÆVæwF‚â°¢6öç7BVæf–Æ&ÆUvFW&–æuÆçBÐ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"b`¢&ööÆVâ‡ÆçB’b`¢vVVBb`¢—5vFW&–æu6VÆV7F–öã°¢'VçF–ÖRçF&vWBÒ—5vFW&–æu6VÆV7F–öà¢òvWEvFW&–æt&ö6…F&vWB‡'VçF–ÖRÂw&–E‚Âw&–E’¢¢vWDF¦6VçEF&vWB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢'VçF–ÖRç7FGW4ÖW76vRÒvVV@¢ò%vÆ¶–ær÷fW"FòVÆÂF†—2vVVBâââ ¢¢—5vFW&–æu6VÆV7F–öà¢ò'VçF–ÖRçF&vW@¢ò%vÆ¶–ær–çFòvFW&–ær&ævRöbF†R†–v†Æ–v‡FVBfÆ÷vW'2âââ ¢¢vFW&–æuF&vWG2æÆVæwF‚âtDU$”äuõD$tUE5õU%õ5$¢ò$F÷V&ÆRFvFW"Fò7&’&÷F‚7G&–æw2öbfÆ÷vW'2â ¢¢%FvFW"Fò7&’F†R†–v†Æ–v‡FVBfÆ÷vW'2â ¢¢Væf–Æ&ÆUvFW&–æuÆç@¢ò%vÆ¶–ærFòF†BfÆ÷vW"âÆöö²f÷"vFW"G&÷FòV&â6&Râ ¢¢%vÆ¶–ærFòF†B7÷Bâââ#°¢V&Æ—6…V’‚“°¢Ð ¢gVæ7F–öâvWEö–çFW$6VÆÂ€¢WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâÀ¢’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7B6çf2Ò6çf5&Vbæ7W'&VçC°¢–b‚6çf2’&WGW&âçVÆÃ°¢6öç7B&÷VæG2Ò6çf2ævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢6öç7B67&VVå‚Ò‚†WfVçBæ6Æ–VçE‚Ò&÷VæG2æÆVgB’ò&÷VæG2çv–GF‚’¢6çf2çv–GFƒ°¢6öç7B67&VVå’Ò‚†WfVçBæ6Æ–VçE’Ò&÷VæG2çF÷’ò&÷VæG2æ†V–v‡B’¢6çf2æ†V–v‡C°¢&WGW&â67&VVåFôw&–B€¢67&VVå‚À¢67&VVå’À¢'VçF–ÖU&Vbæ7W'&VçBæ6ÖW&À¢²v–GFƒ¢6çf2çv–GF‚Â†V–v‡C¢6çf2æ†V–v‡BÒÀ¢'VçF–ÖU&Vbæ7W'&VçBç¦ööÒÀ¢“°¢Ð ¢gVæ7F–öâöåö–çFW$F÷vâ†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢WfVçBç&WfVçDFVfVÇB‚“°¢–b‡ö–çFW$vW7GW&U&Vbæ7W'&VçB’&WGW&ã°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒ°¢ö–çFW$–C¢WfVçBçö–çFW$–BÀ¢7F'Eƒ¢WfVçBæ6Æ–VçE‚À¢7F'E“¢WfVçBæ6Æ–VçE’À¢Æ7Eƒ¢WfVçBæ6Æ–VçE‚À¢Æ7E“¢WfVçBæ6Æ–VçE’À¢G&vvVC¢fÇ6RÀ¢Ó°¢WfVçBæ7W'&VçEF&vWBç6WEö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢WfVçBæ7W'&VçEF&vWBæfö7W2‡²&WfVçE67&öÆÃ¢G'VRÒ“°¢Ð ¢gVæ7F–öâöåö–çFW$Ö÷fR†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢6öç7BvW7GW&RÒö–çFW$vW7GW&U&Vbæ7W'&VçC°¢–b‚vW7GW&RÇÂvW7GW&Rçö–çFW$–BÓÒWfVçBçö–çFW$–B’&WGW&ã°¢WfVçBç&WfVçDFVfVÇB‚“°¢vW7GW&RæÆ7E‚ÒWfVçBæ6Æ–VçEƒ°¢vW7GW&RæÆ7E’ÒWfVçBæ6Æ–VçE“°¢–b€¢ÖF‚æ‡—÷B€¢WfVçBæ6Æ–VçE‚ÒvW7GW&Rç7F'E‚À¢WfVçBæ6Æ–VçE’ÒvW7GW&Rç7F'E’À¢’ãÒ ¢’°¢vW7GW&RæG&vvVBÒG'VS°¢Ð¢Ð ¢gVæ7F–öâöåö–çFW%W†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢6öç7BvW7GW&RÒö–çFW$vW7GW&U&Vbæ7W'&VçC°¢–b‚vW7GW&RÇÂvW7GW&Rçö–çFW$–BÓÒWfVçBçö–çFW$–B’&WGW&ã°¢WfVçBç&WfVçDFVfVÇB‚“°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢WfVçBæ7W'&VçEF&vWBç&VÆV6Uö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢6öç7B'VçF–ÖRÒ'VçF–ÖU&Vbæ7W'&VçC°¢–b‚vW7GW&RæG&vvVB’°¢6öç7B6VÆÂÒvWEö–çFW$6VÆÂ†WfVçB“°¢–b†6VÆÂ’6VÆV7D6VÆÂ†6VÆÂæw&–E‚Â6VÆÂæw&–E’“°¢&WGW&ã°¢Ð ¢6öç7Bv÷&ÆDG‚ÒÒ†WfVçBæ6Æ–VçE‚ÒvW7GW&Rç7F'E‚’ò'VçF–ÖRç¦ööÓ°¢6öç7Bv÷&ÆDG’ÒÒ†WfVçBæ6Æ–VçE’ÒvW7GW&Rç7F'E’’ò'VçF–ÖRç¦ööÓ°¢'VçF–ÖRç6VÆV7FVBÒçVÆÃ°¢'VçF–ÖRçF&vWBÒ°¢ƒ¢6Æ×'VçF–ÖT6ö÷&F–æFR‡'VçF–ÖRÂ'VçF–ÖRæÖ'’ç‚²v÷&ÆDG‚Â'‚"’À¢“¢6Æ×'VçF–ÖT6ö÷&F–æFR‡'VçF–ÖRÂ'VçF–ÖRæÖ'’ç’²v÷&ÆDG’Â'’"’À¢Ó°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢'VçF–ÖRæÖöFRÓÓÒ'W'6öæÂ ¢ò$W‡Æ÷&–ær×’v&FVââââ ¢¢$W‡Æ÷&–ærF†Rv&FVââââ#°¢V&Æ—6…V’‚“°¢Ð ¢gVæ7F–öâöåö–çFW$6æ6VÂ†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢–b‡ö–çFW$vW7GW&U&Vbæ7W'&VçCòçö–çFW$–BÓÒWfVçBçö–çFW$–B’&WGW&ã°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢–b†WfVçBæ7W'&VçEF&vWBæ†5ö–çFW$6GW&R†WfVçBçö–çFW$–B’’°¢WfVçBæ7W'&VçEF&vWBç&VÆV6Uö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢Ð¢Ð ¢&WGW&â€¢Æ6çf0¢&Vc×¶6çf5&VgÐ¢6Æ74æÖSÒ&6rÖ6çf2 ¢&öÆSÒ&Æ–6F–öâ ¢&–ÖÆ&VÃ×°¢ÖöFRÓÓÒ'W'6öæÂ ¢ò$&6–Â×’v&FVââFÆö6F–öâFòvÆ²ÂÆçBÂ÷"W&ö÷BöæRöb–÷W"fÆ÷vW'2â ¢¢$&6–Â6öÖ×Væ—G’v&FVââFÆö6F–öâFòvÆ²ÂÆçBÂ÷"vFW"fÆ÷vW"â ¢Ð¢F$–æFWƒ×³Ð¢öåö–çFW$F÷vã×¶öåö–çFW$F÷vçÐ¢öåö–çFW$Ö÷fS×¶öåö–çFW$Ö÷fWÐ¢öåö–çFW%W×¶öåö–çFW%WÐ¢öåö–çFW$6æ6VÃ×¶öåö–çFW$6æ6VÇÐ¢öä6öçFW‡DÖVçS×²†WfVçB’ÓâWfVçBç&WfVçDFVfVÇB‚—Ð¢óà¢“°¢ÒÀ¢“° Ð