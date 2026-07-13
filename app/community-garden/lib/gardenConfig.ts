export const GARDEN_CONFIG = {
  logicalWidth: 320,
  logicalHeight: 480,
  minLogicalWidth: 220,
  maxLogicalWidth: 900,
  cameraZoom: 2,
  maryScreenYRatio: 0.56,
  treeLineHeight: 48,
  tileSize: 16,
  tileScreenHeight: 13,
  chunkSize: 16,
  chunkLoadRadius: 1,
  worldMin: -96,
  worldMax: 63,
  moveSpeed: 62,
  pollIntervalMs: 20_000,
  sproutMs: 24 * 60 * 60 * 1000,
  wiltMs: 72 * 60 * 60 * 1000,
  deadMs: 96 * 60 * 60 * 1000,
  removeMs: 102 * 60 * 60 * 1000,
} as const;

export type GardenBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export function getLoadedBounds(gridX: number, gridY: number): GardenBounds {
  const { chunkSize, chunkLoadRadius, worldMin, worldMax } = GARDEN_CONFIG;
  const chunkX = Math.floor(gridX / chunkSize);
  const chunkY = Math.floor(gridY / chunkSize);

  return {
    minX: Math.max(worldMin, (chunkX - chunkLoadRadius) * chunkSize),
    maxX: Math.min(worldMax, (chunkX + chunkLoadRadius + 1) * chunkSize - 1),
    minY: Math.max(worldMin, (chunkY - chunkLoadRadius) * chunkSize),
    maxY: Math.min(worldMax, (chunkY + chunkLoadRadius + 1) * chunkSize - 1),
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

