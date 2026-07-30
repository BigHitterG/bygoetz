import type {
  MyGardenElementType,
  MyGardenPlantType,
} from "./myGardenCatalog";

export const LIVING_GARDEN_HABITAT_KEYS = [
  "garden_sparrow",
  "goldfinch",
  "bathing_robin",
  "woodland_chickadee",
  "monarch_butterfly",
  "honeybee",
  "bumblebee",
  "dragonfly",
  "garden_frog",
  "willow_songbird",
  "garden_earthworm",
  "greenhouse_seedlings",
  "tree_canopy",
  "oak_sanctuary",
] as const;

export type LivingGardenHabitatKey =
  (typeof LIVING_GARDEN_HABITAT_KEYS)[number];

export type LivingGardenVisitorKind =
  | "bird"
  | "butterfly"
  | "bee"
  | "dragonfly"
  | "frog"
  | "worm"
  | "seedlings"
  | "canopy"
  | "owl";

export type LivingGardenSprite = {
  pixels: readonly string[];
  palette: Readonly<Record<string, string>>;
};

export type LivingGardenDefinition = {
  key: LivingGardenHabitatKey;
  chapter: "Garden Birds" | "Pollinators" | "Water Visitors" | "Working Garden" | "Woodland Life";
  name: string;
  discoveryTitle: string;
  discoveryCopy: string;
  clue: string;
  hints: readonly [string, string, string];
  recipe: string;
  lifetimeCareRequired: number;
  visitorKind: LivingGardenVisitorKind;
  sprite: LivingGardenSprite;
};

function sprite(
  palette: Readonly<Record<string, string>>,
  ...pixels: readonly string[]
): LivingGardenSprite {
  return { palette, pixels };
}

export type LivingGardenPlant = {
  id?: string;
  gridX: number;
  gridY: number;
  plantType: MyGardenPlantType;
};

export type LivingGardenElement = {
  id?: string;
  gridX: number;
  gridY: number;
  elementType: MyGardenElementType;
};

export type LivingGardenHabitat = {
  key: LivingGardenHabitatKey;
  gridX: number;
  gridY: number;
  signature: string;
};

export type LivingGardenDiscovery = {
  habitatKey: LivingGardenHabitatKey;
  discoveredAt: string;
  firstCenterX: number;
  firstCenterY: number;
  acknowledgedAt: string | null;
};

