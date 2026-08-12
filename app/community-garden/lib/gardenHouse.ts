import type { MyGardenState } from "@/lib/communityGarden/myGarden";
import {
  LIVING_GARDEN_DEFINITIONS,
  LIVING_GARDEN_HABITAT_KEYS,
} from "./livingGarden";
import { MY_GARDEN_COLLECTIONS } from "./myGardenCatalog";

export const GARDEN_HOUSE_DISPLAY_KEYS = [
  "stewardship",
  "tasks",
  "habitats",
  "heritage",
  "collections",
  "calendar",
  "property",
  "community",
  "worms",
] as const;

export type GardenHouseDisplayKey =
  (typeof GARDEN_HOUSE_DISPLAY_KEYS)[number];

export type GardenHouseDisplayCategory =
  | "service"
  | "nature"
  | "collection"
  | "history"
  | "community";

export type GardenHouseMetadata = Record<
  string,
  string | number | boolean | null | string[] | Record<string, number>
>;

export type GardenHouseAccolade = {
  key: GardenHouseDisplayKey;
  category: GardenHouseDisplayCategory;
  title: string;
  description: string;
  tier: number;
  progress: number;
  target: number;
  earnedAt: string | null;
  updatedAt: string;
  inspectedAt: string | null;
  metadata: GardenHouseMetadata;
};

export type GardenHouseState = {
  displays: GardenHouseAccolade[];
  generatedAt: string;
  unreadCount: number;
};

export const GARDEN_HOUSE_DISPLAY_COPY: Record<
  GardenHouseDisplayKey,
  {
    category: GardenHouseDisplayCategory;
    title: string;
    description: string;
  }
> = {
  stewardship: {
    category: "service",
    title: "Stewardship",
    description: "The ranks you have earned by caring for the shared garden.",
  },
  tasks: {
    category: "service",
    title: "Garden Work",
    description: "A growing trophy for the tasks you have completed.",
  },
  habitats: {
    category: "nature",
    title: "Living Garden",
    description: "Portraits of every creature and habitat your garden has welcomed.",
  },
  heritage: {
    category: "nature",
    title: "Heritage Flowers",
    description: "Enduring flowers you have grown or encountered in the community.",
  },
  collections: {
    category: "collection",
    title: "Garden Collections",
    description: "The collections you have completed through a lifetime of Care.",
  },
  calendar: {
    category: "history",
    title: "Garden Calendar",
    description: "The days and streaks that make up your gardening history.",
  },
  property: {
    category: "history",
    title: "Garden Map",
    description: "A record of the land you unlocked, shaped, and returned.",
  },
  community: {
    category: "community",
    title: "Community Projects",
    description: "Commemorations from projects completed alongside other gardeners.",
  },
  worms: {
    category: "nature",
    title: "Garden Worms",
    description: "A permanent count of the rare Garden Worms you have discovered.",
  },
};

export const GARDEN_HOUSE_TIER_THRESHOLDS: Record<
  Exclude<GardenHouseDisplayKey, "stewardship" | "habitats" | "collections">,
  readonly number[]
> = {
  tasks: [1, 10, 25, 50, 100, 250],
  heritage: [1, 3, 5, 10],
  calendar: [1, 7, 30, 100, 365],
  property: [1, 10, 25, 50, 100],
  community: [1, 3, 5, 10, 25],
  worms: [1, 5, 25, 100],
};

export function getGardenHouseTier(
  progress: number,
  thresholds: readonly number[],
) {
  return thresholds.filter((threshold) => progress >= threshold).length;
}

export function getGardenHouseNextTarget(
  progress: number,
  thresholds: readonly number[],
) {
  return thresholds.find((threshold) => threshold > progress) ?? progress;
}

export function isGardenHouseDisplayUnread(display: GardenHouseAccolade) {
  if (display.tier <= 0 && display.progress <= 0) return false;
  if (!display.inspectedAt) return true;
  return Date.parse(display.updatedAt) > Date.parse(display.inspectedAt);
}

