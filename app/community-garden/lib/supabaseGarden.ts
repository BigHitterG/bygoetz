import {
  PLANT_TYPES,
  type CommunityPlantType,
  type PlantRecord,
} from "./roseLifecycle";
import type { GardenBounds } from "./gardenConfig";
import { MAX_WATERING_TARGETS } from "./wateringSelection";
import {
  parseHeritageMoments,
  type HeritageMoment,
} from "./heritageNotifications";

export type GardenMapPlant = Pick<
  PlantRecord,
  "grid_x" | "grid_y" | "plant_type" | "heritage_at"
>;
export type GardenWeed = {
  id: string;
  grid_x: number;
  grid_y: number;
  spawned_at: string;
};
export type GardenContribution = {
  action: "plant" | "water" | "weed";
  receiptToken?: string;
  careValue: number;
  specialFlower?: boolean;
  gardenWorm?: boolean;
  earningPhase: "daily" | "open" | "full" | "taper4" | "taper20";
  dailyCareEarned: number;
  dailyCareLimit: number | null;
  tierProgress: number;
  actionsRequired: number;
};
export type GardenSnapshot = {
  version: number;
  generatedAt: string;
  nextRefreshAt: string;
  plantCount: number;
  plants: PlantRecord[];
  weeds: GardenWeed[];
  spawnPoints: Array<{ gridX: number; gridY: number }>;
};
export type GardenRegionBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};
export type GardenRegionStage =
  | "garden"
  | "edge"
  | "growing"
  | "ready"
  | "new"
  | "resting"
  | "wild";
export type GardenGuidanceZone = "garden" | "heart" | "growth-ring";
export type GardenRegionSummary = {
  regionKey: string;
  regionX: number;
  regionY: number;
  bounds: GardenRegionBounds;
  publicStage: GardenRegionStage;
  supportLevel: 0 | 1 | 2 | 3;
  isOpen: boolean;
  newlyOpened: boolean;
  plantCount: number;
  heritagePlantCount: number;
  weedCount: number;
  occupancyPercent: number;
  guidanceZone: GardenGuidanceZone | null;
};
export type GardenRegionManifest = {
  snapshotVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  regionSize: number;
  worldBounds: GardenRegionBounds;
  mapBounds: GardenRegionBounds;
  regions: GardenRegionSummary[];
  zonePlan: {
    formulaVersion: number;
    evaluatedOn: string;
    source: "daily-frontier" | "snapshot-fallback";
    heartRegions: number;
    growthRingRegions: number;
  } | null;
  spawnPoints: Array<{ gridX: number; gridY: number }>;
};
export type GardenRegionWindow = {
  snapshotVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  centerRegionX: number;
  centerRegionY: number;
  radius: number;
  loadedRegionKeys: string[];
  plants: PlantRecord[];
  weeds: GardenWeed[];
};

type GardenActionResult = {
  plant: PlantRecord;
  plants: PlantRecord[];
  wateringClaimedPlantIds: string[];
  heritagePlantIds: string[];
  heritageMoments: HeritageMoment[];
  contribution: GardenContribution | null;
};

export type GardenWateringStatus = {
  checkedAt: string;
  readyPlantIds: string[];
};

const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
const GARDEN_REQUEST_TIMEOUT_MS = 10_000;
const GARDEN_ACTION_ATTEMPTS = 2;

export class GardenConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GardenConnectionError";
  }
}

export function isGardenConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function normalizePlant(value: Record<string, unknown>): PlantRecord {
  const plantType = PLANT_TYPES.includes(value.plant_type as CommunityPlantType)
    ? (value.plant_type as CommunityPlantType)
    : "rose";
  return { ...value, plant_type: plantType } as PlantRecord;
}

async function responseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeBounds(value: unknown): GardenRegionBounds | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const minX = Number(candidate.minX);
  const maxX = Number(candidate.maxX);
  const minY = Number(candidate.minY);
  const maxY = Number(candidate.maxY);
  return [minX, maxX, minY, maxY].every(Number.isSafeInteger) &&
    minX <= maxX &&
    minY <= maxY
    ? { minX, maxX, minY, maxY }
    : null;
}

function normalizeSpawnPoints(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((point) => {
        if (!point || typeof point !== "object") return [];
        const candidate = point as Record<string, unknown>;
        const gridX = Number(candidate.gridX);
        const gridY = Number(candidate.gridY);
        return Number.isInteger(gridX) && Number.isInteger(gridY)
          ? [{ gridX, gridY }]
          : [];
      })
    : [];
}

