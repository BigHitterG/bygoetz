const HOUR_MS = 60 * 60 * 1000;
const MOISTURE_HALF_LIFE_MS = 8 * HOUR_MS;
export const WATERING_CARE_COOLDOWN_MS = 4 * HOUR_MS;

export type PlantType = "rose" | "sunflower" | "lavender";

export type PlantState =
  | "seed"
  | "sprout"
  | "young"
  | "mature"
  | "blooming"
  | "wilting"
  | "dead"
  | "expired";

export type PlantLifecycle = {
  seedMs: number;
  sproutMs: number;
  youngMs: number;
  matureMs: number;
  wiltMs: number;
  deadMs: number;
  removeMs: number;
};

export type PlantDefinition = {
  type: PlantType;
  name: string;
  pluralName: string;
  scientificName: string;
  character: string;
  realWorldLifespan: string;
  gameLifespan: string;
  careNote: string;
  colorRadius: number;
  lifecycle: PlantLifecycle;
};

export const PLANT_TYPES: PlantType[] = ["rose", "sunflower", "lavender"];

export const PLANT_CATALOG: Record<PlantType, PlantDefinition> = {
  rose: {
    type: "rose",
    name: "Rose",
    pluralName: "Roses",
    scientificName: "Rosa",
    character: "A steady source of color with a balanced care rhythm.",
    realWorldLifespan: "Usually 6-10 years; some types live 50+ years",
    gameLifespan: "102 hours without care",
    careNote: "Blooms near hour 24 and begins wilting after 72 hours without water.",
    colorRadius: 58,
    lifecycle: {
      seedMs: 0.5 * HOUR_MS,
      sproutMs: 6 * HOUR_MS,
      youngMs: 14 * HOUR_MS,
      matureMs: 24 * HOUR_MS,
      wiltMs: 72 * HOUR_MS,
      deadMs: 96 * HOUR_MS,
      removeMs: 102 * HOUR_MS,
    },
  },
  sunflower: {
    type: "sunflower",
    name: "Sunflower",
    pluralName: "Sunflowers",
    scientificName: "Helianthus annuus",
    character: "A bright annual that grows quickly and asks for frequent care.",
    realWorldLifespan: "One growing season, commonly 70-120 days",
    gameLifespan: "66 hours without care",
    careNote: "Blooms near hour 14 and begins wilting after 42 hours without water.",
    colorRadius: 52,
    lifecycle: {
      seedMs: (1 / 3) * HOUR_MS,
      sproutMs: 3 * HOUR_MS,
      youngMs: 8 * HOUR_MS,
      matureMs: 14 * HOUR_MS,
      wiltMs: 42 * HOUR_MS,
      deadMs: 58 * HOUR_MS,
      removeMs: 66 * HOUR_MS,
    },
  },
  lavender: {
    type: "lavender",
    name: "Lavender",
    pluralName: "Lavender",
    scientificName: "Lavandula angustifolia",
    character: "A slow-growing perennial that rewards patient, lasting care.",
    realWorldLifespan: "About 10-15 years with good care",
    gameLifespan: "168 hours without care",
    careNote: "Blooms near hour 36 and begins wilting after 120 hours without water.",
    colorRadius: 48,
    lifecycle: {
      seedMs: 0.75 * HOUR_MS,
      sproutMs: 10 * HOUR_MS,
      youngMs: 22 * HOUR_MS,
      matureMs: 36 * HOUR_MS,
      wiltMs: 120 * HOUR_MS,
      deadMs: 156 * HOUR_MS,
      removeMs: 168 * HOUR_MS,
    },
  },
};

export type PlantRecord = {
  id: string;
  grid_x: number;
  grid_y: number;
  plant_type: PlantType;
  planted_at: string;
  last_watered_at: string;
  created_at: string;
  permanent?: boolean;
};

export type PlantVisual = {
  state: PlantState;
  ageMs: number;
  colorStrength: number;
  colorRadius: number;
  dampStrength: number;
};

