import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBasilLaunchFunnelAdmin, type BasilLaunchFunnel } from "./funnel";
import {
  getCommunityGardenEconomy,
  type CommunityGardenEconomyAdmin,
} from "./economy";

export type GardenDeviceClass = "phone" | "tablet" | "desktop" | "unknown";

export type GardenHealthEvent =
  | "pulse"
  | "snapshot_ok"
  | "snapshot_error"
  | "action_ok"
  | "action_error";

export type CommunityGardenFrontierRecommendation = {
  regionX: number;
  regionY: number;
  currentState: "founding" | "established" | "frontier" | "fallow";
  recommendedAction: "prepare" | "establish" | "restore";
  eligibleLivePlants: number;
  coveredSubcells: number;
  eligibleAccounts7d: number;
  activeDays7d: number;
  consecutiveSupportDays: number;
  reasons: string[];
};

export type CommunityGardenFrontierHealth = {
  policyVersion: string;
  automationEnabled: boolean;
  mode: "shadow" | "manual" | "automatic";
  evaluatedAt: string | null;
  evaluationDate: string | null;
  regions: {
    total: number;
    founding: number;
    established: number;
    frontier: number;
    fallow: number;
    qualifyingFrontier: number;
  };
  capacity: {
    plants: number;
    effectiveCapacity: number;
    occupancyPercent: number;
    prepareAtPercent: number;
    expandAtPercent: number;
    targetPercent: number;
  };
  quorum: {
    perimeterRegions: number;
    requiredAccounts: number;
    activeAccounts7d: number;
    globallyQualified: boolean;
  };
  heritage: {
    flowers: number;
    capacity: number;
    grandfatheredFlowers: number;
  };
  recommendations: CommunityGardenFrontierRecommendation[];
};

export type CommunityGardenHealth = {
  measuredAt: string;
  status: "healthy" | "elevated" | "degraded";
  activeUsers5m: number;
  activeUsers15m: number;
  newSessions24h: number;
  devices15m: {
    phone: number;
    tablet: number;
    desktop: number;
  };
  actions10m: number;
  actionFailures10m: number;
  actionSuccessPercent: number;
  averageActionMs: number;
  maxActionMs: number;
  snapshots10m: number;
  snapshotFailures10m: number;
  averageSnapshotMs: number;
  maxSnapshotMs: number;
  lastErrorAt: string | null;
  snapshot: {
    version: number | null;
    generatedAt: string | null;
    nextRefreshAt: string | null;
    plantCount: number | null;
    payloadBytes: number | null;
  };
  commons: {
    careCap: number;
    mutationCap: number;
    activeContributorsToday: number;
    contributorsAtCareCap: number;
    careAwardedToday: number;
    mutationsToday: number;
    busyRegions: number;
    restingRegions: number;
    densestRegionPlants: number;
    scheduledSuccession: number;
    weeds: number;
    gardenOccupancyPercent: number;
    expansionRecommended: boolean;
  };
  frontier: CommunityGardenFrontierHealth | null;
  economy: CommunityGardenEconomyAdmin;
  funnel: BasilLaunchFunnel;
};

const DEFAULT_ADMIN_EMAILS = ["thomas.goetz.jr@gmail.com"];

function gardenAdminEmails() {
  const configured = process.env.BASIL_ADMIN_EMAILS?.split(",") ?? [];
  return new Set(
    [...DEFAULT_ADMIN_EMAILS, ...configured]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isGardenAdmin(user: User) {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && user.email_confirmed_at && gardenAdminEmails().has(email));
}

export function getGardenDeviceClass(userAgent: string | null): GardenDeviceClass {
  if (!userAgent) return "unknown";
  if (
    /ipad|tablet/i.test(userAgent) ||
    (/android/i.test(userAgent) && !/mobile/i.test(userAgent)) ||
    (/macintosh/i.test(userAgent) && /mobile/i.test(userAgent))
  ) {
    return "tablet";
  }
  if (/iphone|ipod|mobile|android/i.test(userAgent)) return "phone";
  return "desktop";
}

export function getGardenErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";
  const code = "code" in error ? String(error.code) : "";
  if (/^[a-z0-9_-]{1,80}$/i.test(code)) return code;

  const message = "message" in error ? String(error.message).toLowerCase() : "";
  if (message.includes("full day") || message.includes("reached today")) return "daily_cap";
  if (message.includes("patch is resting")) return "region_capacity";
  if (message.includes("breather") || message.includes("rate")) return "rate_limited";
  if (message.includes("already") || message.includes("no longer")) return "tile_conflict";
  if (message.includes("timeout")) return "timeout";
  return "unknown";
}

export async function recordCommunityGardenHealth(input: {
  event: GardenHealthEvent;
  deviceClass: GardenDeviceClass;
  actorKey?: string;
  durationMs?: number;
  errorCode?: string;
}) {
  const { error } = await getSupabaseAdmin().rpc(
    "record_community_garden_health",
    {
      p_event_type: input.event,
      p_device_class: input.deviceClass,
      p_actor_key: input.actorKey ?? null,
      p_duration_ms: input.durationMs ?? null,
      p_error_code: input.errorCode ?? null,
    },
  );
  if (error) throw error;
}

export async function getCommunityGardenAdminHealth() {
  const [
    { data, error },
    { data: commons, error: commonsError },
    { data: frontier, error: frontierError },
    funnel,
    economy,
  ] = await Promise.all([
    getSupabaseAdmin().rpc("get_community_garden_admin_health"),
    getSupabaseAdmin().rpc("get_community_garden_commons_health"),
    getSupabaseAdmin().rpc("get_community_garden_frontier_health_v1"),
    getBasilLaunchFunnelAdmin(),
    getCommunityGardenEconomy(),
  ]);
  if (error) throw error;
  if (commonsError) throw commonsError;
  if (!data || typeof data !== "object") {
    throw new Error("The garden health summary was unavailable.");
  }
  if (!commons || typeof commons !== "object") {
    throw new Error("The garden commons summary was unavailable.");
  }
  if (frontierError) {
    console.warn("Basil frontier health is temporarily unavailable", {
      code: frontierError.code,
    });
  }
  return {
    ...(data as Omit<
      CommunityGardenHealth,
      "funnel" | "commons" | "frontier" | "economy"
    >),
    commons,
    frontier:
      !frontierError && frontier && typeof frontier === "object"
        ? (frontier as CommunityGardenFrontierHealth)
        : null,
    economy,
    funnel,
  } as CommunityGardenHealth;
}

export function logGardenServerEvent(
  level: "info" | "error",
  event: string,
  details: Record<string, string | number | boolean | null | undefined>,
) {
  const payload = JSON.stringify({
    level,
    event,
    area: "community-garden",
    ...details,
  });
  if (level === "error") console.error(payload);
  else console.info(payload);
}
