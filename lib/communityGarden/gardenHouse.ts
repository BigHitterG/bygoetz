import {
  GARDEN_HOUSE_DISPLAY_COPY,
  GARDEN_HOUSE_DISPLAY_KEYS,
  GARDEN_HOUSE_TIER_THRESHOLDS,
  getGardenHouseNextTarget,
  getGardenHouseTier,
  getGardenStreaks,
  isGardenHouseDisplayUnread,
  type GardenHouseAccolade,
  type GardenHouseDisplayKey,
  type GardenHouseMetadata,
  type GardenHouseState,
} from "@/app/community-garden/lib/gardenHouse";
import {
  GARDEN_STEWARDSHIP_RANKS,
  getGardenStewardshipRankName,
  type GardenStewardshipSummary,
} from "@/app/community-garden/lib/stewardshipTypes";
import { LIVING_GARDEN_HABITAT_KEYS } from "@/app/community-garden/lib/livingGarden";
import { MY_GARDEN_COLLECTIONS } from "@/app/community-garden/lib/myGardenCatalog";
import type { HeritageSeedStatus } from "./heritageSeeds";
import type { MyGardenState } from "./myGarden";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type StoredAccoladeRow = {
  display_key: GardenHouseDisplayKey;
  category: GardenHouseAccolade["category"];
  title: string;
  description: string;
  tier: number;
  progress: number;
  target: number;
  earned_at: string | null;
  updated_at: string;
  inspected_at: string | null;
  metadata: GardenHouseMetadata;
};

type ActiveDayRow = {
  activity_date: string;
  first_action_at: string;
};

type TaskAccoladeRow = {
  title: string;
  earned_at: string;
};

type CategoryRow = {
  category: string;
  tasks_completed: number;
};

type HeritageNotificationRow = {
  plant_type: string;
  became_heritage_at: string;
};

type CommunityProjectRow = {
  credited_at: string;
};

function stableMetadata(value: GardenHouseMetadata) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function display(
  key: GardenHouseDisplayKey,
  values: Omit<
    GardenHouseAccolade,
    "key" | "category" | "title" | "description" | "updatedAt" | "inspectedAt"
  >,
  existing: StoredAccoladeRow | undefined,
  now: string,
): GardenHouseAccolade {
  const copy = GARDEN_HOUSE_DISPLAY_COPY[key];
  const changed =
    !existing ||
    existing.tier !== values.tier ||
    existing.progress !== values.progress ||
    existing.target !== values.target ||
    existing.earned_at !== values.earnedAt ||
    stableMetadata(existing.metadata ?? {}) !== stableMetadata(values.metadata);
  return {
    key,
    ...copy,
    ...values,
    updatedAt: changed ? now : existing.updated_at,
    inspectedAt: existing?.inspected_at ?? null,
  };
}

