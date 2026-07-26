import { GARDEN_CONFIG } from "../../app/community-garden/lib/gardenConfig.ts";
import { BASIL_COMMONS_POLICY } from "./commonsPolicy.ts";

export type CommunityGardenRegionState =
  | "founding"
  | "established"
  | "frontier"
  | "fallow"
  | "wild";
export type CommunityGardenRegionPressure = "healthy" | "busy" | "resting";

export type CommunityGardenRegionBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CommunityGardenRegionSummary = {
  regionKey: string;
  regionX: number;
  regionY: number;
  bounds: CommunityGardenRegionBounds;
  state: CommunityGardenRegionState;
  pressureState: CommunityGardenRegionPressure;
  version: number;
  plantCount: number;
  heritagePlantCount: number;
  weedCount: number;
  plantCapacity: number;
  occupancyPercent: number;
};

export type CommunityGardenRegionManifest = {
  schemaVersion: 1;
  deliveryMode: "compatibility-shadow";
  gardenId: "founding-garden";
  snapshotVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  regionSize: number;
  worldBounds: CommunityGardenRegionBounds;
  regionBounds: CommunityGardenRegionBounds;
  regions: CommunityGardenRegionSummary[];
  spawnPoints: Array<{ gridX: number; gridY: number }>;
};

export type CommunityGardenRegionSnapshot = {
  schemaVersion: 1;
  deliveryMode: "compatibility-shadow";
  gardenId: "founding-garden";
  regionKey: string;
  regionX: number;
  regionY: number;
  bounds: CommunityGardenRegionBounds;
  state: CommunityGardenRegionState;
  pressureState: CommunityGardenRegionPressure;
  snapshotVersion: number;
  regionVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  plantCount: number;
  heritagePlantCount: number;
  weedCount: number;
  plants: Record<string, unknown>[];
  weeds: Record<string, unknown>[];
};

type CanonicalSnapshot = Record<string, unknown>;

const manifestCache = new Map<number, CommunityGardenRegionManifest>();
const regionSnapshotCache = new Map<string, CommunityGardenRegionSnapshot>();
const canonicalSnapshotCache = new Map<number, CanonicalSnapshot>();
const regionRowCache = new Map<
  number,
  Map<string, { plants: Record<string, unknown>[]; weeds: Record<string, unknown>[] }>
>();

function finiteInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

const PUBLIC_PLANT_FIELDS = [
  "id",
  "grid_x",
  "grid_y",
  "plant_type",
  "planted_at",
  "last_watered_at",
  "created_at",
  "heritage_at",
] as const;

const PUBLIC_WEED_FIELDS = [
  "id",
  "grid_x",
  "grid_y",
  "spawned_at",
] as const;

function publicSnapshotRow(
  row: Record<string, unknown>,
  key: "plants" | "weeds",
) {
  const fields = key === "plants" ? PUBLIC_PLANT_FIELDS : PUBLIC_WEED_FIELDS;
  return Object.fromEntries(
    fields.flatMap((field) =>
      Object.prototype.hasOwnProperty.call(row, field)
        ? [[field, row[field]]]
        : [],
    ),
  );
}

function snapshotRows(snapshot: CanonicalSnapshot, key: "plants" | "weeds") {
  const rows = snapshot[key];
  return Array.isArray(rows)
    ? rows
        .filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === "object",
        )
        .map((row) => publicSnapshotRow(row, key))
    : [];
}

function rowCoordinates(row: Record<string, unknown>) {
  const gridX = finiteInteger(row.grid_x);
  const gridY = finiteInteger(row.grid_y);
  return gridX === null || gridY === null ? null : { gridX, gridY };
}

export function getCommunityGardenRegionKey(regionX: number, regionY: number) {
  return `${regionX}:${regionY}`;
}

export function getCommunityGardenRegionBounds(
  regionX: number,
  regionY: number,
): CommunityGardenRegionBounds {
  const { regionSize } = BASIL_COMMONS_POLICY;
  const { worldMin, worldMax } = GARDEN_CONFIG;
  return {
    minX: Math.max(worldMin, regionX * regionSize),
    maxX: Math.min(worldMax, regionX * regionSize + regionSize - 1),
    minY: Math.max(worldMin, regionY * regionSize),
    maxY: Math.min(worldMax, regionY * regionSize + regionSize - 1),
  };
}

