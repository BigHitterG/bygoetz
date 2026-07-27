import type { PlantRecord } from "./roseLifecycle";

export type HeritageAuraMultiplier = 1 | 2 | 4;

export function getHeritageAuraMultiplier(
  plants: ReadonlyArray<PlantRecord>,
  gridX: number,
  gridY: number,
): HeritageAuraMultiplier {
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const plant of plants) {
    if (!plant.heritage_at) continue;
    const distance = Math.max(
      Math.abs(plant.grid_x - gridX),
      Math.abs(plant.grid_y - gridY),
    );
    if (distance < closestDistance) closestDistance = distance;
  }

  if (closestDistance <= 1) return 4;
  if (closestDistance <= 2) return 2;
  return 1;
}

export function findHeritageAuraAnchor(
  plants: ReadonlyArray<PlantRecord>,
  gridX: number,
  gridY: number,
) {
  return plants
    .filter((plant) => plant.heritage_at)
    .map((plant) => ({
      plant,
      distance: Math.max(
        Math.abs(plant.grid_x - gridX),
        Math.abs(plant.grid_y - gridY),
      ),
    }))
    .filter(({ distance }) => distance <= 2)
    .sort((left, right) =>
      left.distance - right.distance ||
      left.plant.grid_y - right.plant.grid_y ||
      left.plant.grid_x - right.plant.grid_x,
    )[0]?.plant ?? null;
}
