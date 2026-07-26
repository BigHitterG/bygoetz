import { GARDEN_CONFIG } from "../../app/community-garden/lib/gardenConfig.ts";
import { getSupabaseAdmin } from "../supabaseAdmin.ts";
import { BASIL_COMMONS_POLICY } from "./commonsPolicy.ts";
import {
  planCommunityGardenZones,
  type CommunityGardenGuidanceZone,
} from "./gardenZones.ts";
import type { CommunityGardenFrontierHealth } from "./health.ts";

export type CommunityGardenRegionState =
  | "founding"
  | "established"
  | "frontier"
  | "fallow"
  | "wild";
export type CommunityGardenRegionPressure = "healthy" | "busy" | "resting";
export type CommunityGardenPublicStage =
  | "garden"
  | "edge"
  | "growing"
  | "ready"
  | "new"
  | "resting"
  | "wild";

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
  publicStage: CommunityGardenPublicStage;
  supportLevel: 0 | 1 | 2 | 3;
  isOpen: boolean;
  newlyOpened: boolean;
  version: number;
  plantCount: number;
  heritagePlantCount: number;
  weedCount: number;
  plantCapacity: number;
  occupancyPercent: number;
  guidanceZone: CommunityGardenGuidanceZone | null;
};

export type CommunityGardenRegionManifest = {
  schemaVersion: 3;
  deliveryMode: "regional-window";
  gardenId: "founding-garden";
  snapshotVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  regionSize: number;
  worldBounds: CommunityGardenRegionBounds;
  mapBounds: CommunityGardenRegionBounds;
  regionBounds: CommunityGardenRegionBounds;
  regions: CommunityGardenRegionSummary[];
  zonePlan: {
    formulaVersion: number;
    evaluatedOn: string;
    source: "daily-frontier" | "snapshot-fallback";
    heartRegions: number;
    growthRingRegions: number;
  };
  spawnPoints: Array<{ gridX: number; gridY: number }>;
};

