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

export function getCurrentSnapshotVersion(now = Date.now()) {
  return Math.floor(now / SNAPSHOT_INTERVAL_MS);
}

export async function fetchGardenSnapshot(): Promise<GardenSnapshot> {
  const version = getCurrentSnapshotVersion();
  const response = await fetch(
    `/api/community-garden/snapshot?version=${version}`,
    { cache: "force-cache" },
  );
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
  const actionId = crypto.randomUUID();
  const body = JSON.stringify({ ...payload, actionId });
  let response: Response;

  try {
    response = await fetch("/api/community-garden/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch {
    // A single retry uses the same action id, so a lost response cannot apply
    // the action or award Care twice.
    response = await fetch("/api/community-garden/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
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
