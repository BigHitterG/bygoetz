export type PendingGardenPlantType = "rose" | "sunflower" | "lavender";

export type PendingGardenPreview = {
  careBalance: number;
  plants: Array<{
    gridX: number;
    gridY: number;
    plantType: PendingGardenPlantType;
  }>;
  paths: Array<{ gridX: number; gridY: number }>;
};

function integerInRange(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

/**
 * Normalizes the small guest garden payload before it is stored with a pending
 * purchase. This module deliberately has no database or framework imports so
 * the exact production boundary can be exercised by the Phase 5 test suite.
 */
export function normalizePendingGardenPreview(value: unknown): PendingGardenPreview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!integerInRange(record.careBalance, 0, 20)) return null;
  if (!Array.isArray(record.plants) || record.plants.length > 10) return null;
  if (!Array.isArray(record.paths) || record.paths.length > 64) return null;

  const plantTiles = new Set<string>();
  const plants: PendingGardenPreview["plants"] = [];
  for (const candidate of record.plants) {
    if (!candidate || typeof candidate !== "object") return null;
    const plant = candidate as Record<string, unknown>;
    if (
      !integerInRange(plant.gridX, 0, 11) ||
      !integerInRange(plant.gridY, 0, 15) ||
      (plant.plantType !== "rose" &&
        plant.plantType !== "sunflower" &&
        plant.plantType !== "lavender")
    ) {
      return null;
    }
    const key = `${plant.gridX}:${plant.gridY}`;
    if (plantTiles.has(key)) continue;
    plantTiles.add(key);
    plants.push({
      gridX: Number(plant.gridX),
      gridY: Number(plant.gridY),
      plantType: plant.plantType,
    });
  }

  const pathTiles = new Set<string>();
  const paths: PendingGardenPreview["paths"] = [];
  for (const candidate of record.paths) {
    if (!candidate || typeof candidate !== "object") return null;
    const path = candidate as Record<string, unknown>;
    if (!integerInRange(path.gridX, 0, 11) || !integerInRange(path.gridY, 0, 15)) {
      return null;
    }
    const key = `${path.gridX}:${path.gridY}`;
    if (pathTiles.has(key)) continue;
    pathTiles.add(key);
    paths.push({ gridX: Number(path.gridX), gridY: Number(path.gridY) });
  }

  return { careBalance: Number(record.careBalance), plants, paths };
}