export const LIVING_GARDEN_DEFINITIONS: readonly LivingGardenDefinition[] = [
  {
    key: "garden_sparrow", chapter: "Garden Birds", name: "Garden sparrow",
    discoveryTitle: "A habitat has come alive",
    discoveryCopy: "Your birdhouse and flowers attracted a garden sparrow.",
    clue: "A small bird is looking for a flower-filled home.",
    hints: ["Begin with a birdhouse.", "Flowers make the landing feel safe.", "Keep three flowers close to the birdhouse."],
    recipe: "Place a birdhouse within three tiles of at least three flowers.", lifetimeCareRequired: 0, visitorKind: "bird",
    sprite: sprite(
      { b: "#866647", c: "#d9c49c", y: "#d99a36", l: "#5b4637" },
      "...........", "......bb...", "..bbbbbbb..", ".bcbccbbb..", ".bbbbbbby..",
      "..bbbbbbb..", "...b..b....", "..l...l....", "...........",
    ),
  },
  {
    key: "goldfinch", chapter: "Garden Birds", name: "Goldfinch",
    discoveryTitle: "A flash of gold",
    discoveryCopy: "A goldfinch found seeds beside your bird feeder.",
    clue: "A bright bird listens for seed heads near a feeder.",
    hints: ["A bird feeder is essential.", "Goldfinches favor seed-rich flowers.", "Try sunflowers or wildflowers beside the feeder."],
    recipe: "Place a bird feeder near sunflowers or wildflowers.", lifetimeCareRequired: 2_250, visitorKind: "bird",
    sprite: sprite(
      { k: "#302d2a", y: "#e6c52f", w: "#fff4c1", o: "#d7812c", l: "#5b4637" },
      "...........", "......kk...", "..kkyyyyy..", ".kyyyyyykk.", ".kywyyyyyo.",
      "..kyyyyyk..", "...k..k....", "..l...l....", "...........",
    ),
  },
  {
    key: "bathing_robin", chapter: "Garden Birds", name: "Bathing robin",
    discoveryTitle: "A visitor took a bath",
    discoveryCopy: "A robin discovered the water and shelter in your garden.",
    clue: "A familiar garden bird wants water, shelter, and a leafy landing.",
    hints: ["Fresh water comes first.", "Add a birdhouse or feeder nearby.", "A few plants complete the bathing corner."],
    recipe: "Place a birdbath near a birdhouse or feeder and at least two plants.", lifetimeCareRequired: 19_000, visitorKind: "bird",
    sprite: sprite(
      { b: "#745441", r: "#bd593d", w: "#ead7bd", o: "#d68a34", l: "#514033" },
      "...........", "......bb...", "..bbbbbbb..", ".bbbbbbbbo.", ".bwwrrrrr..",
      "..brrrrb...", "...b..b....", "..l...l....", "...........",
    ),
  },
  {
    key: "woodland_chickadee", chapter: "Garden Birds", name: "Woodland chickadee",
    discoveryTitle: "A woodland song arrived",
    discoveryCopy: "A chickadee found a home beneath your tree canopy.",
    clue: "A tiny woodland bird needs a nesting place near a tall tree.",
    hints: ["Start with a birdhouse.", "The visitor prefers woodland cover.", "Place the birdhouse near a pine, maple, flowering tree, or grand oak."],
    recipe: "Place a birdhouse near a large tree.", lifetimeCareRequired: 70_000, visitorKind: "bird",
    sprite: sprite(
      { k: "#292c2b", w: "#f3eee1", g: "#7e8983", o: "#d58a30", l: "#514033" },
      "...........", "....kkk....", "..kkkkkkk..", ".kwwggggko.", ".kwwggggg..",
      "..kggggk...", "...k..k....", "..l...l....", "...........",
    ),
  },
  {
    key: "monarch_butterfly", chapter: "Pollinators", name: "Monarch butterfly",
    discoveryTitle: "A monarch found your garden",
    discoveryCopy: "Your varied flowers and butterfly shelter attracted a monarch.",
    clue: "A wandering butterfly searches for shelter and a varied patch of color.",
    hints: ["A butterfly house offers shelter.", "A butterfly bush is a strong invitation.", "Surround them with three different flower varieties."],
    recipe: "Place a butterfly house and butterfly bush near at least three flower varieties.", lifetimeCareRequired: 7_000, visitorKind: "butterfly",
    sprite: sprite(
      { k: "#2d2925", o: "#df7531" },
      "...........", ".kookkook..", "kooookooook", "koo.kkk.ook", ".oo..k..oo.",
      "..o..k..o..", ".....k.....", "....k.k....", "...........",
    ),
  },
  {
    key: "honeybee", chapter: "Pollinators", name: "Honeybee",
    discoveryTitle: "The hive is humming",
    discoveryCopy: "Your pollinator patch brought honeybees out of the hive.",
    clue: "A busy hive needs a generous patch of more than one flower.",
    hints: ["Place a beehive.", "Four nearby flowers will keep it busy.", "Use at least two pollinator-friendly flower varieties."],
    recipe: "Place a beehive near four pollinator flowers from at least two varieties.", lifetimeCareRequired: 8_500, visitorKind: "bee",
    sprite: sprite(
      { w: "#d9f2ef", k: "#3b3028", y: "#e7b936", l: "#6c4c33" },
      "...........", "....ww.....", "...w..w....", "..kkyykk...", "..yykkyy...",
      "...yyyy....", "....kk.....", "...l..l....", "...........",
    ),
  },
  {
    key: "bumblebee", chapter: "Pollinators", name: "Bumblebee",
    discoveryTitle: "A bumblebee moved in",
    discoveryCopy: "Bee balm and neighboring blooms attracted a round, gentle bumblebee.",
    clue: "A fuzzy pollinator is especially fond of one namesake flower.",
    hints: ["A beehive anchors this habitat.", "Bee balm is required.", "Add lavender, wildflowers, or sunflowers nearby."],
    recipe: "Place a beehive near bee balm and lavender, wildflowers, or sunflowers.", lifetimeCareRequired: 8_500, visitorKind: "bee",
    sprite: sprite(
      { w: "#d9f2ef", k: "#3b3028", y: "#d9a62e", l: "#6c4c33" },
      "...........", "..ww...ww..", ".w..w.w..w.", "..kkyyykk..", ".yyyykyyyy.",
      ".yyyykyyyy.", "..kkyyykk..", "...l...l...", "...........",
    ),
  },
  {
    key: "dragonfly", chapter: "Water Visitors", name: "Dragonfly",
    discoveryTitle: "A dragonfly skimmed the pond",
    discoveryCopy: "Your pond, reeds, and lily pads attracted a dragonfly.",
    clue: "A jewel-bright hunter waits for still water and tall stems.",
    hints: ["Begin with a small pond.", "Reeds offer a perch.", "Add lily pads near the water."],
    recipe: "Place a small pond near reeds and lily pads.", lifetimeCareRequired: 41_500, visitorKind: "dragonfly",
    sprite: sprite(
      { w: "#d7f3f0", t: "#2f8e91" },
      "....t......", ".ww.t.ww...", "ww..t..ww..", "...ttt.....", "....t......",
      ".ww.t.ww...", "ww..t..ww..", "....t......", "...........",
    ),
  },
  {
    key: "garden_frog", chapter: "Water Visitors", name: "Garden frog",
    discoveryTitle: "A frog found the water",
    discoveryCopy: "A frog settled into the sheltered edge of your pond.",
    clue: "A quiet amphibian wants a pond with a thick, sheltered shoreline.",
    hints: ["A small pond is the center.", "Use more than one reed clump.", "Two reeds and two lily pads make a comfortable edge."],
    recipe: "Border a small pond with at least two reeds and two lily pads.", lifetimeCareRequired: 41_500, visitorKind: "frog",
    sprite: sprite(
      { g: "#5f914c", l: "#a8c967", k: "#2e3828" },
      "...........", "...g...g...", "..lgggggl..", ".lgggggggl.", ".ggkgggkgg.",
      "..ggggggg..", ".gg.ggg.gg.", "..l.....l..", "...........",
    ),
  },
  {
    key: "willow_songbird", chapter: "Water Visitors", name: "Willow songbird",
    discoveryTitle: "A song came from the willow",
    discoveryCopy: "Water beneath your willow attracted a visiting songbird.",
    clue: "A shy bird searches for drooping branches beside water.",
    hints: ["Plant a willow tree.", "The habitat needs nearby water.", "A pond or birdbath will complete it."],
    recipe: "Place a willow tree near a small pond or birdbath.", lifetimeCareRequired: 41_500, visitorKind: "bird",
    sprite: sprite(
      { n: "#354f5f", t: "#4e9b91", w: "#e5efe1", y: "#e1bd42", o: "#d58835", l: "#4b4136" },
      "...........", "......nn...", "..nnntttt..", ".nttttttto.", ".nwyttttt..",
      "..nttttn...", "...n..n....", "..l...l....", "...........",
    ),
  },
  {
    key: "garden_earthworm", chapter: "Working Garden", name: "Garden earthworm",
    discoveryTitle: "The soil is alive",
    discoveryCopy: "A garden earthworm appeared where compost feeds growing plants.",
    clue: "A hidden soil worker follows compost toward a productive planting bed.",
    hints: ["Start with a compost bin.", "Add a raised bed or wooden planter.", "Keep at least two plants close to the working area."],
    recipe: "Place a compost bin near a raised bed or wooden planter and two plants.", lifetimeCareRequired: 170_000, visitorKind: "worm",
    sprite: sprite(
      { p: "#b9686d" },
      "...........", "...........", ".ppp.......", "p...pp.....", ".....ppp...",
      ".......ppp.", ".........pp", "..........p", "...........",
    ),
  },
  {
    key: "greenhouse_seedlings", chapter: "Working Garden", name: "Greenhouse seedlings",
    discoveryTitle: "The greenhouse is growing",
    discoveryCopy: "Tiny seedlings appeared inside your planted greenhouse corner.",
    clue: "Glass and a ring of living plants can wake a miniature growing cycle.",
    hints: ["Build a small greenhouse.", "Plant around its outer edge.", "Four nearby plants will bring the greenhouse to life."],
    recipe: "Surround a small greenhouse with at least four plants.", lifetimeCareRequired: 275_000, visitorKind: "seedlings",
    sprite: sprite(
      { g: "#4d8a4f", s: "#78583e" },
      "...........", "..g....g...", ".ggg..ggg..", "..g....g...", "..s....s...",
      "....g......", "...ggg.....", "....s......", "sssssssssss",
    ),
  },
  {
    key: "tree_canopy", chapter: "Woodland Life", name: "Living tree canopy",
    discoveryTitle: "A canopy has formed",
    discoveryCopy: "Different trees and understory plants joined into a living woodland canopy.",
    clue: "A woodland becomes more than a row of trees when layers grow together.",
    hints: ["Use two different large trees.", "Keep the trees near one another.", "Add a woodland shrub or fern beneath them."],
    recipe: "Place two different large trees near a woodland shrub or fern.", lifetimeCareRequired: 80_000, visitorKind: "canopy",
    sprite: sprite(
      { g: "#4f7b48", b: "#6b4b34" },
      "..g...g....", ".ggg.ggg...", "ggggggggg..", ".ggggggg...", "..ggggg....",
      "....b......", "...bbb.....", "....b......", "....b......",
    ),
  },
  {
    key: "oak_sanctuary", chapter: "Woodland Life", name: "Oak sanctuary",
    discoveryTitle: "The grand oak became a sanctuary",
    discoveryCopy: "An owl found shelter in your grand oak and its busy garden edge.",
    clue: "An old tree can become a landmark when birds and flowers gather below.",
    hints: ["A grand oak is the heart.", "Add a birdhouse or feeder.", "Plant at least three flowers around the oak."],
    recipe: "Place a grand oak near a birdhouse or feeder and at least three flowers.", lifetimeCareRequired: 115_000, visitorKind: "owl",
    sprite: sprite(
      { b: "#74593e", c: "#dec68f", w: "#f8eed2", l: "#4d3d30" },
      "...........", "...b...b...", "..bbbbbbb..", ".bbcccccbb.", ".bcwcbcwcb.",
      ".bbcccccbb.", "..bbbbbbb..", "...b.b.b...", "..l.....l..",
    ),
  },
] as const;

