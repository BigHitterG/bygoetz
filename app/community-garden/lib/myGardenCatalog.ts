export const MY_GARDEN_COLLECTIONS = [
  {
    key: "starter",
    name: "Garden Starter",
    lifetimeCareRequired: 0,
    completionLifetimeCareRequired: 500,
    description: "The essentials for beginning a garden of your own.",
  },
  {
    key: "cottage",
    name: "Cottage Garden",
    lifetimeCareRequired: 500,
    completionLifetimeCareRequired: 3_750,
    description: "Soft flowers, useful tools and welcoming places to sit.",
  },
  {
    key: "pollinator",
    name: "Pollinator Garden",
    lifetimeCareRequired: 3_750,
    completionLifetimeCareRequired: 12_500,
    description: "Flowers and small homes that invite garden visitors.",
  },
  {
    key: "water",
    name: "Water Garden",
    lifetimeCareRequired: 12_500,
    completionLifetimeCareRequired: 50_000,
    description: "Quiet water, reeds and a willow for a calmer corner.",
  },
  {
    key: "woodland",
    name: "Woodland Garden",
    lifetimeCareRequired: 50_000,
    completionLifetimeCareRequired: 125_000,
    description: "Layered shrubs, gathering places and trees with real presence.",
  },
  {
    key: "working",
    name: "Working Garden",
    lifetimeCareRequired: 125_000,
    completionLifetimeCareRequired: 300_000,
    description: "Useful structures for a garden shaped by patient hands.",
  },
  {
    key: "heritage",
    name: "Heritage Garden",
    lifetimeCareRequired: 300_000,
    completionLifetimeCareRequired: 625_000,
    description: "Formal water, architecture and enduring garden landmarks.",
  },
  {
    key: "botanical",
    name: "Botanical Masterworks",
    lifetimeCareRequired: 625_000,
    completionLifetimeCareRequired: 1_000_000,
    description: "Grand structures for a garden approaching mastery.",
  },
  {
    key: "basil",
    name: "Basil I",
    lifetimeCareRequired: 1_000_000,
    completionLifetimeCareRequired: 1_000_000,
    description: "The first permanent mark of Botanical mastery.",
  },
] as const;

export const BASIL_LIFETIME_CARE_GOAL = 1_000_000;

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
  | "pond"
  | "greenhouse";

