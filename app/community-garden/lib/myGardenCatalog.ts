export const MY_GARDEN_COLLECTIONS = [
  {
    key: "starter",
    name: "Garden Starter",
    lifetimeCareRequired: 0,
    completionLifetimeCareRequired: 2_000,
    description: "The essentials for beginning a garden of your own.",
  },
  {
    key: "cottage",
    name: "Cottage Garden",
    lifetimeCareRequired: 2_000,
    completionLifetimeCareRequired: 15_000,
    description: "Soft flowers, useful tools and welcoming places to sit.",
  },
  {
    key: "pollinator",
    name: "Pollinator Garden",
    lifetimeCareRequired: 15_000,
    completionLifetimeCareRequired: 50_000,
    description: "Flowers and small homes that invite garden visitors.",
  },
  {
    key: "water",
    name: "Water Garden",
    lifetimeCareRequired: 50_000,
    completionLifetimeCareRequired: 200_000,
    description: "Quiet water, reeds and a willow for a calmer corner.",
  },
] as const;

export const BASIL_LIFETIME_CARE_GOAL = 7_500_000;

export type MyGardenCollectionKey =
  (typeof MY_GARDEN_COLLECTIONS)[number]["key"];

export type MyGardenInventoryCategory =
  | "plants"
  | "paths"
  | "decor"
  | "nature"
  | "water";

export type MyGardenElementIcon =
  | "birdhouse"
  | "bench"
  | "paver"
  | "pot"
  | "shrub"
  | "tool"
  | "planter"
  | "feeder"
  | "trellis"
  | "sign"
  | "hive"
  | "reeds"
  | "lily"
  | "basin"
  | "tree"
  | "fountain"
  | "pond";

export const MY_GARDEN_PLANTS = [
  {
    type: "rose",
    name: "Rose",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "sunflower",
    name: "Sunflower",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "lavender",
    name: "Lavender",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "daisy",
    name: "Daisy",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 100,
  },
  {
    type: "tulip",
    name: "Tulip",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 250,
  },
  {
    type: "wildflowers",
    name: "Wildflowers",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 500,
  },
  {
    type: "peony",
    name: "Peony",
    careCost: 4,
    collection: "cottage",
    lifetimeCareRequired: 2_000,
  },
  {
    type: "bee_balm",
    name: "Bee balm",
    careCost: 2,
    collection: "pollinator",
    lifetimeCareRequired: 15_000,
  },
] as const satisfies ReadonlyArray<{
  type: string;
  name: string;
  careCost: number;
  collection: MyGardenCollectionKey;
  lifetimeCareRequired: number;
}>;

export type MyGardenPlantType = (typeof MY_GARDEN_PLANTS)[number]["type"];