export type CommunityGardenRegionSnapshot = {
  schemaVersion: 1;
  deliveryMode: "regional-window";
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

export type CommunityGardenRegionWindow = {
  schemaVersion: 1;
  deliveryMode: "regional-window";
  gardenId: "founding-garden";
  snapshotVersion: number;
  generatedAt: string;
  nextRefreshAt: string;
  centerRegionX: number;
  centerRegionY: number;
  radius: number;
  loadedRegionKeys: string[];
  plants: Record<string, unknown>[];
  weeds: Record<string, unknown>[];
};

type CanonicalSnapshot = Record<string, unknown>;

const manifestCache = new Map<string, CommunityGardenRegionManifest>();
const regionSnapshotCache = new Map<string, CommunityGardenRegionSnapshot>();
const regionWindowCache = new Map<string, CommunityGardenRegionWindow>();
const canonicalSnapshotCache = new Map<number, CanonicalSnapshot>();
const regionRowCache = new Map<
  number,
  Map<string, { plants: Record<string, unknown>[]; weeds: Record<string, unknown>[] }>
>();
let frontierOverlayCache:
  | { expiresAt: number; value: CommunityGardenFrontierHealth | null }
  | null = null;

const FRONTIER_OVERLAY_CACHE_MS = 5 * 60 * 1000;

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
  return {
    minX: regionX * regionSize,
    maxX: regionX * regionSize + regionSize - 1,
    minY: regionY * regionSize,
    maxY: regionY * regionSize + regionSize - 1,
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
  return Math.abs(regionX) <= 1_024 && Math.abs(regionY) <= 1_024
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
  for (const key of manifestCache.keys()) {
    if (!key.startsWith(`${currentVersion}:`)) manifestCache.delete(key);
  }
  for (const key of regionSnapshotCache.keys()) {
    if (!key.startsWith(`${currentVersion}:`)) regionSnapshotCache.delete(key);
  }
  for (const key of regionWindowCache.keys()) {
    if (!key.startsWith(`${currentVersion}:`)) regionWindowCache.delete(key);
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
  frontier: CommunityGardenFrontierHealth | null = null,
): CommunityGardenRegionManifest {
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const frontierVersion = frontier?.evaluatedAt ?? "none";
  const manifestCacheKey = `${snapshotVersion}:${frontierVersion}`;
  const cached = manifestCache.get(manifestCacheKey);
  if (cached) return cached;

  const byRegion = getRegionalRows(snapshot);
  const regionGrid = getCommunityGardenRegionGridBounds();
  const regionCoordinates = new Map<string, { regionX: number; regionY: number }>();

  for (let regionY = regionGrid.minY; regionY <= regionGrid.maxY; regionY += 1) {
    for (let regionX = regionGrid.minX; regionX <= regionGrid.maxX; regionX += 1) {
      regionCoordinates.set(getCommunityGardenRegionKey(regionX, regionY), {
        regionX,
        regionY,
      });
    }
  }

  for (const key of byRegion.keys()) {
    const [regionX, regionY] = key.split(":").map(Number);
    if (Number.isSafeInteger(regionX) && Number.isSafeInteger(regionY)) {
      regionCoordinates.set(key, { regionX, regionY });
    }
  }
  for (const cell of frontier?.map.cells ?? []) {
    regionCoordinates.set(
      getCommunityGardenRegionKey(cell.regionX, cell.regionY),
      { regionX: cell.regionX, regionY: cell.regionY },
    );
  }

  const frontierCells = new Map(
    (frontier?.map.cells ?? []).map((cell) => [
      getCommunityGardenRegionKey(cell.regionX, cell.regionY),
      cell,
    ]),
  );
  const recentChanges = new Map(
    (frontier?.recentStateChanges ?? []).map((change) => [
      getCommunityGardenRegionKey(change.regionX, change.regionY),
      change,
    ]),
  );
  const baseRegions = Array.from(regionCoordinates.values()).map(
    ({ regionX, regionY }): CommunityGardenRegionSummary => {
      const regionKey = getCommunityGardenRegionKey(regionX, regionY);
      const rows = byRegion.get(regionKey) ?? { plants: [], weeds: [] };
      const cell = frontierCells.get(regionKey);
      const plantCount = rows.plants.length;
      const pressureState = cell?.pressureState ?? getPressureState(plantCount);
      const isOpen = cell ? cell.regionExists : isFoundingGardenRegion(regionX, regionY);
      const recentChange = recentChanges.get(regionKey);
      const newlyOpened = Boolean(
        isOpen &&
          recentChange &&
          recentChange.nextState !== "founding" &&
          recentChange.nextState !== "fallow" &&
          Date.now() - Date.parse(recentChange.createdAt) < 14 * 24 * 60 * 60 * 1000,
      );
      const supportedLivePlants = Math.max(
        1,
        frontier?.policy.supportedLivePlants ?? 64,
      );
      const supportedSubcells = Math.max(
        1,
        frontier?.policy.supportedSubcells ?? 8,
      );
      const supportProgress = cell
        ? Math.max(
            cell.eligibleLivePlants / supportedLivePlants,
            cell.coveredSubcells / supportedSubcells,
            cell.eligibleAccounts7d / Math.max(1, cell.requiredAccounts),
          )
        : 0;
      const supportLevel: 0 | 1 | 2 | 3 =
        supportProgress >= 1 ? 3 : supportProgress >= 0.55 ? 2 : supportProgress > 0 ? 1 : 0;
      const publicStage: CommunityGardenPublicStage = newlyOpened
        ? "new"
        : pressureState === "resting" || cell?.landState === "fallow"
          ? "resting"
          : isOpen
            ? cell?.landState === "frontier"
              ? "edge"
              : "garden"
            : cell?.recommendedAction !== "none" || cell?.globallyQualified
              ? "ready"
              : supportLevel > 0
                ? "growing"
                : cell
                  ? "edge"
                  : "wild";
      const plantCapacity = Math.max(
        1,
        cell?.effectiveCapacity ?? BASIL_COMMONS_POLICY.regionRestingAt,
      );
      return {
        regionKey,
        regionX,
        regionY,
        bounds: getCommunityGardenRegionBounds(regionX, regionY),
        state: cell?.landState ?? "founding",
        pressureState,
        publicStage,
        supportLevel,
        isOpen,
        newlyOpened,
        version: snapshotVersion,
        plantCount,
        heritagePlantCount: rows.plants.filter(isHeritagePlant).length,
        weedCount: rows.weeds.length,
        plantCapacity,
        occupancyPercent: Number(
          Math.min(100, (plantCount / plantCapacity) * 100).toFixed(1),
        ),
        guidanceZone: null,
      };
    },
  );
  const zonePlan = planCommunityGardenZones(
    baseRegions.map((region) => {
      const cell = frontierCells.get(region.regionKey);
      return {
        regionKey: region.regionKey,
        regionX: region.regionX,
        regionY: region.regionY,
        isOpen: region.isOpen,
        landState: region.state,
        // Frontier evaluations are daily and therefore keep the public zones
        // stable while live planting continues between garden snapshots.
        plantCount: cell?.plantCount ?? region.plantCount,
        heritagePlantCount:
          cell?.heritageFlowers ?? region.heritagePlantCount,
        coveredSubcells: cell?.coveredSubcells,
        distinctGardeners: cell?.eligibleAccounts7d,
      };
    }),
    {
      evaluatedOn:
        frontier?.evaluationDate ?? String(snapshot.generatedAt).slice(0, 10),
      source: frontier?.evaluationDate
        ? "daily-frontier"
        : "snapshot-fallback",
    },
  );
  const regions = baseRegions.map((region) => ({
    ...region,
    guidanceZone: region.isOpen
      ? (zonePlan.zoneByRegionKey.get(region.regionKey) ?? "garden")
      : null,
  }));
  regions.sort((left, right) => left.regionY - right.regionY || left.regionX - right.regionX);

  const openRegions = regions.filter((region) => region.isOpen);
  const boundsFor = (items: CommunityGardenRegionSummary[]) => ({
    minX: Math.min(...items.map((region) => region.bounds.minX)),
    maxX: Math.max(...items.map((region) => region.bounds.maxX)),
    minY: Math.min(...items.map((region) => region.bounds.minY)),
    maxY: Math.max(...items.map((region) => region.bounds.maxY)),
  });
  const worldBounds = boundsFor(openRegions.length > 0 ? openRegions : regions);
  const mapBounds = boundsFor(regions);
  const regionXs = regions.map((region) => region.regionX);
  const regionYs = regions.map((region) => region.regionY);

  const manifest: CommunityGardenRegionManifest = {
    schemaVersion: 3,
    deliveryMode: "regional-window",
    gardenId: "founding-garden",
    snapshotVersion,
    generatedAt: String(snapshot.generatedAt),
    nextRefreshAt: String(snapshot.nextRefreshAt),
    regionSize: BASIL_COMMONS_POLICY.regionSize,
    worldBounds,
    mapBounds,
    regionBounds: {
      minX: Math.min(...regionXs),
      maxX: Math.max(...regionXs),
      minY: Math.min(...regionYs),
      maxY: Math.max(...regionYs),
    },
    regions,
    zonePlan: {
      formulaVersion: zonePlan.formulaVersion,
      evaluatedOn: zonePlan.evaluatedOn,
      source: zonePlan.source,
      heartRegions: zonePlan.heartRegionKeys.length,
      growthRingRegions: zonePlan.growthRingRegionKeys.length,
    },
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

  manifestCache.set(manifestCacheKey, manifest);
  pruneRegionalCaches(snapshotVersion);
  return manifest;
}

export function buildCommunityGardenRegionSnapshot(
  snapshot: CanonicalSnapshot,
  regionX: number,
  regionY: number,
  manifest = buildCommunityGardenRegionManifest(snapshot),
): CommunityGardenRegionSnapshot | null {
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const cacheKey = `${snapshotVersion}:${regionX}:${regionY}`;
  const cached = regionSnapshotCache.get(cacheKey);
  if (cached) return cached;

  const rows = getRegionalRows(snapshot).get(
    getCommunityGardenRegionKey(regionX, regionY),
  ) ?? { plants: [], weeds: [] };
  const plants = rows.plants;
  const weeds = rows.weeds;
  const summary = manifest.regions.find(
    (region) => region.regionX === regionX && region.regionY === regionY,
  );
  if (!summary?.isOpen) return null;

  const regionSnapshot: CommunityGardenRegionSnapshot = {
    schemaVersion: 1,
    deliveryMode: "regional-window",
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
  const frontier = await loadPublicFrontierOverlay();
  return buildCommunityGardenRegionManifest(snapshot, frontier);
}

export async function loadCommunityGardenRegionSnapshot(
  regionX: number,
  regionY: number,
) {
  const snapshot = await loadRegionalSourceSnapshot();
  const frontier = await loadPublicFrontierOverlay();
  const manifest = buildCommunityGardenRegionManifest(snapshot, frontier);
  return buildCommunityGardenRegionSnapshot(snapshot, regionX, regionY, manifest);
}

export async function loadCommunityGardenRegionWindow(
  centerRegionX: number,
  centerRegionY: number,
  radius = 2,
): Promise<CommunityGardenRegionWindow> {
  const snapshot = await loadRegionalSourceSnapshot();
  const frontier = await loadPublicFrontierOverlay();
  const manifest = buildCommunityGardenRegionManifest(snapshot, frontier);
  const snapshotVersion = normalizeSnapshotVersion(snapshot);
  const safeRadius = Math.min(3, Math.max(0, Math.trunc(radius)));
  const cacheKey = `${snapshotVersion}:${centerRegionX}:${centerRegionY}:${safeRadius}`;
  const cached = regionWindowCache.get(cacheKey);
  if (cached) return cached;
  const loadedRegions = manifest.regions.filter(
    (region) =>
      region.isOpen &&
      Math.abs(region.regionX - centerRegionX) <= safeRadius &&
      Math.abs(region.regionY - centerRegionY) <= safeRadius,
  );
  const rows = getRegionalRows(snapshot);
  const plants: Record<string, unknown>[] = [];
  const weeds: Record<string, unknown>[] = [];
  for (const region of loadedRegions) {
    const regionRows = rows.get(region.regionKey);
    if (!regionRows) continue;
    plants.push(...regionRows.plants);
    weeds.push(...regionRows.weeds);
  }
  const window: CommunityGardenRegionWindow = {
    schemaVersion: 1,
    deliveryMode: "regional-window",
    gardenId: "founding-garden",
    snapshotVersion,
    generatedAt: manifest.generatedAt,
    nextRefreshAt: manifest.nextRefreshAt,
    centerRegionX,
    centerRegionY,
    radius: safeRadius,
    loadedRegionKeys: loadedRegions.map((region) => region.regionKey),
    plants,
    weeds,
  };
  regionWindowCache.set(cacheKey, window);
  pruneRegionalCaches(snapshotVersion);
  return window;
}

async function loadPublicFrontierOverlay() {
  if (frontierOverlayCache && frontierOverlayCache.expiresAt > Date.now()) {
    return frontierOverlayCache.value;
  }
  let value: CommunityGardenFrontierHealth | null = null;
  try {
    const { data, error } = await getSupabaseAdmin().rpc(
      "get_community_garden_frontier_dashboard_v2",
    );
    if (!error && data && typeof data === "object") {
      value = data as CommunityGardenFrontierHealth;
    }
  } catch {
    // Regional gameplay remains available when the private planning overlay is
    // temporarily unavailable. The founding map is the safe public fallback.
  }
  frontierOverlayCache = {
    value,
    expiresAt: Date.now() + FRONTIER_OVERLAY_CACHE_MS,
  };
  return value;
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