function normalizeWeeds(value: unknown, generatedAt: unknown) {
  return Array.isArray(value)
    ? value.flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const weed = candidate as Record<string, unknown>;
        const gridX = Number(weed.grid_x);
        const gridY = Number(weed.grid_y);
        if (
          typeof weed.id !== "string" ||
          !Number.isInteger(gridX) ||
          !Number.isInteger(gridY)
        ) {
          return [];
        }
        return [{
          id: weed.id,
          grid_x: gridX,
          grid_y: gridY,
          spawned_at: String(weed.spawned_at ?? generatedAt),
        }];
      })
    : [];
}

export async function fetchGardenRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = GARDEN_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function createActionId() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function getCurrentSnapshotVersion(now = Date.now()) {
  return Math.floor(now / SNAPSHOT_INTERVAL_MS);
}

export async function fetchGardenSnapshot(): Promise<GardenSnapshot> {
  const version = getCurrentSnapshotVersion();
  let response: Response;
  try {
    response = await fetchGardenRequest(
      `/api/community-garden/snapshot?version=${version}`,
      { cache: "force-cache" },
    );
  } catch (error) {
    throw new GardenConnectionError(
      isAbortError(error)
        ? "The shared garden took too long to refresh. It will try again shortly."
        : "The shared garden connection was interrupted.",
    );
  }
  if (!response.ok) {
    throw new Error(
      await responseError(response, "The shared garden could not refresh."),
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  const plants = Array.isArray(data.plants)
    ? data.plants
        .filter(
          (plant): plant is Record<string, unknown> =>
            Boolean(plant) && typeof plant === "object",
        )
        .map(normalizePlant)
    : [];
  const spawnPoints = normalizeSpawnPoints(data.spawnPoints);
  const weeds = normalizeWeeds(data.weeds, data.generatedAt);
  return {
    version: Number(data.version),
    generatedAt: String(data.generatedAt),
    nextRefreshAt: String(data.nextRefreshAt),
    plantCount: Number(data.plantCount ?? plants.length),
    plants,
    weeds,
    spawnPoints,
  };
}

export async function fetchGardenRegionManifest(): Promise<GardenRegionManifest> {
  const version = getCurrentSnapshotVersion();
  let response: Response;
  try {
    response = await fetchGardenRequest(
      `/api/community-garden/regions/manifest?version=${version}`,
      { cache: "force-cache" },
    );
  } catch (error) {
    throw new GardenConnectionError(
      isAbortError(error)
        ? "The garden map took too long to refresh."
        : "The garden map connection was interrupted.",
    );
  }
  if (!response.ok) {
    throw new Error(await responseError(response, "The garden map could not refresh."));
  }
  const data = (await response.json()) as Record<string, unknown>;
  const worldBounds = normalizeBounds(data.worldBounds);
  const mapBounds = normalizeBounds(data.mapBounds) ?? worldBounds;
  if (!worldBounds || !mapBounds) {
    throw new Error("The garden map returned invalid boundaries.");
  }
  const stages = new Set<GardenRegionStage>([
    "garden",
    "edge",
    "growing",
    "ready",
    "new",
    "resting",
    "wild",
  ]);
  const guidanceZones = new Set<GardenGuidanceZone>([
    "garden",
    "heart",
    "growth-ring",
  ]);
  const regions = Array.isArray(data.regions)
    ? data.regions.flatMap((value): GardenRegionSummary[] => {
        if (!value || typeof value !== "object") return [];
        const region = value as Record<string, unknown>;
        const bounds = normalizeBounds(region.bounds);
        const regionX = Number(region.regionX);
        const regionY = Number(region.regionY);
        const publicStage = String(region.publicStage) as GardenRegionStage;
        const guidanceZoneValue = region.guidanceZone;
        const guidanceZone =
          typeof guidanceZoneValue === "string" &&
          guidanceZones.has(guidanceZoneValue as GardenGuidanceZone)
            ? (guidanceZoneValue as GardenGuidanceZone)
            : null;
        const supportLevel = Number(region.supportLevel);
        if (
          typeof region.regionKey !== "string" ||
          !bounds ||
          !Number.isSafeInteger(regionX) ||
          !Number.isSafeInteger(regionY) ||
          !stages.has(publicStage) ||
          ![0, 1, 2, 3].includes(supportLevel)
        ) {
          return [];
        }
        return [{
          regionKey: region.regionKey,
          regionX,
          regionY,
          bounds,
          publicStage,
          supportLevel: supportLevel as 0 | 1 | 2 | 3,
          isOpen: region.isOpen === true,
          newlyOpened: region.newlyOpened === true,
          plantCount: Math.max(0, Number(region.plantCount) || 0),
          heritagePlantCount: Math.max(0, Number(region.heritagePlantCount) || 0),
          weedCount: Math.max(0, Number(region.weedCount) || 0),
          occupancyPercent: Math.min(100, Math.max(0, Number(region.occupancyPercent) || 0)),
          guidanceZone,
        }];
      })
    : [];
  const zonePlanValue =
    data.zonePlan && typeof data.zonePlan === "object"
      ? (data.zonePlan as Record<string, unknown>)
      : null;
  const zonePlanSource = String(zonePlanValue?.source ?? "");
  const normalizedZonePlanSource:
    | "daily-frontier"
    | "snapshot-fallback"
    | null =
    zonePlanSource === "daily-frontier" ||
    zonePlanSource === "snapshot-fallback"
      ? zonePlanSource
      : null;
  const zonePlan =
    zonePlanValue &&
    normalizedZonePlanSource
      ? {
          formulaVersion: Math.max(1, Number(zonePlanValue.formulaVersion) || 1),
          evaluatedOn: String(zonePlanValue.evaluatedOn ?? data.generatedAt),
          source: normalizedZonePlanSource,
          heartRegions: Math.max(0, Number(zonePlanValue.heartRegions) || 0),
          growthRingRegions: Math.max(
            0,
            Number(zonePlanValue.growthRingRegions) || 0,
          ),
        }
      : null;
  return {
    snapshotVersion: Number(data.snapshotVersion),
    generatedAt: String(data.generatedAt),
    nextRefreshAt: String(data.nextRefreshAt),
    regionSize: Math.max(1, Number(data.regionSize) || 16),
    worldBounds,
    mapBounds,
    regions,
    zonePlan,
    spawnPoints: normalizeSpawnPoints(data.spawnPoints),
  };
}

export async function fetchGardenRegionWindow(
  centerRegionX: number,
  centerRegionY: number,
  snapshotVersion: number,
  radius = 2,
): Promise<GardenRegionWindow> {
  const query = new URLSearchParams({
    centerX: String(centerRegionX),
    centerY: String(centerRegionY),
    radius: String(radius),
    version: String(snapshotVersion),
  });
  let response: Response;
  try {
    response = await fetchGardenRequest(
      `/api/community-garden/regions/window?${query.toString()}`,
      { cache: "force-cache" },
    );
  } catch (error) {
    throw new GardenConnectionError(
      isAbortError(error)
        ? "This part of the garden took too long to refresh."
        : "This part of the garden could not connect.",
    );
  }
  if (!response.ok) {
    throw new Error(await responseError(response, "This part of the garden could not refresh."));
  }
  const data = (await response.json()) as Record<string, unknown>;
  const plants = Array.isArray(data.plants)
    ? data.plants
        .filter(
          (plant): plant is Record<string, unknown> =>
            Boolean(plant) && typeof plant === "object",
        )
        .map(normalizePlant)
    : [];
  return {
    snapshotVersion: Number(data.snapshotVersion),
    generatedAt: String(data.generatedAt),
    nextRefreshAt: String(data.nextRefreshAt),
    centerRegionX: Number(data.centerRegionX),
    centerRegionY: Number(data.centerRegionY),
    radius: Number(data.radius),
    loadedRegionKeys: Array.isArray(data.loadedRegionKeys)
      ? data.loadedRegionKeys.filter((key): key is string => typeof key === "string")
      : [],
    plants,
    weeds: normalizeWeeds(data.weeds, data.generatedAt),
  };
}

export async function fetchGardenWateringStatus(
  bounds: GardenBounds,
  accessToken?: string | null,
): Promise<GardenWateringStatus> {
  const query = new URLSearchParams({
    minX: String(bounds.minX),
    maxX: String(bounds.maxX),
    minY: String(bounds.minY),
    maxY: String(bounds.maxY),
  });
  let response: Response;
  try {
    response = await fetchGardenRequest(
      `/api/community-garden/watering-status?${query.toString()}`,
      {
        cache: "no-store",
        headers: accessToken
          ? { authorization: `Bearer ${accessToken}` }
          : undefined,
      },
    );
  } catch (error) {
    throw new GardenConnectionError(
      isAbortError(error)
        ? "Watering opportunities took too long to refresh."
        : "Watering opportunities could not refresh.",
    );
  }
  if (!response.ok) {
    throw new Error(
      await responseError(response, "Watering opportunities could not refresh."),
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  return {
    checkedAt: String(data.checkedAt ?? new Date().toISOString()),
    readyPlantIds: Array.isArray(data.readyPlantIds)
      ? data.readyPlantIds.filter(
          (plantId): plantId is string => typeof plantId === "string",
        )
      : [],
  };
}

async function submitRawGardenAction(
  payload: Omit<Record<string, unknown>, "actionId">,
  accessToken?: string | null,
) {
  const actionId = createActionId();
  const body = JSON.stringify({ ...payload, actionId });
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < GARDEN_ACTION_ATTEMPTS; attempt += 1) {
    try {
      response = await fetchGardenRequest("/api/community-garden/action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken
            ? { authorization: `Bearer ${accessToken}` }
            : {}),
        },
        body,
      });
      if (response.ok || !isTransientStatus(response.status)) break;
    } catch (error) {
      lastError = error;
      response = null;
    }
  }

  if (!response) {
    throw new GardenConnectionError(
      isAbortError(lastError)
        ? "The garden is taking longer than usual. Please try again; this action will not be counted twice."
        : "The garden connection was interrupted. Please try again.",
    );
  }

  if (!response.ok) {
    throw new Error(await responseError(response, "That did not work."));
  }

  return (await response.json()) as Record<string, unknown>;
}