export const MY_GARDEN_PLANTS = [
  {
    type: "rose",
    name: "Rose",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "sunflower",
    name: "Sunflower",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "lavender",
    name: "Lavender",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "daisy",
    name: "Daisy",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 25,
  },
  {
    type: "tulip",
    name: "Tulip",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 60,
  },
  {
    type: "wildflowers",
    name: "Wildflowers",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 125,
  },
  {
    type: "peony",
    name: "Peony",
    careCost: 1,
    collection: "cottage",
    lifetimeCareRequired: 500,
  },
  {
    type: "bee_balm",
    name: "Bee balm",
    careCost: 1,
    collection: "pollinator",
    lifetimeCareRequired: 3_750,
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
    lifetimeCareRequired: 200,
    category: "paths",
    icon: "paver",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "brick_paver",
    name: "Brick paver",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 250,
    category: "paths",
    icon: "paver",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "clay_pot",
    name: "Clay pot",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 325,
    category: "decor",
    icon: "pot",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "hedge",
    name: "Hedge",
    careCost: 1,
    collection: "starter",
    lifetimeCareRequired: 400,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "birdhouse",
    name: "Birdhouse",
    careCost: 2,
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
    careCost: 3,
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
    careCost: 6,
    collection: "cottage",
    lifetimeCareRequired: 750,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "hydrangea",
    name: "Hydrangea",
    careCost: 10,
    collection: "cottage",
    lifetimeCareRequired: 1_100,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wheelbarrow",
    name: "Wheelbarrow",
    careCost: 12,
    collection: "cottage",
    lifetimeCareRequired: 1_500,
    category: "decor",
    icon: "tool",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wooden_planter",
    name: "Wooden planter",
    careCost: 20,
    collection: "cottage",
    lifetimeCareRequired: 1_900,
    category: "decor",
    icon: "planter",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "bird_feeder",
    name: "Bird feeder",
    careCost: 25,
    collection: "cottage",
    lifetimeCareRequired: 2_250,
    category: "decor",
    icon: "feeder",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rustic_bench",
    name: "Rustic bench",
    careCost: 30,
    collection: "cottage",
    lifetimeCareRequired: 2_750,
    category: "decor",
    icon: "bench",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "trellis",
    name: "Trellis",
    careCost: 50,
    collection: "cottage",
    lifetimeCareRequired: 3_250,
    category: "decor",
    icon: "trellis",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_bush",
    name: "Butterfly bush",
    careCost: 15,
    collection: "pollinator",
    lifetimeCareRequired: 4_750,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "pollinator_sign",
    name: "Pollinator sign",
    careCost: 25,
    collection: "pollinator",
    lifetimeCareRequired: 5_750,
    category: "decor",
    icon: "sign",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_house",
    name: "Butterfly house",
    careCost: 40,
    collection: "pollinator",
    lifetimeCareRequired: 7_000,
    category: "decor",
    icon: "birdhouse",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "beehive",
    name: "Beehive",
    careCost: 60,
    collection: "pollinator",
    lifetimeCareRequired: 8_500,
    category: "decor",
    icon: "hive",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rose_trellis",
    name: "Rose-covered trellis",
    careCost: 100,
    collection: "pollinator",
    lifetimeCareRequired: 10_500,
    category: "decor",
    icon: "trellis",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "reeds",
    name: "Reeds",
    careCost: 3,
    collection: "water",
    lifetimeCareRequired: 12_500,
    category: "water",
    icon: "reeds",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "lily_pads",
    name: "Lily pads",
    careCost: 4,
    collection: "water",
    lifetimeCareRequired: 15_000,
    category: "water",
    icon: "lily",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "birdbath",
    name: "Birdbath",
    careCost: 60,
    collection: "water",
    lifetimeCareRequired: 19_000,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "stone_basin",
    name: "Stone basin",
    careCost: 125,
    collection: "water",
    lifetimeCareRequired: 22_500,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "willow_tree",
    name: "Willow tree",
    careCost: 200,
    collection: "water",
    lifetimeCareRequired: 27_500,
    category: "nature",
    icon: "tree",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "fountain",
    name: "Garden fountain",
    careCost: 375,
    collection: "water",
    lifetimeCareRequired: 34_000,
    category: "water",
    icon: "fountain",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "small_pond",
    name: "Small pond",
    careCost: 625,
    collection: "water",
    lifetimeCareRequired: 41_500,
    category: "water",
    icon: "pond",
    footprintWidth: 3,
    footprintHeight: 2,
  },
  {
    type: "woodland_shrub",
    name: "Woodland shrub",
    careCost: 3,
    collection: "woodland",
    lifetimeCareRequired: 50_000,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "log_bench",
    name: "Log bench",
    careCost: 5,
    collection: "woodland",
    lifetimeCareRequired: 60_000,
    category: "decor",
    icon: "bench",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "pine_tree",
    name: "Pine tree",
    careCost: 13,
    collection: "woodland",
    lifetimeCareRequired: 70_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "maple_tree",
    name: "Maple tree",
    careCost: 18,
    collection: "woodland",
    lifetimeCareRequired: 80_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "flowering_tree",
    name: "Flowering tree",
    careCost: 23,
    collection: "woodland",
    lifetimeCareRequired: 90_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "bonsai_tree",
    name: "Bonsai tree",
    careCost: 30,
    collection: "woodland",
    lifetimeCareRequired: 105_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "grand_oak",
    name: "Grand oak",
    careCost: 75,
    collection: "woodland",
    lifetimeCareRequired: 115_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 3,
    footprintHeight: 2,
  },
  {
    type: "compost_bin",
    name: "Compost bin",
    careCost: 5,
    collection: "working",
    lifetimeCareRequired: 125_000,
    category: "decor",
    icon: "planter",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "potting_table",
    name: "Potting table",
    careCost: 12,
    collection: "working",
    lifetimeCareRequired: 145_000,
    category: "decor",
    icon: "bench",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "raised_bed",
    name: "Raised bed",
    careCost: 20,
    collection: "working",
    lifetimeCareRequired: 170_000,
    category: "nature",
    icon: "planter",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "cold_frame",
    name: "Cold frame",
    careCost: 30,
    collection: "working",
    lifetimeCareRequired: 200_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "garden_shed",
    name: "Garden shed",
    careCost: 75,
    collection: "working",
    lifetimeCareRequired: 235_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 3,
    footprintHeight: 2,
  },
  {
    type: "small_greenhouse",
    name: "Small greenhouse",
    careCost: 150,
    collection: "working",
    lifetimeCareRequired: 275_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 3,
    footprintHeight: 3,
  },
  {
    type: "topiary_arch",
    name: "Topiary arch",
    careCost: 60,
    collection: "heritage",
    lifetimeCareRequired: 300_000,
    category: "nature",
    icon: "trellis",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "pergola",
    name: "Pergola",
    careCost: 100,
    collection: "heritage",
    lifetimeCareRequired: 350_000,
    category: "decor",
    icon: "trellis",
    footprintWidth: 3,
    footprintHeight: 2,
  },
  {
    type: "greenhouse_extension",
    name: "Greenhouse extension",
    careCost: 90,
    collection: "heritage",
    lifetimeCareRequired: 405_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 3,
    footprintHeight: 2,
  },
  {
    type: "mosaic_fountain",
    name: "Mosaic fountain",
    careCost: 125,
    collection: "heritage",
    lifetimeCareRequired: 465_000,
    category: "water",
    icon: "fountain",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "formal_pond",
    name: "Formal pond",
    careCost: 165,
    collection: "heritage",
    lifetimeCareRequired: 530_000,
    category: "water",
    icon: "pond",
    footprintWidth: 4,
    footprintHeight: 3,
  },
  {
    type: "conservatory",
    name: "Conservatory",
    careCost: 375,
    collection: "heritage",
    lifetimeCareRequired: 590_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 4,
    footprintHeight: 3,
  },
  {
    type: "grand_rose_pergola",
    name: "Grand rose pergola",
    careCost: 300,
    collection: "botanical",
    lifetimeCareRequired: 625_000,
    category: "decor",
    icon: "trellis",
    footprintWidth: 4,
    footprintHeight: 2,
  },
  {
    type: "glass_pavilion",
    name: "Glass pavilion",
    careCost: 625,
    collection: "botanical",
    lifetimeCareRequired: 750_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 4,
    footprintHeight: 3,
  },
  {
    type: "botanical_glasshouse",
    name: "Botanical glasshouse",
    careCost: 1_000,
    collection: "botanical",
    lifetimeCareRequired: 875_000,
    category: "decor",
    icon: "greenhouse",
    footprintWidth: 5,
    footprintHeight: 4,
  },
  {
    type: "great_basil_topiary",
    name: "Great Basil topiary",
    careCost: 2_500,
    collection: "basil",
    lifetimeCareRequired: 1_000_000,
    category: "nature",
    icon: "tree",
    footprintWidth: 3,
    footprintHeight: 3,
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
