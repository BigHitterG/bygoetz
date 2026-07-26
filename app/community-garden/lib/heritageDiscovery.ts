import {
  PLANT_TYPES,
  type CommunityPlantType,
  type PlantRecord,
} from "./roseLifecycle.ts";

export const HERITAGE_DISCOVERY_STORAGE_KEY =
  "basil-heritage-flower-discovery-v1";
export const HERITAGE_ENCOUNTER_RADIUS_TILES = 5;
export const HERITAGE_GOLD_DARK = "#c99a2e";
export const HERITAGE_GOLD_LIGHT = "#f2d06b";

export type HeritageFlowerEncounter = {
  plantId: string;
  plantType: CommunityPlantType;
  gridX: number;
  gridY: number;
  becameHeritageAt: string;
};

export function findNearbyHeritageFlower(
  plants: Iterable<PlantRecord>,
  gridX: number,
  gridY: number,
  radius = HERITAGE_ENCOUNTER_RADIUS_TILES,
): HeritageFlowerEncounter | null {
  const maximumDistanceSquared = radius * radius;
  let nearest: HeritageFlowerEncounter | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const plant of plants) {
    if (
      !plant.heritage_at ||
      !PLANT_TYPES.includes(plant.plant_type as CommunityPlantType)
    ) {
      continue;
    }
    const deltaX = plant.grid_x - gridX;
    const deltaY = plant.grid_y - gridY;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (
      distanceSquared > maximumDistanceSquared ||
      distanceSquared >= nearestDistanceSquared
    ) {
      continue;
    }
    nearestDistanceSquared = distanceSquared;
    nearest = {
      plantId: plant.id,
      plantType: plant.plant_type as CommunityPlantType,
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      becameHeritageAt: plant.heritage_at,
    };
  }

  return nearest;
}
