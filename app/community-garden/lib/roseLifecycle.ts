import { GARDEN_CONFIG } from "./gardenConfig";

export type RoseState = "sprout" | "healthy" | "wilting" | "dead" | "expired";

export type RoseRecord = {
  id: string;
  grid_x: number;
  grid_y: number;
  planted_at: string;
  last_watered_at: string;
  created_at: string;
};

export type RoseVisual = {
  state: RoseState;
  ageMs: number;
  colorStrength: number;
  colorRadius: number;
};

export function getRoseVisual(rose: RoseRecord, now = Date.now()): RoseVisual {
  const plantedAge = Math.max(0, now - Date.parse(rose.planted_at));
  const careAge = Math.max(0, now - Date.parse(rose.last_watered_at));

  if (careAge >= GARDEN_CONFIG.removeMs) {
    return { state: "expired", ageMs: careAge, colorStrength: 0, colorRadius: 0 };
  }

  if (careAge >= GARDEN_CONFIG.deadMs) {
    return { state: "dead", ageMs: careAge, colorStrength: 0, colorRadius: 0 };
  }

  if (careAge >= GARDEN_CONFIG.wiltMs) {
    const wiltProgress =
      (careAge - GARDEN_CONFIG.wiltMs) /
      (GARDEN_CONFIG.deadMs - GARDEN_CONFIG.wiltMs);
    return {
      state: "wilting",
      ageMs: careAge,
      colorStrength: 0.48 - wiltProgress * 0.34,
      colorRadius: 46 - wiltProgress * 22,
    };
  }

  if (plantedAge < GARDEN_CONFIG.sproutMs) {
    const growth = plantedAge / GARDEN_CONFIG.sproutMs;
    return {
      state: "sprout",
      ageMs: plantedAge,
      colorStrength: 0.22 + growth * 0.22,
      colorRadius: 24 + growth * 12,
    };
  }

  const justWateredBoost = careAge < 10_000 ? 0.18 * (1 - careAge / 10_000) : 0;
  return {
    state: "healthy",
    ageMs: careAge,
    colorStrength: Math.min(1, 0.82 + justWateredBoost),
    colorRadius: 58 + justWateredBoost * 18,
  };
}

export function isRosePlantable(rose: RoseRecord | undefined, now = Date.now()) {
  return !rose || getRoseVisual(rose, now).state === "expired";
}