export function getGardenStreaks(activityDates: readonly string[]) {
  const uniqueDays = Array.from(new Set(activityDates))
    .map((value) => value.slice(0, 10))
    .sort();
  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let running = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = Date.parse(`${uniqueDays[index - 1]}T00:00:00Z`);
    const current = Date.parse(`${uniqueDays[index]}T00:00:00Z`);
    running = current - previous === 86_400_000 ? running + 1 : 1;
    longest = Math.max(longest, running);
  }

  const lastDate = Date.parse(`${uniqueDays.at(-1)}T00:00:00Z`);
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const daysSinceLast = Math.round((todayUtc - lastDate) / 86_400_000);
  if (daysSinceLast > 1) return { current: 0, longest };

  let current = 1;
  for (let index = uniqueDays.length - 1; index > 0; index -= 1) {
    const later = Date.parse(`${uniqueDays[index]}T00:00:00Z`);
    const earlier = Date.parse(`${uniqueDays[index - 1]}T00:00:00Z`);
    if (later - earlier !== 86_400_000) break;
    current += 1;
  }
  return { current, longest };
}

function previewDisplay(
  key: GardenHouseDisplayKey,
  progress: number,
  target: number,
  tier: number,
  metadata: GardenHouseMetadata = {},
): GardenHouseAccolade {
  const copy = GARDEN_HOUSE_DISPLAY_COPY[key];
  return {
    key,
    ...copy,
    progress,
    target,
    tier,
    earnedAt: null,
    updatedAt: new Date(0).toISOString(),
    inspectedAt: new Date(0).toISOString(),
    metadata,
  };
}

export function buildGuestGardenHouseState(
  garden: MyGardenState,
): GardenHouseState {
  const discoveries = garden.livingGardenDiscoveries ?? [];
  const completedCollections = MY_GARDEN_COLLECTIONS.filter(
    (collection) =>
      garden.lifetimeCare >= collection.completionLifetimeCareRequired,
  );
  const shaped = (garden.unlockedParcels ?? []).filter(
    (parcel) => parcel.source === "freeform",
  ).length;
  const returned = garden.reclaimCandidates?.length ?? 0;
  const habitatKeys = new Set(discoveries.map((item) => item.habitatKey));

  const displays = [
    previewDisplay("stewardship", 0, 6, 0, { rankName: "Not yet recorded" }),
    previewDisplay("tasks", 0, 1, 0),
    previewDisplay(
      "habitats",
      discoveries.length,
      LIVING_GARDEN_HABITAT_KEYS.length,
      getGardenHouseTier(discoveries.length, [1, 3, 5, 10, 14]),
      {
        discoveredHabitats: LIVING_GARDEN_DEFINITIONS.filter((definition) =>
          habitatKeys.has(definition.key),
        ).map((definition) => definition.key),
      },
    ),
    previewDisplay("heritage", 0, 1, 0),
    previewDisplay(
      "collections",
      completedCollections.length,
      MY_GARDEN_COLLECTIONS.length,
      completedCollections.length,
      { completedCollections: completedCollections.map((item) => item.key) },
    ),
    previewDisplay("calendar", 0, 1, 0, { currentStreak: 0, longestStreak: 0 }),
    previewDisplay(
      "property",
      shaped,
      getGardenHouseNextTarget(shaped, GARDEN_HOUSE_TIER_THRESHOLDS.property),
      getGardenHouseTier(shaped, GARDEN_HOUSE_TIER_THRESHOLDS.property),
      {
        unlockedParcels: garden.unlockedParcels?.length ?? 0,
        shapedParcels: shaped,
        returnedParcels: returned,
      },
    ),
    previewDisplay("community", 0, 1, 0),
    previewDisplay("worms", 0, 1, 0),
  ];

  return { displays, generatedAt: new Date().toISOString(), unreadCount: 0 };
}