function firstDate(...dates: Array<string | null | undefined>) {
  return dates.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

export function isGardenHouseDisplayKey(
  value: unknown,
): value is GardenHouseDisplayKey {
  return (
    typeof value === "string" &&
    (GARDEN_HOUSE_DISPLAY_KEYS as readonly string[]).includes(value)
  );
}

export async function getGardenHouse(
  stewardId: string,
  userId: string,
  garden: MyGardenState,
  stewardship: GardenStewardshipSummary,
  heritage: HeritageSeedStatus,
): Promise<GardenHouseState> {
  const supabase = getSupabaseAdmin();
  const [
    storedResult,
    activeDaysResult,
    taskAccoladesResult,
    categoriesResult,
    actorResult,
    heritageNotificationsResult,
    communityProjectsResult,
  ] = await Promise.all([
    supabase
      .from("garden_house_accolades")
      .select(
        "display_key,category,title,description,tier,progress,target,earned_at,updated_at,inspected_at,metadata",
      )
      .eq("steward_id", stewardId)
      .returns<StoredAccoladeRow[]>(),
    supabase
      .from("garden_stewardship_active_days")
      .select("activity_date,first_action_at")
      .eq("steward_id", stewardId)
      .order("activity_date")
      .returns<ActiveDayRow[]>(),
    supabase
      .from("garden_stewardship_accolades")
      .select("title,earned_at")
      .eq("steward_id", stewardId)
      .order("earned_at")
      .returns<TaskAccoladeRow[]>(),
    supabase
      .from("garden_stewardship_categories")
      .select("category,tasks_completed")
      .eq("steward_id", stewardId)
      .returns<CategoryRow[]>(),
    supabase
      .from("community_garden_account_actors")
      .select("actor_key")
      .eq("user_id", userId)
      .maybeSingle<{ actor_key: string }>(),
    supabase
      .from("community_garden_heritage_notifications")
      .select("plant_type,became_heritage_at")
      .eq("recipient_user_id", userId)
      .order("became_heritage_at")
      .returns<HeritageNotificationRow[]>(),
    supabase
      .from("garden_community_project_progress")
      .select("credited_at")
      .eq("steward_id", stewardId)
      .not("credited_at", "is", null)
      .order("credited_at")
      .returns<CommunityProjectRow[]>(),
  ]);

  for (const result of [
    storedResult,
    activeDaysResult,
    taskAccoladesResult,
    categoriesResult,
    actorResult,
    heritageNotificationsResult,
    communityProjectsResult,
  ]) {
    if (result.error) throw result.error;
  }

  let wormCount = 0;
  let firstWormAt: string | null = null;
  if (actorResult.data?.actor_key) {
    const { data, count, error } = await supabase
      .from("community_garden_actions")
      .select("created_at", { count: "exact" })
      .eq("actor_key", actorResult.data.actor_key)
      .eq("status", "completed")
      .eq("response_payload->contribution->>gardenWorm", "true")
      .order("created_at")
      .limit(1)
      .returns<Array<{ created_at: string }>>();
    if (error) throw error;
    wormCount = count ?? 0;
    firstWormAt = data?.[0]?.created_at ?? null;
  }

  const now = new Date().toISOString();
  const stored = new Map(
    (storedResult.data ?? []).map((row) => [row.display_key, row]),
  );
  const activeDays = activeDaysResult.data ?? [];
  const taskAccolades = taskAccoladesResult.data ?? [];
  const categories = Object.fromEntries(
    (categoriesResult.data ?? []).map((row) => [row.category, row.tasks_completed]),
  );
  const habitatDiscoveries = garden.livingGardenDiscoveries ?? [];
  const completedCollections = MY_GARDEN_COLLECTIONS.filter(
    (collection) =>
      garden.lifetimeCare >= collection.completionLifetimeCareRequired,
  );
  const shapedParcels = (garden.unlockedParcels ?? []).filter(
    (parcel) => parcel.source === "freeform",
  ).length;
  const returnedParcels = garden.reclaimCandidates?.length ?? 0;
  const stewardshipIndex = Math.max(
    0,
    GARDEN_STEWARDSHIP_RANKS.findIndex(
      (rank) => rank.key === stewardship.rankKey,
    ),
  );
  const stewardshipTier = stewardshipIndex + 1;
  const nextRank = GARDEN_STEWARDSHIP_RANKS[stewardshipIndex + 1] ?? null;
  const streaks = getGardenStreaks(activeDays.map((row) => row.activity_date));
  const heritageNotifications = heritageNotificationsResult.data ?? [];
  const heritageCount = Math.max(
    heritageNotifications.length,
    heritage.heritageFlower ? 1 : 0,
  );
  const communityProjects = communityProjectsResult.data ?? [];

  const displays: GardenHouseAccolade[] = [
    display(
      "stewardship",
      {
        tier: stewardshipTier,
        progress: stewardshipTier,
        target: GARDEN_STEWARDSHIP_RANKS.length,
        earnedAt: stored.get("stewardship")?.earned_at ?? now,
        metadata: {
          rankName: getGardenStewardshipRankName(stewardship.rankKey),
          capacity: stewardship.capacity,
          nextRank: nextRank?.name ?? "Highest rank earned",
        },
      },
      stored.get("stewardship"),
      now,
    ),
    display(
      "tasks",
      {
        tier: getGardenHouseTier(
          stewardship.tasksCompleted,
          GARDEN_HOUSE_TIER_THRESHOLDS.tasks,
        ),
        progress: stewardship.tasksCompleted,
        target: getGardenHouseNextTarget(
          stewardship.tasksCompleted,
          GARDEN_HOUSE_TIER_THRESHOLDS.tasks,
        ),
        earnedAt: firstDate(taskAccolades[0]?.earned_at),
        metadata: {
          categories,
          latestAccolade: taskAccolades.at(-1)?.title ?? "None yet",
        },
      },
      stored.get("tasks"),
      now,
    ),
    display(
      "habitats",
      {
        tier: getGardenHouseTier(
          habitatDiscoveries.length,
          [1, 3, 5, 10, LIVING_GARDEN_HABITAT_KEYS.length],
        ),
        progress: habitatDiscoveries.length,
        target: LIVING_GARDEN_HABITAT_KEYS.length,
        earnedAt: firstDate(habitatDiscoveries[0]?.discoveredAt),
        metadata: {
          discoveredHabitats: habitatDiscoveries.map(
            (discovery) => discovery.habitatKey,
          ),
        },
      },
      stored.get("habitats"),
      now,
    ),
    display(
      "heritage",
      {
        tier: getGardenHouseTier(
          heritageCount,
          GARDEN_HOUSE_TIER_THRESHOLDS.heritage,
        ),
        progress: heritageCount,
        target: getGardenHouseNextTarget(
          heritageCount,
          GARDEN_HOUSE_TIER_THRESHOLDS.heritage,
        ),
        earnedAt: firstDate(
          heritage.heritageFlower?.becameHeritageAt,
          heritageNotifications[0]?.became_heritage_at,
        ),
        metadata: {
          ownHeritageFlower: Boolean(heritage.heritageFlower),
          heritageFlowerType:
            heritage.heritageFlower?.plantType ?? "Not yet grown",
          encounteredFlowers: heritageNotifications.length,
        },
      },
      stored.get("heritage"),
      now,
    ),
    display(
      "collections",
      {
        tier: completedCollections.length,
        progress: completedCollections.length,
        target: MY_GARDEN_COLLECTIONS.length,
        earnedAt:
          completedCollections.length > 0
            ? stored.get("collections")?.earned_at ?? now
            : null,
        metadata: {
          completedCollections: completedCollections.map((item) => item.key),
          lifetimeCare: garden.lifetimeCare,
        },
      },
      stored.get("collections"),
      now,
    ),
    display(
      "calendar",
      {
        tier: getGardenHouseTier(
          activeDays.length,
          GARDEN_HOUSE_TIER_THRESHOLDS.calendar,
        ),
        progress: activeDays.length,
        target: getGardenHouseNextTarget(
          activeDays.length,
          GARDEN_HOUSE_TIER_THRESHOLDS.calendar,
        ),
        earnedAt: firstDate(activeDays[0]?.first_action_at),
        metadata: {
          currentStreak: streaks.current,
          longestStreak: streaks.longest,
        },
      },
      stored.get("calendar"),
      now,
    ),
    display(
      "property",
      {
        tier: getGardenHouseTier(
          shapedParcels,
          GARDEN_HOUSE_TIER_THRESHOLDS.property,
        ),
        progress: shapedParcels,
        target: getGardenHouseNextTarget(
          shapedParcels,
          GARDEN_HOUSE_TIER_THRESHOLDS.property,
        ),
        earnedAt:
          shapedParcels > 0 || returnedParcels > 0
            ? stored.get("property")?.earned_at ?? now
            : null,
        metadata: {
          unlockedParcels: garden.unlockedParcels?.length ?? 0,
          shapedParcels,
          returnedParcels,
        },
      },
      stored.get("property"),
      now,
    ),
    display(
      "community",
      {
        tier: getGardenHouseTier(
          stewardship.communityProjectsCompleted,
          GARDEN_HOUSE_TIER_THRESHOLDS.community,
        ),
        progress: stewardship.communityProjectsCompleted,
        target: getGardenHouseNextTarget(
          stewardship.communityProjectsCompleted,
          GARDEN_HOUSE_TIER_THRESHOLDS.community,
        ),
        earnedAt: firstDate(
          communityProjects[0]?.credited_at,
          stewardship.communityProjectsCompleted > 0
            ? stored.get("community")?.earned_at ?? now
            : null,
        ),
        metadata: {},
      },
      stored.get("community"),
      now,
    ),
    display(
      "worms",
      {
        tier: getGardenHouseTier(
          wormCount,
          GARDEN_HOUSE_TIER_THRESHOLDS.worms,
        ),
        progress: wormCount,
        target: getGardenHouseNextTarget(
          wormCount,
          GARDEN_HOUSE_TIER_THRESHOLDS.worms,
        ),
        earnedAt: firstDate(firstWormAt, stored.get("worms")?.earned_at),
        metadata: { lifetimeWorms: wormCount },
      },
      stored.get("worms"),
      now,
    ),
  ];

  const { error: upsertError } = await supabase
    .from("garden_house_accolades")
    .upsert(
      displays.map((item) => ({
        steward_id: stewardId,
        display_key: item.key,
        category: item.category,
        title: item.title,
        description: item.description,
        tier: item.tier,
        progress: item.progress,
        target: item.target,
        earned_at: item.earnedAt,
        updated_at: item.updatedAt,
        inspected_at: item.inspectedAt,
        metadata: item.metadata,
      })),
      { onConflict: "steward_id,display_key" },
    );
  if (upsertError) throw upsertError;

  return {
    displays,
    generatedAt: now,
    unreadCount: displays.filter(isGardenHouseDisplayUnread).length,
  };
}

export async function markGardenHouseAccoladeInspected(
  stewardId: string,
  key: GardenHouseDisplayKey,
) {
  const inspectedAt = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("garden_house_accolades")
    .update({ inspected_at: inspectedAt })
    .eq("steward_id", stewardId)
    .eq("display_key", key);
  if (error) throw error;
  return inspectedAt;
}