export function getPlantDefinition(type: PlantType) {
  return PLANT_CATALOG[type] ?? PLANT_CATALOG.rose;
}

export function getMoistureStrength(careAgeMs: number, wiltMs: number) {
  if (careAgeMs >= wiltMs) return 0;

  return Math.pow(0.5, Math.max(0, careAgeMs) / MOISTURE_HALF_LIFE_MS);
}

export function getPlantVisual(plant: PlantRecord, now = Date.now()): PlantVisual {
  const definition = getPlantDefinition(plant.plant_type);
  const lifecycle = definition.lifecycle;
  const plantedAge = Math.max(0, now - Date.parse(plant.planted_at));
  const careAge = Math.max(0, now - Date.parse(plant.last_watered_at));

  if (plant.permanent) {
    return {
      state: "blooming",
      ageMs: plantedAge,
      colorStrength: 0.92,
      colorRadius: definition.colorRadius,
      dampStrength: 0.28,
    };
  }

  const dampStrength = getMoistureStrength(careAge, lifecycle.wiltMs);

  if (careAge >= lifecycle.removeMs) {
    return {
      state: "expired",
      ageMs: careAge,
      colorStrength: 0,
      colorRadius: 0,
      dampStrength: 0,
    };
  }

  if (careAge >= lifecycle.deadMs) {
    return {
      state: "dead",
      ageMs: careAge,
      colorStrength: 0,
      colorRadius: 0,
      dampStrength: 0,
    };
  }

  if (careAge >= lifecycle.wiltMs) {
    const wiltProgress =
      (careAge - lifecycle.wiltMs) /
      (lifecycle.deadMs - lifecycle.wiltMs);
    return {
      state: "wilting",
      ageMs: careAge,
      colorStrength: 0.48 - wiltProgress * 0.34,
      colorRadius: definition.colorRadius * (0.8 - wiltProgress * 0.42),
      dampStrength,
    };
  }

  if (plantedAge < lifecycle.seedMs) {
    const growth = plantedAge / lifecycle.seedMs;
    return {
      state: "seed",
      ageMs: plantedAge,
      colorStrength: 0.1 + growth * 0.08,
      colorRadius: 14 + growth * 4,
      dampStrength,
    };
  }

  if (plantedAge < lifecycle.sproutMs) {
    const growth =
      (plantedAge - lifecycle.seedMs) /
      (lifecycle.sproutMs - lifecycle.seedMs);
    return {
      state: "sprout",
      ageMs: plantedAge,
      colorStrength: 0.18 + growth * 0.1,
      colorRadius: 18 + growth * 8,
      dampStrength,
    };
  }

  if (plantedAge < lifecycle.youngMs) {
    const growth =
      (plantedAge - lifecycle.sproutMs) /
      (lifecycle.youngMs - lifecycle.sproutMs);
    return {
      state: "young",
      ageMs: plantedAge,
      colorStrength: 0.28 + growth * 0.12,
      colorRadius: 26 + growth * 8,
      dampStrength,
    };
  }

  if (plantedAge < lifecycle.matureMs) {
    const growth =
      (plantedAge - lifecycle.youngMs) /
      (lifecycle.matureMs - lifecycle.youngMs);
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
    colorRadius: definition.colorRadius + justWateredBoost * 18,
    dampStrength,
  };
}

export function isPlantable(plant: PlantRecord | undefined, now = Date.now()) {
  return !plant || getPlantVisual(plant, now).state === "expired";
}

export function canEarnWateringCare(
  plant: PlantRecord,
  now = Date.now(),
) {
  if (plant.permanent) return false;
  const lastWateredAt = Date.parse(plant.last_watered_at);
  return (
    Number.isFinite(lastWateredAt) &&
    lastWateredAt <= now - WATERING_CARE_COOLDOWN_MS
  );
}

export function isSpecialWateringFlower(
  plant: Pick<PlantRecord, "id">,
) {
  const firstByte = Number.parseInt(plant.id.slice(0, 2), 16);
  return Number.isFinite(firstByte) && firstByte % 64 === 0;
}