export function getCommunityGardenRegionGridBounds() {
  const { regionSize } = BASIL_COMMONS_POLICY;
  const { worldMin, worldMax } = GARDEN_CONFIG;
  return {
    minX: Math.floor(worldMin / regionSize),
    maxX: Math.floor(worldMax / regionSize),
    minY: Math.floor(worldMin / regionSize),
    maxY: Math.floor(worldMax / regionSize),
  };
}

export function isFoundingGardenRegion(regionX: number, regionY: number) {
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionY)) {
    return false;
  }
  const bounds = getCommunityGardenRegionGridBounds();
  return (
    regionX >= bounds.minX &&
    regionX <= bounds.maxX &&
    regionY >= bounds.minY &&
    regionY <= bounds.maxY
  );
}

function getRowRegion(row: Record<string, unknown>) {
  const coordinates = rowCoordinates(row);
  if (!coordinates) return null;
  const { regionSize } = BASIL_COMMONS_POLICY;
  const regionX = Math.floor(coordinates.gridX / regionSize);
  const regionY = Math.floor(coordinates.gridY / regionSize);
  return isFoundingGardenRegion(regionX, regionY)
    ? { regionX, regionY }
    : null;
}

function getPressureState(plantCount: number): CommunityGardenRegionPressure {
  if (plantCount >= BASIL_COMMONS_POLICY.regionRestingAt) return "resting";
  if (plantCount >= BASIL_COMMONS_POLICY.regionBusyAt) return "busy";
  return "healthy";
}

function isHeritagePlant(row: Record<string, unknown>) {
  return Boolean(row.heritage_at || row.permanent);
}

function normalizeSnapshotVersion(snapshot: CanonicalSnapshot) {
  const version = finiteInteger(snapshot.version);
  if (version === null) {
    throw new Error("The shared garden snapshot has no valid version.");
  }
  return version;
}

function pruneRegionalCaches(currentVersion: number) {
  for (const version of manifestCache.keys()) {
    if (version !== currentVersion) manifestCache.delete(version);
  }
  for (const key of regionSnapshotCache.keys()) {
    if (!key.startsWith(`${currentVersion}:`)) regionSnapshotCache.delete(key);
  }
  for (const version of regionRowCache.keys()) {
    if (version !== currentVersion) regionRowCache.delete(version);
  }
  for (const version of canonicalSnapshotCache.keys()) {
    if (version !== currentVersion) canonicalSnapshotCache.delete(version);
  }
}

function getRegionalRows(snapshot: CanonicalSnapshot) {
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const cached = regionRowCache.get(snapshotVersion);
  if (cached) return cached;

  const byRegion = new Map<
    string,
    { plants: Record<string, unknown>[]; weeds: Record<string, unknown>[] }
  >();
  for (const key of ["plants", "weeds"] as const) {
    for (const row of snapshotRows(snapshot, key)) {
      const region = getRowRegion(row);
      if (!region) continue;
      const regionKey = getCommunityGardenRegionKey(region.regionX, region.regionY);
      const rows = byRegion.get(regionKey) ?? { plants: [], weeds: [] };
      rows[key].push(row);
      byRegion.set(regionKey, rows);
    }
  }
  regionRowCache.set(snapshotVersion, byRegion);
  pruneRegionalCaches(snapshotVersion);
  return byRegion;
}

