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
  const bounds = getRuntimeBounds(runtime);
  const expansions = [
    ...(runtime.personalGarden.expansionCandidates ?? []),
    ...(runtime.personalGarden.nextExpansion
      ? [runtime.personalGarden.nextExpansion]
      : []),
  ];
  return expansions.reduce(
    (current, expansion) => ({
      minX: Math.min(current.minX, expansion.minX),
      maxX: Math.max(current.maxX, expansion.minX + expansion.width - 1),
      minY: Math.min(current.minY, expansion.minY),
      maxY: Math.max(current.maxY, expansion.minY + expansion.height - 1),
    }),
    bounds,
  );
}

function isWithinRuntime(runtime: Runtime, gridX: number, gridY: number) {
  if (runtime.mode === "personal") {
    return isPersonalBed(runtime, gridX, gridY);
  }
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

function getNearestPersonalGardenPosition(
  runtime: Runtime,
  point: WorldPoint,
) {
  if (
    runtime.mode !== "personal" ||
    isWithinRuntime(
      runtime,
      Math.floor(point.x / GARDEN_CONFIG.tileSize),
      Math.floor(point.y / GARDEN_CONFIG.tileSize),
    )
  ) {
    return point;
  }
  const parcels = runtime.personalGarden?.unlockedParcels ?? [];
  if (parcels.length === 0) return point;
  return parcels
    .map((parcel) => {
      const x = Math.min(
        (parcel.minX + parcel.width - 0.5) * GARDEN_CONFIG.tileSize,
        Math.max((parcel.minX + 0.5) * GARDEN_CONFIG.tileSize, point.x),
      );
      const y = Math.min(
        (parcel.minY + parcel.height - 0.5) * GARDEN_CONFIG.tileSize,
        Math.max((parcel.minY + 0.5) * GARDEN_CONFIG.tileSize, point.y),
      );
      return { x, y, distance: Math.hypot(x - point.x, y - point.y) };
    })
    .sort((left, right) => left.distance - right.distance)[0];
}

function constrainRuntimeMovement(
  runtime: Runtime,
  current: WorldPoint,
  next: WorldPoint,
) {
  const clamped = {
    x: clampRuntimeCoordinate(runtime, next.x, "x"),
    y: clampRuntimeCoordinate(runtime, next.y, "y"),
  };
  if…27535 tokens truncated…leSize * WATERING_RANGE_TILES
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
          reducedMotion: runtime.reducedMotion,
          now: Date.now(),
          mode: runtime.mode,
          communityRegions:
            runtime.mode === "community"
              ? runtime.regionManifest?.regions.map((region) => ({
                  regionX: region.regionX,
                  regionY: region.regionY,
                  isOpen: region.isOpen,
                  publicStage: region.publicStage,
                  guidanceZone: region.guidanceZone,
                }))
              : undefined,
          personalCommunityFlowers:
            runtime.mode === "community" &&
            showPersonalCommunityFlowersRef.current
              ? personalCommunityFlowersRef.current
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
                livingHabitats:
                  runtime.personalGarden.livingGardenHabitats ?? [],
                gardenJournalEnabled: !runtime.personalGarden.preview,
                gardenJournalUnreadCount: (
                  runtime.personalGarden.livingGardenDiscoveries ?? []
                ).filter((discovery) => !discovery.acknowledgedAt).length,
                unlockedParcels: runtime.personalGarden.unlockedParcels,
                expansionCandidates:
                  runtime.personalGarden.expansionCandidates,
                selectedParcel: runtime.personalGarden.selectedParcel,
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
      if (
        runtime.mode === "personal" &&
        onOpenGardenJournalRef.current &&
        gridX >= 5 &&
        gridX <= 7 &&
        gridY >= -1 &&
        gridY <= 0
      ) {
        runtime.target = null;
        runtime.path = [];
        runtime.statusMessage = "Opening your Garden Journal...";
        publishUi();
        onOpenGardenJournalRef.current();
        return;
      }
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
      runtime.cameraAnchor = null;
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
          "You found a Garden Wormâ€”the soil is especially lively here.";
        onGardenWormDiscoveredRef.current?.();
        publishUi();
        return;
      }

      if (lockedParcel) {
        const garden = runtime.personalGarden;
        const cost =
          getExpansionCandidateAt(runtime, gridX, gridY)?.careCost ?? 0;
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

    function getCanvasScreenPoint(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return null;
      return {
        x: ((clientX - bounds.left) / bounds.width) * canvas.width,
        y: ((clientY - bounds.top) / bounds.height) * canvas.height,
      };
    }

    function getPointerCell(
      event: ReactPointerEvent<HTMLCanvasElement>,
    ) {
      event.preventDefault();
      const canvas = canvasRef.current;
      const screen = getCanvasScreenPoint(event.clientX, event.clientY);
      if (!canvas || !screen) return null;
      return screenToGrid(
        screen.x,
        screen.y,
        runtimeRef.current.camera,
        { width: canvas.width, height: canvas.height },
        runtimeRef.current.zoom,
      );
    }

    function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });

      if (activePointersRef.current.size >= 2) {
        if (pointerGestureRef.current) pointerGestureRef.current.dragged = true;
        if (tutorialDimmedRef.current || runtimeRef.current.builder) return;
        const [first, second] = Array.from(
          activePointersRef.current.entries(),
        ).slice(0, 2);
        const midpoint = {
          x: (first[1].x + second[1].x) / 2,
          y: (first[1].y + second[1].y) / 2,
        };
        const screen = getCanvasScreenPoint(midpoint.x, midpoint.y);
        const viewport = getCanvasViewport();
        if (!screen || !viewport) return;
        const runtime = runtimeRef.current;
        pinchGestureRef.current = {
          pointerIds: [first[0], second[0]],
          startDistance: Math.max(
            1,
            Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y),
          ),
          startZoom: runtime.zoom,
          anchorWorld: getWorldAtScreenPoint(
            runtime.camera,
            screen,
            viewport,
            runtime.zoom,
          ),
        };
        pointerGestureRef.current = null;
        return;
      }

      pointerGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        dragged: false,
      };
    }

    function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
      const pinch = pinchGestureRef.current;
      if (pinch && pinch.pointerIds.includes(event.pointerId)) {
        event.preventDefault();
        const first = activePointersRef.current.get(pinch.pointerIds[0]);
        const second = activePointersRef.current.get(pinch.pointerIds[1]);
        if (!first || !second) return;
        const distance = Math.max(
          1,
          Math.hypot(first.x - second.x, first.y - second.y),
        );
        const midpoint = {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
        const screen = getCanvasScreenPoint(midpoint.x, midpoint.y);
        if (!screen) return;
        applyZoom(pinch.startZoom * (distance / pinch.startDistance), {
          screen,
          world: pinch.anchorWorld,
        });
        return;
      }
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
      const pinch = pinchGestureRef.current;
      activePointersRef.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (pinch && pinch.pointerIds.includes(event.pointerId)) {
        event.preventDefault();
        pinchGestureRef.current = null;
        pointerGestureRef.current = null;
        runtimeRef.current.statusMessage = "Garden view adjusted.";
        publishUi();
        return;
      }
      const gesture = pointerGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      pointerGestureRef.current = null;
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
      runtime.cameraAnchor = null;
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
      activePointersRef.current.delete(event.pointerId);
      if (pinchGestureRef.current?.pointerIds.includes(event.pointerId)) {
        pinchGestureRef.current = null;
      }
      if (pointerGestureRef.current?.pointerId === event.pointerId) {
        pointerGestureRef.current = null;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function onWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
      if (tutorialDimmedRef.current || runtimeRef.current.builder) return;
      event.preventDefault();
      const screen = getCanvasScreenPoint(event.clientX, event.clientY);
      const viewport = getCanvasViewport();
      if (!screen || !viewport) return;
      const runtime = runtimeRef.current;
      const anchorWorld = getWorldAtScreenPoint(
        runtime.camera,
        screen,
        viewport,
        runtime.zoom,
      );
      const sensitivity = event.ctrlKey ? 0.01 : 0.002;
      applyZoom(runtime.zoom * Math.exp(-event.deltaY * sensitivity), {
        screen,
        world: anchorWorld,
      });
      runtime.statusMessage = "Garden view adjusted.";
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
        onWheel={onWheel}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  },
);