const TREE_TYPES = new Set<MyGardenElementType>([
  "pine_tree", "maple_tree", "flowering_tree", "grand_oak",
]);
const POLLINATOR_PLANTS = new Set<MyGardenPlantType>([
  "sunflower", "lavender", "wildflowers", "bee_balm",
]);

function distance(a: { gridX: number; gridY: number }, b: { gridX: number; gridY: number }) {
  return Math.max(Math.abs(a.gridX - b.gridX), Math.abs(a.gridY - b.gridY));
}

function nearby<T extends { gridX: number; gridY: number }>(
  anchor: { gridX: number; gridY: number },
  values: readonly T[],
  radius: number,
) {
  return values.filter((value) => distance(anchor, value) <= radius);
}

function signature(key: LivingGardenHabitatKey, anchor: { gridX: number; gridY: number }) {
  return `${key}:${anchor.gridX}:${anchor.gridY}`;
}

export function isLivingGardenHabitatKey(value: string): value is LivingGardenHabitatKey {
  return (LIVING_GARDEN_HABITAT_KEYS as readonly string[]).includes(value);
}

export function getLivingGardenDefinition(key: LivingGardenHabitatKey) {
  return LIVING_GARDEN_DEFINITIONS.find((definition) => definition.key === key)!;
}

export function evaluateLivingGardenHabitats(
  plants: readonly LivingGardenPlant[],
  elements: readonly LivingGardenElement[],
): LivingGardenHabitat[] {
  const found = new Map<LivingGardenHabitatKey, LivingGardenHabitat>();
  const anchors = (type: MyGardenElementType) => elements.filter((element) => element.elementType === type);
  const elementsNear = (anchor: LivingGardenElement, radius: number, types: readonly MyGardenElementType[]) =>
    nearby(anchor, elements, radius).filter((element) => types.includes(element.elementType));
  const plantsNear = (anchor: LivingGardenElement, radius: number, types?: ReadonlySet<MyGardenPlantType>) =>
    nearby(anchor, plants, radius).filter((plant) => !types || types.has(plant.plantType));
  const add = (key: LivingGardenHabitatKey, anchor: LivingGardenElement) => {
    if (!found.has(key)) found.set(key, { key, gridX: anchor.gridX, gridY: anchor.gridY, signature: signature(key, anchor) });
  };

  for (const anchor of anchors("birdhouse")) {
    if (plantsNear(anchor, 3).length >= 3) add("garden_sparrow", anchor);
    if (elementsNear(anchor, 4, [...TREE_TYPES]).length >= 1) add("woodland_chickadee", anchor);
  }
  for (const anchor of anchors("bird_feeder")) {
    if (plantsNear(anchor, 4, new Set<MyGardenPlantType>(["sunflower", "wildflowers"])).length >= 1) add("goldfinch", anchor);
  }
  for (const anchor of anchors("birdbath")) {
    if (elementsNear(anchor, 4, ["birdhouse", "bird_feeder"]).length >= 1 && plantsNear(anchor, 4).length >= 2) add("bathing_robin", anchor);
  }
  for (const anchor of anchors("butterfly_house")) {
    const varieties = new Set(plantsNear(anchor, 5).map((plant) => plant.plantType));
    if (elementsNear(anchor, 4, ["butterfly_bush"]).length >= 1 && varieties.size >= 3) add("monarch_butterfly", anchor);
  }
  for (const anchor of anchors("beehive")) {
    const pollinators = plantsNear(anchor, 5, POLLINATOR_PLANTS);
    if (pollinators.length >= 4 && new Set(pollinators.map((plant) => plant.plantType)).size >= 2) add("honeybee", anchor);
    if (
      pollinators.some((plant) => plant.plantType === "bee_balm") &&
      pollinators.some((plant) => ["lavender", "wildflowers", "sunflower"].includes(plant.plantType))
    ) add("bumblebee", anchor);
  }
  for (const anchor of anchors("small_pond")) {
    const reeds = elementsNear(anchor, 5, ["reeds"]);
    const lilies = elementsNear(anchor, 5, ["lily_pads"]);
    if (reeds.length >= 1 && lilies.length >= 1) add("dragonfly", anchor);
    if (reeds.length >= 2 && lilies.length >= 2) add("garden_frog", anchor);
  }
  for (const anchor of anchors("willow_tree")) {
    if (elementsNear(anchor, 5, ["small_pond", "birdbath"]).length >= 1) add("willow_songbird", anchor);
  }
  for (const anchor of anchors("compost_bin")) {
    if (elementsNear(anchor, 4, ["raised_bed", "wooden_planter"]).length >= 1 && plantsNear(anchor, 4).length >= 2) add("garden_earthworm", anchor);
  }
  for (const anchor of anchors("small_greenhouse")) {
    if (plantsNear(anchor, 5).length >= 4) add("greenhouse_seedlings", anchor);
  }
  for (const anchor of elements.filter((element) => TREE_TYPES.has(element.elementType))) {
    const otherTreeKinds = new Set(
      elementsNear(anchor, 5, [...TREE_TYPES])
        .filter((element) => element.id !== anchor.id && element.elementType !== anchor.elementType)
        .map((element) => element.elementType),
    );
    if (otherTreeKinds.size >= 1 && elementsNear(anchor, 5, ["woodland_shrub", "fern"]).length >= 1) add("tree_canopy", anchor);
  }
  for (const anchor of anchors("grand_oak")) {
    if (elementsNear(anchor, 5, ["birdhouse", "bird_feeder"]).length >= 1 && plantsNear(anchor, 5).length >= 3) add("oak_sanctuary", anchor);
  }

  return Array.from(found.values());
}
