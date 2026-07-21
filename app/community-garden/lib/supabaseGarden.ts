import {
  PLANT_TYPES,
  type PlantRecord,
  type PlantType,
} from "./roseLifecycle";

export type GardenMapPlant = Pick<
  PlantRecord,
  "grid_x" | "grid_y" | "plant_type"
>;
export type GardenContribution = {
  action: "plant" | "water";
  receiptToken: string;
  careValue: number;
};
export type GardenSnapshot = {
  version: number;
  generatedAt: string;
  nextRefreshAt: string;
  plantCount: number;
  plants: PlantRecord[];
};

type GardenActionResult = {
  plant: PlantRecord;
  contribution: GardenContribution | null;
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
  return {
    version: Number(data.version),
    generatedAt: String(data.generatedAt),
    nextRefreshAt: String(data.nextRefreshAt),
    plantCount: Number(data.plantCount ?? plants.length),
    plants,
  };
}

async function submitGardenAction(
  payload: Omit<Record<string, unknown>, "actionId">,
): Promise<GardenActionResult> {
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

  const data = (await response.json()) as Record<string, unknown>;
  if (!data.plant || typeof data.plant !== "object") {
    throw new Error("The garden did not return a plant.");
  }
  const contribution =
    data.contribution && typeof data.contribution === "object"
      ? (data.contribution as GardenContribution)
      : null;
  return {
    plant: normalizePlant(data.plant as Record<string, unknown>),
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

export function waterGardenPlant(plantId: string) {
  return submitGardenAction({ action: "water", plantId });
}
