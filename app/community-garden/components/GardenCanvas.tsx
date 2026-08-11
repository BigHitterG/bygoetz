"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
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
  getAdaptiveChunkLoadRadius,
  getChunkKey,
  getLoadedBounds,
} from "../lib/gardenConfig";
import { getFrameStableCameraEase } from "../lib/cameraMotion";
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
  GardenActionRejectedError,
  GardenConnectionError,
  type GardenContribution,
  type GardenMapPlant,
  type GardenGuidanceZone,
  type GardenRegionManifest,
  type GardenRegionStage,
  type GardenWeed,
  isGardenConfigured,
  plantGardenPlant,
  waterGardenPlants,
} from "../lib/supabaseGarden";
import { OCCUPIED_GARDEN_COORDINATE_REASON } from "../lib/gardenActionFailure";
import { choosePlantingSuggestion } from "../lib/plantingSuggestion";
import { snapToTutorialPlantingTarget } from "../lib/tutorialTargeting";
import type { HeritageMoment } from "../lib/heritageNotifications";
import {
  findNearbyHeritageFlower,
  type HeritageFlowerEncounter,
} from "../lib/heritageDiscovery";

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
  selectedGridX: number | null;
  selectedGridY: number | null;
  pathMapPoints: Array<{ x: number; y: number }>;
  personalMapParcels: Array<{
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fenceTop: boolean;
    fenceRight: boolean;
    fenceBottom: boolean;
    fenceLeft: boolean;
  }>;
  plantMapPoints: Array<{
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    plantType: PlantType;
    heritage: boolean;
  }>;
  regionMapCells: Array<{
    key: string;
    regionX: number;
    regionY: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    stage: GardenRegionStage;
    supportLevel: 0 | 1 | 2 | 3;
    isOpen: boolean;
    plantCount: number;
    weedCount: number;
    occupancyPercent: number;
    heritagePlantCount: number;
    guidanceZone: GardenGuidanceZone | null;
  }>;
  mapBounds: { minX: number; maxX: number; minY: number; maxY: number };
  regionSize: number;
  snapshotVersion: number;
  currentRegionStage: GardenRegionStage | null;
  currentGuidanceZone: GardenGuidanceZone | null;
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
  suggestPlantingSpot: (options?: {
    readyToPlant?: boolean;
    keepMaryInPlace?: boolean;
  }) => void;
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
  cameraAnchor: WorldPoint | null;
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
    gridX: number;
    gridY: number;
    plantType: PlantType;
    heritage: boolean;
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
  keepTutorialMaryInPlace: boolean;
  blockedTutorialPlantingCells: Set<string>;
  suggestedWateringCell: SelectedCell;
  gardenWorms: Map<string, GardenWormMarker>;
  builder: BuilderDraft | null;
  heritageEncounterPlantId: string | null;
  heritageEncounterNextCheckAt: number;
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
  cameraAnchor: WorldPoint | null;
  zoom: number;
  path: WorldPoint[];
  hasMoved: boolean;
};