export const MY_GARDEN_ELEMENTS = [
  {
    type: "stone_paver",
    name: "Stone paver",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 0,
    category: "paths",
    icon: "paver",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "gravel_tile",
    name: "Gravel tile",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 750,
    category: "paths",
    icon: "paver",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "brick_paver",
    name: "Brick paver",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 1_000,
    category: "paths",
    icon: "paver",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "clay_pot",
    name: "Clay pot",
    careCost: 3,
    collection: "starter",
    lifetimeCareRequired: 1_300,
    category: "decor",
    icon: "pot",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "hedge",
    name: "Hedge",
    careCost: 4,
    collection: "starter",
    lifetimeCareRequired: 1_600,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "birdhouse",
    name: "Birdhouse",
    careCost: 6,
    collection: "starter",
    lifetimeCareRequired: 0,
    category: "decor",
    icon: "birdhouse",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "bench",
    name: "Garden bench",
    careCost: 10,
    collection: "starter",
    lifetimeCareRequired: 0,
    category: "decor",
    icon: "bench",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "fern",
    name: "Fern",
    careCost: 25,
    collection: "cottage",
    lifetimeCareRequired: 3_000,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "hydrangea",
    name: "Hydrangea",
    careCost: 40,
    collection: "cottage",
    lifetimeCareRequired: 4_500,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wheelbarrow",
    name: "Wheelbarrow",
    careCost: 50,
    collection: "cottage",
    lifetimeCareRequired: 6_000,
    category: "decor",
    icon: "tool",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wooden_planter",
    name: "Wooden planter",
    careCost: 75,
    collection: "cottage",
    lifetimeCareRequired: 7_500,
    category: "decor",
    icon: "planter",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "bird_feeder",
    name: "Bird feeder",
    careCost: 100,
    collection: "cottage",
    lifetimeCareRequired: 9_000,
    category: "decor",
    icon: "feeder",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rustic_bench",
    name: "Rustic bench",
    careCost: 125,
    collection: "cottage",
    lifetimeCareRequired: 11_000,
    category: "decor",
    icon: "bench",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "trellis",
    name: "Trellis",
    careCost: 200,
    collection: "cottage",
    lifetimeCareRequired: 13_000,
    category: "decor",
    icon: "trellis",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_bush",
    name: "Butterfly bush",
    careCost: 60,
    collection: "pollinator",
    lifetimeCareRequired: 19_000,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "pollinator_sign",
    name: "Pollinator sign",
    careCost: 100,
    collection: "pollinator",
    lifetimeCareRequired: 23_000,
    category: "decor",
    icon: "sign",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_house",
    name: "Butterfly house",
    careCost: 150,
    collection: "pollinator",
    lifetimeCareRequired: 28_000,
    category: "decor",
    icon: "birdhouse",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "beehive",
    name: "Beehive",
    careCost: 250,
    collection: "pollinator",
    lifetimeCareRequired: 34_000,
    category: "decor",
    icon: "hive",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rose_trellis",
    name: "Rose-covered trellis",
    careCost: 400,
    collection: "pollinator",
    lifetimeCareRequired: 42_000,
    category: "decor",
    icon: "trellis",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "reeds",
    name: "Reeds",
    careCost: 10,
    collection: "water",
    lifetimeCareRequired: 50_000,
    category: "water",
    icon: "reeds",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "lily_pads",
    name: "Lily pads",
    careCost: 15,
    collection: "water",
    lifetimeCareRequired: 60_000,
    category: "water",
    icon: "lily",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "birdbath",
    name: "Birdbath",
    careCost: 250,
    collection: "water",
    lifetimeCareRequired: 75_000,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "stone_basin",
    name: "Stone basin",
    careCost: 500,
    collection: "water",
    lifetimeCareRequired: 90_000,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "willow_tree",
    name: "Willow tree",
    careCost: 800,
    collection: "water",
    lifetimeCareRequired: 110_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "fountain",
    name: "Garden fountain",
    careCost: 1_500,
    collection: "water",
    lifetimeCareRequired: 135_000,
    category: "water",
    icon: "fountain",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "small_pond",
    name: "Small pond",
    careCost: 2_500,
    collection: "water",
    lifetimeCareRequired: 165_000,
    category: "water",
    icon: "pond",
    footprintWidth: 3,
    footprintHeight: 2,
  },
] as const satisfies ReadonlyArray<{
  type: string;
  name: string;
  careCost: number;
  collection: MyGardenCollectionKey;
  lifetimeCareRequired: number;
  category: Exclude<MyGardenInventoryCategory, "plants">;
  icon: MyGardenElementIcon;
  footprintWidth: number;
  footprintHeight: number;
}>;

export type MyGardenElementType = (typeof MY_GARDEN_ELEMENTS)[number]["type"];
export type MyGardenElementDefinition = (typeof MY_GARDEN_ELEMENTS)[number];

export type MyGardenCatalogUnlock = {
  key: string;
  kind: "plant" | "element";
  name: string;
  collection: MyGardenCollectionKey;
  category: MyGardenInventoryCategory;
  lifetimeCareRequired: number;
  plantType?: MyGardenPlantType;
  elementType?: MyGardenElementType;
};

export type MyGardenUnlockNotice = {
  lifetimeCareRequired: number;
  items: MyGardenCatalogUnlock[];
  completedCollection: (typeof MY_GARDEN_COLLECTIONS)[number] | null;
  openedCollection: (typeof MY_GARDEN_COLLECTIONS)[number] | null;
};

