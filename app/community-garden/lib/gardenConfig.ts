export const GARDEN_CONFIG = {
  logicalWidth: 320,
  logicalHeight: 480,
  minLogicalWidth: 220,
  maxLogicalWidth: 900,
  defaultCameraZoom: 1,
  minCameraZoom: 1,
  maxCameraZoom: 2,
  cameraZoomStep: 0.5,
  maryScreenYRatio: 0.56,
  tileSize: 16,
  tileScreenHeight: 13,
  chunkSize: 16,
  chunkLoadRadius: 2,
  cleanupChunkLoadRadius: 1,
  worldMin: -96,
  worldMax: 63,
  moveSpeed: 62,
  pollIntervalMs: 20_000,
} as const;

export type GardenBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function getLoadedBounds(
  gridX: number,
  gridY: number,
  loadRadius: number = GARDEN_CONFIG.chunkLoadRadius,
): GardenBounds {
  const { chunkSize, worldMin, worldMax } = GARDEN_CONFIG;
  const chunkX = Math.floor(gridX / chunkSize);
  const chunkY = Math.floor(gridY / chunkSize);

  return {
    minX: Math.max(worldMin, (chunkX - loadRadius) * chunkSize),
    maxX: Math.min(worldMax, (chunkX + loadRadius + 1) * chunkSize - 1),
    minY: Math.max(worldMin, (chunkY - loadRadius) * chunkSize),
    maxY: Math.min(worldMax, (chunkY + loadRadius + 1) * chunkSize - 1),
  };
}

export function getChunkKey(gridX: number, gridY: number) {
  const { chunkSize } = GARDEN_CONFIG;
  return `${Math.floor(gridX / chunkSize)}:${Math.floor(gridY / chunkSize)}`;
}

export function isWithinGarden(gridX: number, gridY: number) {
  return (
    gridX >= GARDEN_CONFIG.worldMin &&
    gridX <= GARDEN_CONFIG.worldMax &&
    gridY >= GARDEN_CONFIG.worldMin &&
    gridY <= GARDEN_CONFIG.worldMax
  );
}

export function clampWorldCoordinate(value: number) {
  const minimum = (GARDEN_CONFIG.worldMin + 0.5) * GARDEN_CONFIG.tileSize;
  const maximum = (GARDEN_CONFIG.worldMax + 0.5) * GARDEN_CONFIG.tileSize;
  return Math.min(maximum, Math.max(minimum, value));
}

export function getMapPercentage(gridCoordinate: number) {
  const range = GARDEN_CONFIG.worldMax - GARDEN_CONFIG.worldMin;
  return Math.min(
    100,
    Math.max(0, ((gridCoordinate - GARDEN_CONFIG.worldMin) / range) * 100),
  );
}

export function getGridFromMapPercentage(percentage: number) {
  const range = GARDEN_CONFIG.worldMax - GARDEN_CONFIG.worldMin;
  const normalized = Math.min(100, Math.max(0, percentage)) / 100;
  return Math.round(GARDEN_CONFIG.worldMin + normalized * range);
}

export function getGardenBounds(): GardenBounds {
  return {
    minX: GARDEN_CONFIG.worldMin,
    maxX: GARDEN_CONFIG.worldMax,
    minY: GARDEN_CONFIG.worldMin,
    maxY: GARDEN_CONFIG.worldMax,
  };
}

