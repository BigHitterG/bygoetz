function hashCoordinate(x: number, y: number, seed = 0) {
  let value = Math.imul(x + seed * 101, 374761393) + Math.imul(y - seed * 53, 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export type TerrainTile = {
  detail: number;
  accent: number;
};

export function getTerrainTile(gridX: number, gridY: number): TerrainTile {
  return {
    detail: hashCoordinate(gridX, gridY, 7) % 11,
    accent: hashCoordinate(gridX, gridY, 13) % 9,
  };
}

export function terrainNoise(gridX: number, gridY: number, seed: number) {
  return hashCoordinate(gridX, gridY, seed) / 0xffffffff;
}

