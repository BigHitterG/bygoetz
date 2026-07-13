export const GARDEN_CONFIG = {
  logicalWidth: 320,
  logicalHeight: 480,
  horizonHeight: 94,
  maryScreenY: 334,
  tileSize: 16,
  tileScreenHeight: 13,
  chunkSize: 16,
  chunkLoadRadius: 1,
  worldMin: -2048,
  worldMax: 2047,
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