export const MY_GARDEN_CATALOG_UNLOCKS: readonly MyGardenCatalogUnlock[] = [
  ...MY_GARDEN_PLANTS.map((plant) => ({
    key: `plant:${plant.type}`,
    kind: "plant" as const,
    name: plant.name,
    collection: plant.collection,
    category: "plants" as const,
    lifetimeCareRequired: plant.lifetimeCareRequired,
    plantType: plant.type,
  })),
  ...MY_GARDEN_ELEMENTS.map((element) => ({
    key: `element:${element.type}`,
    kind: "element" as const,
    name: element.name,
    collection: element.collection,
    category: element.category,
    lifetimeCareRequired: element.lifetimeCareRequired,
    elementType: element.type,
  })),
].sort(
  (left, right) =>
    left.lifetimeCareRequired - right.lifetimeCareRequired ||
    left.name.localeCompare(right.name),
);

export function getMyGardenCollection(collection: MyGardenCollectionKey) {
  return MY_GARDEN_COLLECTIONS.find((entry) => entry.key === collection)!;
}

export function getMyGardenPlant(type: MyGardenPlantType) {
  return MY_GARDEN_PLANTS.find((plant) => plant.type === type)!;
}

export function isMyGardenPlantType(value: string): value is MyGardenPlantType {
  return MY_GARDEN_PLANTS.some((plant) => plant.type === value);
}

export function getMyGardenElement(type: MyGardenElementType) {
  return MY_GARDEN_ELEMENTS.find((element) => element.type === type)!;
}

export function isMyGardenElementType(
  value: string,
): value is MyGardenElementType {
  return MY_GARDEN_ELEMENTS.some((element) => element.type === value);
}

export function isMyGardenCatalogEntryUnlocked(
  entry: { lifetimeCareRequired: number },
  lifetimeCare: number,
) {
  return lifetimeCare >= entry.lifetimeCareRequired;
}

export function getMyGardenUnlockNotices(
  previousLifetimeCare: number,
  lifetimeCare: number,
) {
  if (lifetimeCare <= previousLifetimeCare) return [] as MyGardenUnlockNotice[];

  const thresholds = new Set<number>();
  for (const entry of MY_GARDEN_CATALOG_UNLOCKS) {
    if (
      entry.lifetimeCareRequired > previousLifetimeCare &&
      entry.lifetimeCareRequired <= lifetimeCare
    ) {
      thresholds.add(entry.lifetimeCareRequired);
    }
  }
  for (const collection of MY_GARDEN_COLLECTIONS) {
    if (
      collection.completionLifetimeCareRequired > previousLifetimeCare &&
      collection.completionLifetimeCareRequired <= lifetimeCare
    ) {
      thresholds.add(collection.completionLifetimeCareRequired);
    }
  }

  return [...thresholds]
    .sort((left, right) => left - right)
    .map((threshold) => ({
      lifetimeCareRequired: threshold,
      items: MY_GARDEN_CATALOG_UNLOCKS.filter(
        (entry) => entry.lifetimeCareRequired === threshold,
      ),
      completedCollection:
        MY_GARDEN_COLLECTIONS.find(
          (collection) =>
            collection.completionLifetimeCareRequired === threshold,
        ) ?? null,
      openedCollection:
        MY_GARDEN_COLLECTIONS.find(
          (collection) =>
            collection.key !== "starter" &&
            collection.lifetimeCareRequired === threshold,
        ) ?? null,
    }));
}

export function getMyGardenUnreadUnlockCount(
  inventorySeenLifetimeCare: number,
  lifetimeCare: number,
) {
  return getMyGardenUnlockNotices(
    Math.max(0, inventorySeenLifetimeCare),
    lifetimeCare,
  ).length;
}

export function getMyGardenElementGlyphClass(type: MyGardenElementType) {
  return `is-${getMyGardenElement(type).icon} is-item-${type}`;
}
