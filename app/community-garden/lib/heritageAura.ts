import type { PlantRecord } from "./roseLifecycle";

export type HeritageAuraMultiplier = 1 | 2 | 4;
export type HeritageGrowthPhase = "ordinary" | "sheltered" | "deep-rooted";

export type HeritageGrowthProfile = {
  phase: HeritageGrowthPhase;
  horizontalScale: number;
  verticalScale: number;
  colorStrengthBoost: number;
  colorRadiusBoost: number;
};

const HERITAGE_GROWTH_PROFILES: Record<
  HeritageAuraMultiplier,
  HeritageGrowthProfile
> = {
  1: {
    phase: "ordinary",
    horizontalScale: 1,
    verticalScale: 1,
    colorStrengthBoost: 0,
    colorRadiusBoost: 0,
  },
  2: {
    phase: "sheltered",
    horizontalScale: 1.03,
    verticalScale: 1.06,
    colorStrengthBoost: 0.07,
    colorRadiusBoost: 4,
  },
  4: {
    phase: "deep-rooted",
    horizontalScale: 1.06,
    verticalScale: 1.12,
    colorStrengthBoost: 0.14,
    colorRadiusBoost: 8,
  },
};

function cellKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

export function getHeritageGrowthProfile(
  multiplier: HeritageAuraMultiplier,
): HeritageGrowthProfile {
  return HERITAGE_GROWTH_PROFILES[multiplier];
}

/**
 * Builds the small, visible aura field once per render. Each Heritage Flower
 * touches only the 24 cells in its surrounding 5x5 area, so lookup remains
 * constant-time while drawing every plant.
 */
export function buildHeritageAuraField(
  plants: ReadonlyArray<PlantRecord>,
): ReadonlyMap<string, HeritageAuraMultiplier> {
  const field = new Map<string, HeritageAuraMultiplier>();

  for (const plant of plants) {
    if (!plant.heritage_at) continue;

    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
        const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
        if (distance === 0 || distance > 2) continue;
        const multiplier: HeritageAuraMultiplier = distance === 1 ? 4 : 2;
        const key = cellKey(plant.grid_x + offsetX, plant.grid_y + offsetY);
        if ((field.get(key) ?? 1) < multiplier) field.set(key, multiplier);
      }
    }
  }

  return field;
}

export function getHeritageAuraFieldMultiplier(
  field: ReadonlyMap<string, HeritageAuraMultiplier>,
  gridX: number,
  gridY: number,
): HeritageAuraMultiplier {
  return field.get(cellKey(gridX, gridY)) ?? 1;
}

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
