import {
  PLANT_TYPES,
  type PlantRecord,
  type PlantType,
} from "./roseLifecycle";
import type { GardenBounds } from "./gardenConfig";

export type GardenMapPlant = Pick<
  PlantRecord,
  "grid_x" | "grid_y" | "plant_type"
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
  earningPhase: "daily" | "full" | "taper4" | "taper20";
  dailyCareEarned: number;
  dailyCareLimit: number;
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

type GardenActionResult = {
  plant: PlantRecord;
  plants: PlantRecord[];
  wateringClaimedPlantIds: string[];
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
  const plantType = PLANT_TYPES.includes(value.plant_type as PlantType)
    ? (value.plant_type as PlantType)
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
  const spawnPoints = Array.isArray(data.spawnPoints)
    ? data.spawnPoints.flatMap((point) => {
        if (!point || typeof point !== "object") return [];
        const candidate = point as Record<string, unknown>;
        const gridX = Number(candidate.gridX);
        const gridY = Number(candidate.gridY);
        return Number.isInteger(gridX) && Number.isInteger(gridY)
          ? [{ gridX, gridY }]
          : [];
      })
    : [];
  const weeds = Array.isArray(data.weeds)
    ? data.weeds.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const weed = value as Record<string, unknown>;
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
          spawned_at: String(weed.spawned_at ?? data.generatedAt),
        }];
      })
    : [];
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

export async function fetchGardenWateringStatus(
  bounds: GardenBounds,
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
      { cache: "no-store" },
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
) {
  const actionId = createActionId();
  const body = JSON.stringify({ ...payload, actionId });
  let response: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < GARDEN_ACTION_ATTEMPTS; attempt += 1) {
    try {
      response = await fetchGardenRequest("/api/community-garden/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
): Promise<GardenActionResult> {
  const data = await submitRawGardenAction(payload);

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
  return {
    plant,
    plants: plants.length > 0 ? plants : [plant],
    wateringClaimedPlantIds,
    contribution,
  };
}

export function plantGardenPlant(
  gridX: number,
  gridY: number,
  plantType: PlantType,
) {
  return submitGardenAction({
    action: "plant",
    gridX,
    gridY,
    plantType,
  });
}

export function waterGardenPlants(plantIds: string[]) {
  return submitGardenAction({ action: "water", plantIds: plantIds.slice(0, 4) });
}

export async function clearGardenWeed(weedId: string) {
  const data = await submitRawGardenAction({ action: "weed", weedId });
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
