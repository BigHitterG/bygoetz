export const BASIL_GARDEN_ZONE_POLICY = {
  formulaVersion: 1,
  minimumHeartPlants: 8,
  densityPercentile: 0.68,
  maximumAdaptiveThreshold: 48,
  heritageWeight: 24,
  coverageWeight: 3,
  gardenerWeight: 4,
  growthRingDepthRegions: 1,
} as const;

export type CommunityGardenGuidanceZone =
  | "garden"
  | "heart"
  | "growth-ring";

export type CommunityGardenZoneSignal = {
  regionKey: string;
  regionX: number;
  regionY: number;
  isOpen: boolean;
  landState: "founding" | "established" | "frontier" | "fallow" | "wild";
  plantCount: number;
  heritagePlantCount: number;
  coveredSubcells?: number;
  distinctGardeners?: number;
};

export type CommunityGardenZonePlan = {
  formulaVersion: number;
  evaluatedOn: string;
  source: "daily-frontier" | "snapshot-fallback";
  heartRegionKeys: string[];
  growthRingRegionKeys: string[];
  zoneByRegionKey: Map<string, CommunityGardenGuidanceZone>;
};

type ConnectedComponent = {
  keys: string[];
  score: number;
};

function cardinalKeys(regionX: number, regionY: number) {
  return [
    `${regionX - 1}:${regionY}`,
    `${regionX + 1}:${regionY}`,
    `${regionX}:${regionY - 1}`,
    `${regionX}:${regionY + 1}`,
  ];
}

function surroundingKeys(regionX: number, regionY: number, depth: number) {
  const keys: string[] = [];
  for (let offsetY = -depth; offsetY <= depth; offsetY += 1) {
    for (let offsetX = -depth; offsetX <= depth; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) continue;
      keys.push(`${regionX + offsetX}:${regionY + offsetY}`);
    }
  }
  return keys;
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)),
  );
  return sorted[index];
}

function signalScore(signal: CommunityGardenZoneSignal) {
  return (
    signal.plantCount +
    signal.heritagePlantCount * BASIL_GARDEN_ZONE_POLICY.heritageWeight +
    Math.max(0, signal.coveredSubcells ?? 0) *
      BASIL_GARDEN_ZONE_POLICY.coverageWeight +
    Math.min(6, Math.max(0, signal.distinctGardeners ?? 0)) *
      BASIL_GARDEN_ZONE_POLICY.gardenerWeight
  );
}

function compareComponents(left: ConnectedComponent, right: ConnectedComponent) {
  if (left.keys.length !== right.keys.length) {
    return right.keys.length - left.keys.length;
  }
  if (left.score !== right.score) return right.score - left.score;
  return left.keys.join("|").localeCompare(right.keys.join("|"));
}

/**
 * Plans the player-facing Garden Heart and Growth Ring without changing land,
 * flowers, or rewards. The Heart is the largest connected established cluster,
 * so an isolated high-volume actor cannot drag the shared center across the map.
 */
export function planCommunityGardenZones(
  signals: CommunityGardenZoneSignal[],
  options: {
    evaluatedOn: string;
    source: CommunityGardenZonePlan["source"];
  },
): CommunityGardenZonePlan {
  const openSignals = signals.filter((signal) => signal.isOpen);
  const openByKey = new Map(openSignals.map((signal) => [signal.regionKey, signal]));
  const adaptiveThreshold = Math.min(
    BASIL_GARDEN_ZONE_POLICY.maximumAdaptiveThreshold,
    Math.max(
      BASIL_GARDEN_ZONE_POLICY.minimumHeartPlants,
      percentile(
        openSignals.map((signal) => Math.max(0, signal.plantCount)),
        BASIL_GARDEN_ZONE_POLICY.densityPercentile,
      ),
    ),
  );

  const candidateKeys = new Set(
    openSignals.flatMap((signal) => {
      const canBecomeEstablished =
        signal.landState === "founding" || signal.landState === "established";
      const denseEnough = signal.plantCount >= adaptiveThreshold;
      const heritageAnchor =
        signal.heritagePlantCount > 0 &&
        signal.plantCount >= Math.ceil(BASIL_GARDEN_ZONE_POLICY.minimumHeartPlants / 2);
      return canBecomeEstablished && (denseEnough || heritageAnchor)
        ? [signal.regionKey]
        : [];
    }),
  );

  const visited = new Set<string>();
  const components: ConnectedComponent[] = [];
  for (const candidateKey of candidateKeys) {
    if (visited.has(candidateKey)) continue;
    const queue = [candidateKey];
    const keys: string[] = [];
    let score = 0;
    visited.add(candidateKey);
    while (queue.length > 0) {
      const currentKey = queue.shift();
      if (!currentKey) continue;
      const signal = openByKey.get(currentKey);
      if (!signal) continue;
      keys.push(currentKey);
      score += signalScore(signal);
      for (const neighborKey of cardinalKeys(signal.regionX, signal.regionY)) {
        if (!candidateKeys.has(neighborKey) || visited.has(neighborKey)) continue;
        visited.add(neighborKey);
        queue.push(neighborKey);
      }
    }
    keys.sort();
    components.push({ keys, score });
  }

  components.sort(compareComponents);
  const heartKeys = new Set(components[0]?.keys ?? []);

  // Fill small planted holes inside the connected Heart. This smooths the
  // public shape without turning it into an artificial geometric circle.
  for (const signal of openSignals) {
    if (heartKeys.has(signal.regionKey) || signal.plantCount <= 0) continue;
    const heartNeighbors = cardinalKeys(signal.regionX, signal.regionY).filter(
      (key) => heartKeys.has(key),
    ).length;
    if (heartNeighbors >= 3) heartKeys.add(signal.regionKey);
  }

  const growthRingKeys = new Set<string>();
  for (const heartKey of heartKeys) {
    const heart = openByKey.get(heartKey);
    if (!heart) continue;
    for (const neighborKey of surroundingKeys(
      heart.regionX,
      heart.regionY,
      BASIL_GARDEN_ZONE_POLICY.growthRingDepthRegions,
    )) {
      if (openByKey.has(neighborKey) && !heartKeys.has(neighborKey)) {
        growthRingKeys.add(neighborKey);
      }
    }
  }

  const zoneByRegionKey = new Map<string, CommunityGardenGuidanceZone>();
  for (const signal of openSignals) {
    zoneByRegionKey.set(
      signal.regionKey,
      heartKeys.has(signal.regionKey)
        ? "heart"
        : growthRingKeys.has(signal.regionKey)
          ? "growth-ring"
          : "garden",
    );
  }

  return {
    formulaVersion: BASIL_GARDEN_ZONE_POLICY.formulaVersion,
    evaluatedOn: options.evaluatedOn,
    source: options.source,
    heartRegionKeys: Array.from(heartKeys).sort(),
    growthRingRegionKeys: Array.from(growthRingKeys).sort(),
    zoneByRegionKey,
  };
}
