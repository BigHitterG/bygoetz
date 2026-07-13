import { GARDEN_CONFIG } from "./gardenConfig";

export type RoseState =
  | "seed"
  | "sprout"
  | "young"
  | "mature"
  | "blooming"
  | "wilting"
  | "dead"
  | "expired";

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
  dampStrength: number;
};

export function getRoseVisual(rose: RoseRecord, now = Date.now()): RoseVisual {
  const plantedAge = Math.max(0, now - Date.parse(rose.planted_at));
  const careAge = Math.max(0, now - Date.parse(rose.last_watered_at));
  const dampStrength = Math.max(0, 1 - careAge / GARDEN_CONFIG.dampSoilMs);

  if (careAge >= GARDEN_CONFIG.removeMs) {
    return {
      state: "expired",
      ageMs: careAge,
      colorStrength: 0,
      colorRadius: 0,
      dampStrength: 0,
    };
  }

  if (careAge >= GARDEN_CONFIG.deadMs) {
    return {
      state: "dead",
      ageMs: careAge,
      colorStrength: 0,
      colorRadius: 0,
      dampStrength: 0,
    };
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
      dampStrength,
    };
  }

  if (plantedAge < GARDEN_CONFIG.seedMs) {
    const growth = plantedAge / GARDEN_CONFIG.seedMs;
    return {
      state: "seed",
      ageMs: plantedAge,
      colorStrength: 0.1 + growth * 0.08,
      colorRadius: 14 + growth * 4,
      dampStrength,
    };
  }

  if (plantedAge < GARDEN_CONFIG.sproutMs) {
    const growth =
      (plantedAge - GARDEN_CONFIG.seedMs) /
      (GARDEN_CONFIG.sproutMs - GARDEN_CONFIG.seedMs);
    return {
      state: "sprout",
      ageMs: plantedAge,
      colorStrength: 0.18 + growth * 0.1,
      colorRadius: 18 + growth * 8,
      dampStrength,
    };
  }

  if (plantedAge < GARDEN_CONFIG.youngMs) {
    const growth =
      (plantedAge - GARDEN_CONFIG.sproutMs) /
      (GARDEN_CONFIG.youngMs - GARDEN_CONFIG.sproutMs);
    return {
      state: "young",
      ageMs: plantedAge,
      colorStrength: 0.28 + growth * 0.12,
      colorRadius: 26 + growth * 8,
      dampStrength,
    };
  }

  if (plantedAge < GARDEN_CONFIG.matureMs) {
    const growth =
      (plantedAge - GARDEN_CONFIG.youngMs) /
      (GARDEN_CONFIG.matureMs - GARDEN_CONFIG.youngMs);
    return {
      state: "mature",
      ageMs: plantedAge,
      colorStrength: 0.4 + growth * 0.18,
      colorRadius: 34 + growth * 10,
      dampStrength,
    };
  }

  const justWateredBoost = careAge < 10_000 ? 0.18 * (1 - careAge / 10_000) : 0;
  return {
    state: "blooming",
    ageMs: careAge,
    colorStrength: Math.min(1, 0.82 + justWateredBoost),
    colorRadius: 58 + justWateredBoost * 18,
    dampStrength,
  };
}

export function isRosePlantable(rose: RoseRecord | undefined, now = Date.now()) {
  return !rose || getRoseVisual(rose, now).state === "expired";
}