type GardenCanvasProps = {
  onStateChange: (state: GardenUiState) => void;
  onCommunityContribution?: (contribution: GardenContribution) => void;
  mode: GardenWorldMode;
  accountAccessToken?: string | null;
  personalGarden: MyGardenState | null;
  personalCommunityFlowers?: Array<{
    gridX: number;
    gridY: number;
    plantId?: string;
  }>;
  showPersonalCommunityFlowers?: boolean;
  tutorialDimmed?: boolean;
  tutorialClickHere?: boolean;
  hideTutorialPlantingLabel?: boolean;
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
  onOpenGardenJournal?: () => void;
  onHeritageMoments?: (moments: HeritageMoment[]) => void;
  onHeritageEncounter?: (encounter: HeritageFlowerEncounter) => void;
  heritageEncountersEnabled?: boolean;
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
      contk½ï›h‘éì¶»§q«^w'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2ÂæW‡B“°¢–b‡&W7VÇBæ¶–æBÓÓÒ'Væ6†ævVB"’&WGW&ã°¢–b‡&W7VÇBæ¶–æBÓÓÒ'VæFò"’°¢'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2ç÷‚“°¢6öç7B†VBÐ¢'VçF–ÖRæ'V–ÆFW"æ6VÆÇ5·'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2æÆVæwF‚ÒÓ°¢'VçF–ÖRç6VÆV7FVBÒ²ââæ†VBÓ°¢'VçF–ÖRç7FGW4ÖW76vRÒ$Æ7B'V–ÆFW"7V&R&VÖ÷fVBâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢–b‡&W7VÇBæ¶–æBÓÓÒ&–çfÆ–B"’°¢'VçF–ÖRæ'V–ÆFW"æ–çfÆ–D6VÆÂÒæW‡C°¢'VçF–ÖRæ'V–ÆFW"æ–çfÆ–EVçF–ÂÒFFRææ÷r‚’²s°¢'VçF–ÖRç7FGW4ÖW76vRÒ&W7VÇBç&V6öã°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢–b‚6åW6T'V–ÆFW$6VÆÂ‡'VçF–ÖRÂ'VçF–ÖRæ'V–ÆFW"ÂæW‡B’’°¢'VçF–ÖRæ'V–ÆFW"æ–çfÆ–D6VÆÂÒæW‡C°¢'VçF–ÖRæ'V–ÆFW"æ–çfÆ–EVçF–ÂÒFFRææ÷r‚’²s°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢'VçF–ÖRæ'V–ÆFW"æÖöFRÓÓÒ'Æ6R ¢ò%F†B'V–ÆFW"7V&R×W7B&RV×G’æB–ç6–FRF†RfVæ6Râ ¢¢%F†B7V&RFöW2æ÷B6öçF–âF†R6ÖR¶–æBöböæR×F–ÆR—FVÒâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2çW6‚†æW‡B“°¢'VçF–ÖRæ'V–ÆFW"æ–çfÆ–D6VÆÂÒçVÆÃ°¢'VçF–ÖRç6VÆV7FVBÒ²ââææW‡BÓ°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2æÆVæwF‚ÓÓÒÕ•ôt$DTåô%T”ÄDU%ôÔ…õD”ÄU0¢ò%7G&–ærgVÆÂâ'V–ÆBF†W6R7V&W2÷"VæFòöæRâ ¢¢G·'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2æÆVæwF‡Ò7V&W2&VG’âFBæ÷F†W"÷"'V–ÆBæ÷ræ°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢6öç7B&WV—&VEGWF÷&–Ä6VÆÂÐ¢'VçF–ÖRç7VvvW7FVEÆçF–æt6VÆÂóò'VçF–ÖRç7VvvW7FVEvFW&–æt6VÆÃ°¢–b‡GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBbb&WV—&VEGWF÷&–Ä6VÆÂ’°¢'VçF–ÖRç7FGW4ÖW76vRÒ$föÆÆ÷rF†R†–v†Æ–v‡FVBv&FVâwV–FRFò6öçF–çVRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢–b€¢GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBb`¢&WV—&VEGWF÷&–Ä6VÆÂb`¢‡&WV—&VEGWF÷&–Ä6VÆÂæw&–E‚ÓÒw&–E‚ÇÀ¢&WV—&VEGWF÷&–Ä6VÆÂæw&–E’ÓÒw&–E’¢’°¢'VçF–ÖRç7FGW4ÖW76vRÒ'VçF–ÖRç7VvvW7FVEvFW&–æt6VÆÀ¢ò%FF†R†–v†Æ–v‡FVBvFW&–ær7V&RFò6öçF–çVRâ ¢¢%FF†RvÆ÷v–ærÆçB†W&RF6‚Fò6öçF–çVRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢'VçF–ÖRæ6ÖW&æ6†÷"ÒçVÆÃ°¢6öç7BÆö6¶VE&6VÂÒ—4æW‡DW‡ç6–öä6VÆÂ‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢6öç7BÆö6¶VD6öÖ×Væ—G•&Vv–öâÐ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’ ¢ò'VçF–ÖRç&Vv–öäÖæ–fW7Còç&Vv–öç2æf–æB€¢‡&Vv–öâ’Óà¢&Vv–öâæ—4÷Vâb`¢&Vv–öâçV&Æ–57FvRÓÒ'v–ÆB"b`¢w&–E‚ãÒ&Vv–öâæ&÷VæG2æÖ–å‚b`¢w&–E‚ÃÒ&Vv–öâæ&÷VæG2æÖ…‚b`¢w&–E’ãÒ&Vv–öâæ&÷VæG2æÖ–å’b`¢w&–E’ÃÒ&Vv–öâæ&÷VæG2æÖ…’À¢¢¢çVÆÃ°¢–b‚—5v—F†–å'VçF–ÖR‡'VçF–ÖRÂw&–E‚Âw&–E’’bbÆö6¶VE&6VÂ’°¢'VçF–ÖRç7FGW4ÖW76vRÒÆö6¶VD6öÖ×Væ—G•&Vv–öà¢ò%F†—2w&÷v–ærVFvRÆæB—2Æö6¶VBf÷"æ÷râv&FVâöâF†R÷Vâ6–FRöbF†R&÷VæF'’â ¢¢%–÷R†fR&V6†VBF†Rv&FVâVFvRâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7Bv÷&Ô¶W’ÒÆçD¶W’†w&–E‚Âw&–E’“°¢–b‡'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bb'VçF–ÖRæv&FVåv÷&×2æ†2‡v÷&Ô¶W’’’°¢'VçF–ÖRæv&FVåv÷&×2æFVÆWFR‡v÷&Ô¶W’“°¢'VçF–ÖRæVffV7G2çW6‚‡°¢¶–æC¢'v÷&Ò"À¢w&–E‚À¢w&–E’À¢7F'FVDC¢FFRææ÷r‚’À¢Ò“°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢%–÷Rf÷VæBv&FVâv÷&Þ(	GF†R6ö–Â—2W7V6–ÆÇ’Æ—fVÇ’†W&Râ#°¢öäv&FVåv÷&ÔF—66÷fW&VE&Vbæ7W'&VçCòâ‚“°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢–b†Æö6¶VE&6VÂ’°¢6öç7Bv&FVâÒ'VçF–ÖRçW'6öæÄv&FVã°¢6öç7B6÷7BÐ¢vWDW‡ç6–öä6æF–FFTB‡'VçF–ÖRÂw&–E‚Âw&–E’“òæ6&T6÷7Bóò°¢'VçF–ÖRç6VÆV7FVBÒ²w&–E‚Âw&–E’Ó°¢'VçF–ÖRçF&vWBÒvWDÆö6¶VE&6VÄ&ö6‚‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢'VçF–ÖRç7FGW4ÖW76vRÒv&FVãòç&Wf–Wp¢ò$v&FVâÖVÖ&W'6†—6fW2æBW‡æG2F†—2ÆæBâ ¢¢†v&FVãòæ6&T&Ææ6Róò’ãÒ6÷7@¢òÆæB6VÆV7FVBâ6öæf—&Ò&VÆ÷rFòVæÆö6²—Bf÷"G¶6÷7GÒ6&Ræ ¢¢V&âG´ÖF‚æÖ‚ƒÂ6÷7BÒ†v&FVãòæ6&T&Ææ6Róò’—ÒÖ÷&R6&RFò÷VâF†—2ÆæBæ°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7BÖ'”w&–E‚ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç‚òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢6öç7BÖ'”w&–E’ÒÖF‚æfÆö÷"‡'VçF–ÖRæÖ'’ç’òt$DTåô4ôäd”rçF–ÆU6—¦R“°¢–b†Ö'”w&–E‚ÓÓÒw&–E‚bbÖ'”w&–E’ÓÓÒw&–E’’°¢'VçF–ÖRç7FGW4ÖW76vRÒ$Ö'’—27FæF–ærF†W&Râ6†ö÷6RæV&'’7÷Bâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7BÆçBÒvWEÆçDB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢6öç7BvVVBÒvWEvVVDB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢6öç7BæW‡EvFW&–æu6VÆV7F–öä¶W’Ð¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bbvVVBòÆçCòæ–Bóò""¢"#°¢–b€¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’b`¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’ÓÒæW‡EvFW&–æu6VÆV7F–öä¶W¢’°¢'VçF–ÖRçvFW&–æuV×6÷VçBÒ°¢'VçF–ÖRçvFW&–æuV×6VÆV7F–öä¶W’Ò"#°¢Ð¢'VçF–ÖRç6VÆV7FVBÒ²w&–E‚Âw&–E’ÂÆçD–C¢ÆçCòæ–BÂvVVD–C¢vVVCòæ–BÓ°¢6öç7BvFW&–æuF&vWG2Ð¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"bbvVV@¢òvWEvFW&–æu6VÆV7F–öâ‡'VçF–ÖRÂ'VçF–ÖRç6VÆV7FVB¢¢µÓ°¢6öç7B—5vFW&–æu6VÆV7F–öâÐ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"b`¢vFW&–æuF&vWG2æÆVæwF‚â°¢6öç7BVæf–Æ&ÆUvFW&–æuÆçBÐ¢'VçF–ÖRæÖöFRÓÓÒ&6öÖ×Væ—G’"b`¢&ööÆVâ‡ÆçB’b`¢vVVBb`¢—5vFW&–æu6VÆV7F–öã°¢'VçF–ÖRçF&vWBÒ—5vFW&–æu6VÆV7F–öà¢òvWEvFW&–æt&ö6…F&vWB‡'VçF–ÖRÂw&–E‚Âw&–E’¢¢vWDF¦6VçEF&vWB‡'VçF–ÖRÂw&–E‚Âw&–E’“°¢'VçF–ÖRç7FGW4ÖW76vRÒvVV@¢ò%vÆ¶–ær÷fW"FòVÆÂF†—2vVVBâââ ¢¢—5vFW&–æu6VÆV7F–öà¢ò'VçF–ÖRçF&vW@¢ò%vÆ¶–ær–çFòvFW&–ær&ævRöbF†R†–v†Æ–v‡FVBfÆ÷vW'2âââ ¢¢vFW&–æuF&vWG2æÆVæwF‚âtDU$”äuõD$tUE5õU%õ5$¢ò$F÷V&ÆRFvFW"Fò7&’&÷F‚7G&–æw2öbfÆ÷vW'2â ¢¢%FvFW"Fò7&’F†R†–v†Æ–v‡FVBfÆ÷vW'2â ¢¢Væf–Æ&ÆUvFW&–æuÆç@¢ò%vÆ¶–ærFòF†BfÆ÷vW"âÆöö²f÷"vFW"G&÷FòV&â6&Râ ¢¢%vÆ¶–ærFòF†B7÷Bâââ#°¢V&Æ—6…V’‚“°¢Ð ¢gVæ7F–öâvWD6çf567&VVåö–çB†6Æ–VçEƒ¢çVÖ&W"Â6Æ–VçE“¢çVÖ&W"’°¢6öç7B6çf2Ò6çf5&Vbæ7W'&VçC°¢–b‚6çf2’&WGW&âçVÆÃ°¢6öç7B&÷VæG2Ò6çf2ævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢–b†&÷VæG2çv–GF‚ÃÒÇÂ&÷VæG2æ†V–v‡BÃÒ’&WGW&âçVÆÃ°¢&WGW&â°¢ƒ¢‚†6Æ–VçE‚Ò&÷VæG2æÆVgB’ò&÷VæG2çv–GF‚’¢6çf2çv–GF‚À¢“¢‚†6Æ–VçE’Ò&÷VæG2çF÷’ò&÷VæG2æ†V–v‡B’¢6çf2æ†V–v‡BÀ¢Ó°¢Ð ¢gVæ7F–öâvWEö–çFW$6VÆÂ€¢WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâÀ¢’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7B6çf2Ò6çf5&Vbæ7W'&VçC°¢6öç7B67&VVâÒvWD6çf567&VVåö–çB†WfVçBæ6Æ–VçE‚ÂWfVçBæ6Æ–VçE’“°¢–b‚6çf2ÇÂ67&VVâ’&WGW&âçVÆÃ°¢&WGW&â67&VVåFôw&–B€¢67&VVâç‚À¢67&VVâç’À¢'VçF–ÖU&Vbæ7W'&VçBæ6ÖW&À¢²v–GFƒ¢6çf2çv–GF‚Â†V–v‡C¢6çf2æ†V–v‡BÒÀ¢'VçF–ÖU&Vbæ7W'&VçBç¦ööÒÀ¢“°¢Ð ¢gVæ7F–öâöåö–çFW$F÷vâ†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢WfVçBç&WfVçDFVfVÇB‚“°¢7F—fUö–çFW'5&Vbæ7W'&VçBç6WB†WfVçBçö–çFW$–BÂ°¢ƒ¢WfVçBæ6Æ–VçE‚À¢“¢WfVçBæ6Æ–VçE’À¢Ò“°¢WfVçBæ7W'&VçEF&vWBç6WEö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢WfVçBæ7W'&VçEF&vWBæfö7W2‡²&WfVçE67&öÆÃ¢G'VRÒ“° ¢–b†7F—fUö–çFW'5&Vbæ7W'&VçBç6—¦RãÒ"’°¢–b‡ö–çFW$vW7GW&U&Vbæ7W'&VçB’ö–çFW$vW7GW&U&Vbæ7W'&VçBæG&vvVBÒG'VS°¢–b‡GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBÇÂ'VçF–ÖU&Vbæ7W'&VçBæ'V–ÆFW"’&WGW&ã°¢6öç7B¶f—'7BÂ6V6öæEÒÒ'&’æg&öÒ€¢7F—fUö–çFW'5&Vbæ7W'&VçBæVçG&–W2‚’À¢’ç6Æ–6RƒÂ"“°¢6öç7BÖ–Gö–çBÒ°¢ƒ¢†f—'7E³Òç‚²6V6öæE³Òç‚’ò"À¢“¢†f—'7E³Òç’²6V6öæE³Òç’’ò"À¢Ó°¢6öç7B67&VVâÒvWD6çf567&VVåö–çB†Ö–Gö–çBç‚ÂÖ–Gö–çBç’“°¢6öç7Bf–Ww÷'BÒvWD6çf5f–Ww÷'B‚“°¢–b‚67&VVâÇÂf–Ww÷'B’&WGW&ã°¢6öç7B'VçF–ÖRÒ'VçF–ÖU&Vbæ7W'&VçC°¢–æ6„vW7GW&U&Vbæ7W'&VçBÒ°¢ö–çFW$–G3¢¶f—'7E³ÒÂ6V6öæE³ÕÒÀ¢7F'DF—7Fæ6S¢ÖF‚æÖ‚€¢À¢ÖF‚æ‡—÷B†f—'7E³Òç‚Ò6V6öæE³Òç‚Âf—'7E³Òç’Ò6V6öæE³Òç’’À¢’À¢7F'E¦ööÓ¢'VçF–ÖRç¦ööÒÀ¢æ6†÷%v÷&ÆC¢vWEv÷&ÆDE67&VVåö–çB€¢'VçF–ÖRæ6ÖW&À¢67&VVâÀ¢f–Ww÷'BÀ¢'VçF–ÖRç¦ööÒÀ¢’À¢Ó°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢&WGW&ã°¢Ð ¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒ°¢ö–çFW$–C¢WfVçBçö–çFW$–BÀ¢7F'Eƒ¢WfVçBæ6Æ–VçE‚À¢7F'E“¢WfVçBæ6Æ–VçE’À¢Æ7Eƒ¢WfVçBæ6Æ–VçE‚À¢Æ7E“¢WfVçBæ6Æ–VçE’À¢G&vvVC¢fÇ6RÀ¢Ó°¢Ð ¢gVæ7F–öâöåö–çFW$Ö÷fR†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢–b†7F—fUö–çFW'5&Vbæ7W'&VçBæ†2†WfVçBçö–çFW$–B’’°¢7F—fUö–çFW'5&Vbæ7W'&VçBç6WB†WfVçBçö–çFW$–BÂ°¢ƒ¢WfVçBæ6Æ–VçE‚À¢“¢WfVçBæ6Æ–VçE’À¢Ò“°¢Ð¢6öç7B–æ6‚Ò–æ6„vW7GW&U&Vbæ7W'&VçC°¢–b‡–æ6‚bb–æ6‚çö–çFW$–G2æ–æ6ÇVFW2†WfVçBçö–çFW$–B’’°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7Bf—'7BÒ7F—fUö–çFW'5&Vbæ7W'&VçBævWB‡–æ6‚çö–çFW$–G5³Ò“°¢6öç7B6V6öæBÒ7F—fUö–çFW'5&Vbæ7W'&VçBævWB‡–æ6‚çö–çFW$–G5³Ò“°¢–b‚f—'7BÇÂ6V6öæB’&WGW&ã°¢6öç7BF—7Fæ6RÒÖF‚æÖ‚€¢À¢ÖF‚æ‡—÷B†f—'7Bç‚Ò6V6öæBç‚Âf—'7Bç’Ò6V6öæBç’’À¢“°¢6öç7BÖ–Gö–çBÒ°¢ƒ¢†f—'7Bç‚²6V6öæBç‚’ò"À¢“¢†f—'7Bç’²6V6öæBç’’ò"À¢Ó°¢6öç7B67&VVâÒvWD6çf567&VVåö–çB†Ö–Gö–çBç‚ÂÖ–Gö–çBç’“°¢–b‚67&VVâ’&WGW&ã°¢Ç•¦ööÒ‡–æ6‚ç7F'E¦ööÒ¢†F—7Fæ6Rò–æ6‚ç7F'DF—7Fæ6R’Â°¢67&VVâÀ¢v÷&ÆC¢–æ6‚ææ6†÷%v÷&ÆBÀ¢Ò“°¢&WGW&ã°¢Ð¢6öç7BvW7GW&RÒö–çFW$vW7GW&U&Vbæ7W'&VçC°¢–b‚vW7GW&RÇÂvW7GW&Rçö–çFW$–BÓÒWfVçBçö–çFW$–B’&WGW&ã°¢WfVçBç&WfVçDFVfVÇB‚“°¢vW7GW&RæÆ7E‚ÒWfVçBæ6Æ–VçEƒ°¢vW7GW&RæÆ7E’ÒWfVçBæ6Æ–VçE“°¢–b€¢ÖF‚æ‡—÷B€¢WfVçBæ6Æ–VçE‚ÒvW7GW&Rç7F'E‚À¢WfVçBæ6Æ–VçE’ÒvW7GW&Rç7F'E’À¢’ãÒ ¢’°¢vW7GW&RæG&vvVBÒG'VS°¢Ð¢Ð ¢gVæ7F–öâöåö–çFW%W†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢6öç7B–æ6‚Ò–æ6„vW7GW&U&Vbæ7W'&VçC°¢7F—fUö–çFW'5&Vbæ7W'&VçBæFVÆWFR†WfVçBçö–çFW$–B“°¢–b†WfVçBæ7W'&VçEF&vWBæ†5ö–çFW$6GW&R†WfVçBçö–çFW$–B’’°¢WfVçBæ7W'&VçEF&vWBç&VÆV6Uö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢Ð¢–b‡–æ6‚bb–æ6‚çö–çFW$–G2æ–æ6ÇVFW2†WfVçBçö–çFW$–B’’°¢WfVçBç&WfVçDFVfVÇB‚“°¢–æ6„vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢'VçF–ÖU&Vbæ7W'&VçBç7FGW4ÖW76vRÒ$v&FVâf–WrF§W7FVBâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð¢6öç7BvW7GW&RÒö–çFW$vW7GW&U&Vbæ7W'&VçC°¢–b‚vW7GW&RÇÂvW7GW&Rçö–çFW$–BÓÒWfVçBçö–çFW$–B’&WGW&ã°¢WfVçBç&WfVçDFVfVÇB‚“°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢6öç7B'VçF–ÖRÒ'VçF–ÖU&Vbæ7W'&VçC°¢–b‚vW7GW&RæG&vvVB’°¢–b‡'VçF–ÖRæ'V–ÆFW"’°¢6öç7B&÷VæG2ÒWfVçBæ7W'&VçEF&vWBævWD&÷VæF–æt6Æ–VçE&V7B‚“°¢6öç7B†VBÐ¢'VçF–ÖRæ'V–ÆFW"æ6VÆÇ5·'VçF–ÖRæ'V–ÆFW"æ6VÆÇ2æÆVæwF‚ÒÓ°¢6öç7BæW‡BÒvWD'V–ÆFW$F—&V7F–öæÄ6VÆÂ††VBÂ°¢ƒ¢WfVçBæ6Æ–VçE‚Ò&÷VæG2æÆVgBÀ¢“¢WfVçBæ6Æ–VçE’Ò&÷VæG2çF÷À¢v–GFƒ¢&÷VæG2çv–GF‚À¢†V–v‡C¢&÷VæG2æ†V–v‡BÀ¢Ò“°¢6VÆV7D6VÆÂ†æW‡Bæw&–E‚ÂæW‡Bæw&–E’“°¢&WGW&ã°¢Ð¢6öç7B6VÆÂÒvWEö–çFW$6VÆÂ†WfVçB“°¢–b†6VÆÂ’6VÆV7D6VÆÂ†6VÆÂæw&–E‚Â6VÆÂæw&–E’“°¢&WGW&ã°¢Ð ¢–b‡GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçB’°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢$f–æ—6‚F†R†–v†Æ–v‡FVBv&FVâ7FW&Vf÷&RW‡Æ÷&–ærâ#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢–b‡'VçF–ÖRæ'V–ÆFW"’°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢$'V–ÆFW"ÖöFR—27F—fRâFæV–v†&÷&–ær7V&W2÷"6Æ÷6R'V–ÆFW"â#°¢V&Æ—6…V’‚“°¢&WGW&ã°¢Ð ¢6öç7Bv÷&ÆDG‚ÒÒ†WfVçBæ6Æ–VçE‚ÒvW7GW&Rç7F'E‚’ò'VçF–ÖRç¦ööÓ°¢6öç7Bv÷&ÆDG’ÒÒ†WfVçBæ6Æ–VçE’ÒvW7GW&Rç7F'E’’ò'VçF–ÖRç¦ööÓ°¢'VçF–ÖRç6VÆV7FVBÒçVÆÃ°¢'VçF–ÖRæ6ÖW&æ6†÷"ÒçVÆÃ°¢6öç7B&WVW7FVEF&vWBÒ°¢ƒ¢6Æ×'VçF–ÖT6ö÷&F–æFR‡'VçF–ÖRÂ'VçF–ÖRæÖ'’ç‚²v÷&ÆDG‚Â'‚"’À¢“¢6Æ×'VçF–ÖT6ö÷&F–æFR‡'VçF–ÖRÂ'VçF–ÖRæÖ'’ç’²v÷&ÆDG’Â'’"’À¢Ó°¢6öç7B&V6†&ÆUF&vWBÐ¢'VçF–ÖRæÖöFRÓÓÒ'W'6öæÂ ¢òvWDæV&W7EW'6öæÄv&FVå÷6—F–öâ‡'VçF–ÖRÂ&WVW7FVEF&vWB¢¢&WVW7FVEF&vWC°¢'VçF–ÖRçF&vWBÒ²ƒ¢&V6†&ÆUF&vWBç‚Â“¢&V6†&ÆUF&vWBç’Ó°¢'VçF–ÖRç7FGW4ÖW76vRÐ¢'VçF–ÖRæÖöFRÓÓÒ'W'6öæÂ ¢ò$W‡Æ÷&–ær×’v&FVââââ ¢¢$W‡Æ÷&–ærF†Rv&FVââââ#°¢V&Æ—6…V’‚“°¢Ð ¢gVæ7F–öâöåö–çFW$6æ6VÂ†WfVçC¢&V7Eö–çFW$WfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢7F—fUö–çFW'5&Vbæ7W'&VçBæFVÆWFR†WfVçBçö–çFW$–B“°¢–b‡–æ6„vW7GW&U&Vbæ7W'&VçCòçö–çFW$–G2æ–æ6ÇVFW2†WfVçBçö–çFW$–B’’°¢–æ6„vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢Ð¢–b‡ö–çFW$vW7GW&U&Vbæ7W'&VçCòçö–çFW$–BÓÓÒWfVçBçö–çFW$–B’°¢ö–çFW$vW7GW&U&Vbæ7W'&VçBÒçVÆÃ°¢Ð¢–b†WfVçBæ7W'&VçEF&vWBæ†5ö–çFW$6GW&R†WfVçBçö–çFW$–B’’°¢WfVçBæ7W'&VçEF&vWBç&VÆV6Uö–çFW$6GW&R†WfVçBçö–çFW$–B“°¢Ð¢Ð ¢gVæ7F–öâöåv†VVÂ†WfVçC¢&V7Ev†VVÄWfVçCÄ…DÔÄ6çf4VÆVÖVçCâ’°¢–b‡GWF÷&–ÄF–ÖÖVE&Vbæ7W'&VçBÇÂ'VçF–ÖU&Vbæ7W'&VçBæ'V–ÆFW"’&WGW&ã°¢WfVçBç&WfVçDFVfVÇB‚“°¢6öç7B67&VVâÒvWD6çf567&VVåö–çB†WfVçBæ6Æ–VçE‚ÂWfVçBæ6Æ–VçE’“°¢6öç7Bf–Ww÷'BÒvWD6çf5f–Ww÷'B‚“°¢–b‚67&VVâÇÂf–Ww÷'B’&WGW&ã°¢6öç7B'VçF–ÖRÒ'VçF–ÖU&Vbæ7W'&VçC°¢6öç7Bæ6†÷%v÷&ÆBÒvWEv÷&ÆDE67&VVåö–çB€¢'VçF–ÖRæ6ÖW&À¢67&VVâÀ¢f–Ww÷'BÀ¢'VçF–ÖRç¦ööÒÀ¢“°¢6öç7B6Vç6—F—f—G’ÒWfVçBæ7G&Ä¶W’òã¢ã#°¢Ç•¦ööÒ‡'VçF–ÖRç¦ööÒ¢ÖF‚æW‡‚ÖWfVçBæFVÇF’¢6Vç6—F—f—G’’Â°¢67&VVâÀ¢v÷&ÆC¢æ6†÷%v÷&ÆBÀ¢Ò“°¢'VçF–ÖRç7FGW4ÖW76vRÒ$v&FVâf–WrF§W7FVBâ#°¢Ð ¢&WGW&â€¢Æ6çf0¢&Vc×¶6çf5&VgÐ¢6Æ74æÖSÒ&6rÖ6çf2 ¢&öÆSÒ&Æ–6F–öâ ¢&–ÖÆ&VÃ×°¢ÖöFRÓÓÒ'W'6öæÂ ¢ò$&6–Â×’v&FVââFÆö6F–öâFòvÆ²ÂÆçBÂ÷"W&ö÷BöæRöb–÷W"fÆ÷vW'2â ¢¢$&6–Â6öÖ×Væ—G’v&FVââFÆö6F–öâFòvÆ²ÂÆçBÂ÷"vFW"fÆ÷vW"â ¢Ð¢F$–æFWƒ×³Ð¢öåö–çFW$F÷vã×¶öåö–çFW$F÷vçÐ¢öåö–çFW$Ö÷fS×¶öåö–çFW$Ö÷fWÐ¢öåö–çFW%W×¶öåö–çFW%WÐ¢öåö–çFW$6æ6VÃ×¶öåö–çFW$6æ6VÇÐ¢öåv†VVÃ×¶öåv†VVÇÐ¢öä6öçFW‡DÖVçS×²†WfVçB’ÓâWfVçBç&WfVçDFVfVÇB‚—Ð¢óà¢“°¢ÒÀ¢“° Ð 