export function buildCommunityGardenRegionManifest(
  snapshot: CanonicalSnapshot,
): CommunityGardenRegionManifest {
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const cached = manifestCache.get(snapshotVersion);
  if (cached) return cached;

  const byRegion = getRegionalRows(snapshot);
  const regionGrid = getCommunityGardenRegionGridBounds();
  const regions: CommunityGardenRegionSummary[] = [];

  for (let regionY = regionGrid.minY; regionY <= regionGrid.maxY; regionY += 1) {
    for (let regionX = regionGrid.minX; regionX <= regionGrid.maxX; regionX += 1) {
      const rows = byRegion.get(
        getCommunityGardenRegionKey(regionX, regionY),
      ) ?? { plants: [], weeds: [] };
      const regionPlants = rows.plants;
      const regionWeeds = rows.weeds;
      const plantCount = regionPlants.length;
      regions.push({
        regionKey: getCommunityGardenRegionKey(regionX, regionY),
        regionX,
        regionY,
        bounds: getCommunityGardenRegionBounds(regionX, regionY),
        state: "founding",
        pressureState: getPressureState(plantCount),
        version: snapshotVersion,
        plantCount,
        heritagePlantCount: regionPlants.filter(isHeritagePlant).length,
        weedCount: regionWeeds.length,
        plantCapacity: BASIL_COMMONS_POLICY.regionRestingAt,
        occupancyPercent: Number(
          Math.min(
            100,
            (plantCount / BASIL_COMMONS_POLICY.regionRestingAt) * 100,
          ).toFixed(1),
        ),
      });
    }
  }

  const manifest: CommunityGardenRegionManifest = {
    schemaVersion: 1,
    deliveryMode: "compatibility-shadow",
    gardenId: "founding-garden",
    snapshotVersion,
    generatedAt: String(snapshot.generatedAt),
    nextRefreshAt: String(snapshot.nextRefreshAt),
    regionSize: BASIL_COMMONS_POLICY.regionSize,
    worldBounds: {
      minX: GARDEN_CONFIG.worldMin,
      maxX: GARDEN_CONFIG.worldMax,
      minY: GARDEN_CONFIG.worldMin,
      maxY: GARDEN_CONFIG.worldMax,
    },
    regionBounds: regionGrid,
    regions,
    spawnPoints: Array.isArray(snapshot.spawnPoints)
      ? snapshot.spawnPoints.flatMap((point) => {
          if (!point || typeof point !== "object") return [];
          const candidate = point as Record<string, unknown>;
          const gridX = finiteInteger(candidate.gridX);
          const gridY = finiteInteger(candidate.gridY);
          return gridX === null || gridY === null ? [] : [{ gridX, gridY }];
        })
      : [],
  };

  manifestCache.set(snapshotVersion, manifest);
  pruneRegionalCaches(snapshotVersion);
  return manifest;
}

export function buildCommunityGardenRegionSnapshot(
  snapshot: CanonicalSnapshot,
  regionX: number,
  regionY: number,
): CommunityGardenRegionSnapshot | null {
  if (!isFoundingGardenRegion(regionX, regionY)) return null;
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const cacheKey = `${snapshotVersion}:${regionX}:${regionY}`;
  const cached = regionSnapshotCache.get(cacheKey);
  if (cached) return cached;

  const rows = getRegionalRows(snapshot).get(
    getCommunityGardenRegionKey(regionX, regionY),
  ) ?? { plants: [], weeds: [] };
  const plants = rows.plants;
  const weeds = rows.weeds;
  const manifest = buildCommunityGardenRegionManifest(snapshot);
  const summary = manifest.regions.find(
    (region) => region.regionX === regionX && region.regionY === regionY,
  );
  if (!summary) return null;

  const regionSnapshot: CommunityGardenRegionSnapshot = {
    schemaVersion: 1,
    deliveryMode: "compatibility-shadow",
    gardenId: "founding-garden",
    regionKey: summary.regionKey,
    regionX,
    regionY,
    bounds: summary.bounds,
    state: summary.state,
    pressureState: summary.pressureState,
    snapshotVersion,
    regionVersion: summary.version,
    generatedAt: manifest.generatedAt,
    nextRefreshAt: manifest.nextRefreshAt,
    plantCount: summary.plantCount,
    heritagePlantCount: summary.heritagePlantCount,
    weedCount: summary.weedCount,
    plants,
    weeds,
  };

  regionSnapshotCache.set(cacheKey, regionSnapshot);
  pruneRegionalCaches(snapshotVersion);
  return regionSnapshot;
}

export async function loadCommunityGardenRegionManifest() {
  const snapshot = await loadRegionalSourceSnapshot();
  return buildCommunityGardenRegionManifest(snapshot);
}

export async function loadCommunityGardenRegionSnapshot(
  regionX: number,
  regionY: number,
) {
  const snapshot = await loadRegionalSourceSnapshot();
  return buildCommunityGardenRegionSnapshot(snapshot, regionX, regionY);
}

async function loadRegionalSourceSnapshot() {
  const currentVersion = Math.floor(Date.now() / (10 * 60 * 1000));
  const cached = canonicalSnapshotCache.get(currentVersion);
  if (cached) return cached;

  const { loadCommunityGardenSnapshot } = await import("./publicGardenServer.ts");
  const snapshot = await loadCommunityGardenSnapshot();
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  canonicalSnapshotCache.set(snapshotVersion, snapshot);
  pruneRegionalCaches(snapshotVersion);
  return snapshot;
}