async function submitGardenAction(
  payload: Omit<Record<string, unknown>, "actionId">,
  accessToken?: string | null,
): Promise<GardenActionResult> {
  const data = await submitRawGardenAction(payload, accessToken);

  if (!data.plant || typeof data.plant !== "object") {
    throw new Error("The garden did not return a plant.");
  }
  const contribution =
    data.contribution && typeof data.contribution === "object"
      ? (data.contribution as GardenContribution)
      : null;
  const plant = normalizePlant(data.plant as Record<string, unknown>);
  const plants = Array.isArray(data.plants)
    ? data.plants
        .filter(
          (candidate): candidate is Record<string, unknown> =>
            Boolean(candidate) && typeof candidate === "object",
        )
        .map(normalizePlant)
    : [plant];
  const wateringClaimedPlantIds = Array.isArray(data.wateringClaimedPlantIds)
    ? data.wateringClaimedPlantIds.filter(
        (plantId): plantId is string => typeof plantId === "string",
      )
    : [];
  const heritagePlantIds = Array.isArray(data.heritagePlantIds)
    ? data.heritagePlantIds.filter(
        (plantId): plantId is string => typeof plantId === "string",
      )
    : [];
  const heritageMoments = parseHeritageMoments(data.heritageMoments);
  return {
    plant,
    plants: plants.length > 0 ? plants : [plant],
    wateringClaimedPlantIds,
    heritagePlantIds,
    heritageMoments,
    contribution,
  };
}

export function plantGardenPlant(
  gridX: number,
  gridY: number,
  plantType: CommunityPlantType,
  accessToken?: string | null,
) {
  return submitGardenAction({
    action: "plant",
    gridX,
    gridY,
    plantType,
  }, accessToken);
}

export function waterGardenPlants(
  plantIds: string[],
  accessToken?: string | null,
) {
  return submitGardenAction({
    action: "water",
    plantIds: plantIds.slice(0, MAX_WATERING_TARGETS),
  }, accessToken);
}

export async function clearGardenWeed(
  weedId: string,
  accessToken?: string | null,
) {
  const data = await submitRawGardenAction(
    { action: "weed", weedId },
    accessToken,
  );
  if (typeof data.removedWeedId !== "string") {
    throw new Error("The garden did not confirm that weed was cleared.");
  }
  return {
    removedWeedId: data.removedWeedId,
    contribution:
      data.contribution && typeof data.contribution === "object"
        ? (data.contribution as GardenContribution)
        : null,
  };
}
