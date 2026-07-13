function hashCoordinate(x: number, y: number, seed = 0) {
  let value = Math.imul(x + seed * 101, 374761393) + Math.imul(y - seed * 53, 668265263);
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export type TerrainTile = {
  soil: string;
  green: string;
  detail: number;
  accent: number;
};

const SOILS = ["#aa8968", "#b08f6d", "#a68363", "#b49473"];
const GREENS = ["#9dac6c", "#a5b476", "#93a263", "#a9b77a"];

export function getTerrainTile(gridX: number, gridY: number): TerrainTile {
  const base = hashCoordinate(gridX, gridY);
  return {
    soil: SOILS[base % SOILS.length],
    green: GREENS[base % GREENS.length],
    detail: hashCoordinate(gridX, gridY, 7) % 11,
    accent: hashCoordinate(gridX, gridY, 13) % 9,
  };
}

export function terrainNoise(gridX: number, gridY: number, seed: number) {
  return hashCoordinate(gridX, gridY, seed) / 0xffffffff;
}

