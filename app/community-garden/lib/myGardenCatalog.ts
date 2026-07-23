export const MY_GARDEN_COLLECTIONS = [
  {
    key: "starter",
    name: "Garden Starter",
    lifetimeCareRequired: 0,
    description: "The essentials for beginning a garden of your own.",
  },
  {
    key: "cottage",
    name: "Cottage Garden",
    lifetimeCareRequired: 250,
    description: "Soft flowers, useful tools and welcoming places to sit.",
  },
  {
    key: "pollinator",
    name: "Pollinator Garden",
    lifetimeCareRequired: 750,
    description: "Flowers and small homes that invite garden visitors.",
  },
  {
    key: "water",
    name: "Water Garden",
    lifetimeCareRequired: 1_500,
    description: "Quiet water, reeds and a willow for a calmer corner.",
  },
] as const;

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
    lifetimeCareRequired: 0,
  },
  {
    type: "tulip",
    name: "Tulip",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "wildflowers",
    name: "Wildflowers",
    careCost: 2,
    collection: "starter",
    lifetimeCareRequired: 0,
  },
  {
    type: "peony",
    name: "Peony",
    careCost: 2,
    collection: "cottage",
    lifetimeCareRequired: 250,
  },
  {
    type: "bee_balm",
    name: "Bee balm",
    careCost: 2,
    collection: "pollinator",
    lifetimeCareRequired: 750,
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
    lifetimeCareRequired: 0,
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
    lifetimeCareRequired: 0,
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
    lifetimeCareRequired: 0,
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
    lifetimeCareRequired: 0,
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
    careCost: 5,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "hydrangea",
    name: "Hydrangea",
    careCost: 8,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wheelbarrow",
    name: "Wheelbarrow",
    careCost: 8,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "decor",
    icon: "tool",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "wooden_planter",
    name: "Wooden planter",
    careCost: 8,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "decor",
    icon: "planter",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "bird_feeder",
    name: "Bird feeder",
    careCost: 12,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "decor",
    icon: "feeder",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rustic_bench",
    name: "Rustic bench",
    careCost: 12,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "decor",
    icon: "bench",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "trellis",
    name: "Trellis",
    careCost: 25,
    collection: "cottage",
    lifetimeCareRequired: 250,
    category: "decor",
    icon: "trellis",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_bush",
    name: "Butterfly bush",
    careCost: 10,
    collection: "pollinator",
    lifetimeCareRequired: 750,
    category: "nature",
    icon: "shrub",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "pollinator_sign",
    name: "Pollinator sign",
    careCost: 12,
    collection: "pollinator",
    lifetimeCareRequired: 750,
    category: "decor",
    icon: "sign",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "butterfly_house",
    name: "Butterfly house",
    careCost: 20,
    collection: "pollinator",
    lifetimeCareRequired: 750,
    category: "decor",
    icon: "birdhouse",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "beehive",
    name: "Beehive",
    careCost: 35,
    collection: "pollinator",
    lifetimeCareRequired: 750,
    category: "decor",
    icon: "hive",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "rose_trellis",
    name: "Rose-covered trellis",
    careCost: 50,
    collection: "pollinator",
    lifetimeCareRequired: 750,
    category: "decor",
    icon: "trellis",
    footprintWidth: 2,
    footprintHeight: 1,
  },
  {
    type: "reeds",
    name: "Reeds",
    careCost: 5,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "water",
    icon: "reeds",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "lily_pads",
    name: "Lily pads",
    careCost: 5,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "water",
    icon: "lily",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "birdbath",
    name: "Birdbath",
    careCost: 35,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "stone_basin",
    name: "Stone basin",
    careCost: 60,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "water",
    icon: "basin",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "willow_tree",
    name: "Willow tree",
    careCost: 100,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "nature",
    icon: "tree",
    footprintWidth: 1,
    footprintHeight: 1,
  },
  {
    type: "fountain",
    name: "Garden fountain",
    careCost: 175,
    collection: "water",
    lifetimeCareRequired: 1_500,
    category: "water",
    icon: "fountain",
    footprintWidth: 2,
    footprintHeight: 2,
  },
  {
    type: "small_pond",
    name: "Small pond",
    careCost: 250,
    collection: "water",
    lifetimeCareRequired: 1_500,
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

export function getMyGardenElementGlyphClass(type: MyGardenElementType) {
  return `is-${getMyGardenElement(type).icon} is-item-${type}`;
}
