import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  DEFAULT_DAILY_CARE_LIMIT,
  type CommunityGardenEconomy,
  type CommunityGardenEconomyAdmin,
} from "./economyPolicy";

export type {
  CommunityGardenEconomy,
  CommunityGardenEconomyAdmin,
} from "./economyPolicy";

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseEconomy(value: unknown): CommunityGardenEconomyAdmin {
  if (!value || typeof value !== "object") {
    throw new Error("The Care economy settings were unavailable.");
  }
  const row = value as Record<string, unknown>;
  const dailyCareLimit = asNumber(row.dailyCareLimit, DEFAULT_DAILY_CARE_LIMIT);
  const auditHistory = Array.isArray(row.auditHistory)
    ? row.auditHistory.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const audit = entry as Record<string, unknown>;
        if (
          typeof audit.previousDailyCareLimit !== "number" ||
          typeof audit.newDailyCareLimit !== "number" ||
          typeof audit.changedAt !== "string"
        ) {
          return [];
        }
        return [{
          previousDailyCareLimit: audit.previousDailyCareLimit,
          newDailyCareLimit: audit.newDailyCareLimit,
          changedAt: audit.changedAt,
        }];
      })
    : [];

  return {
    dailyCareLimit,
    fullRewardLimit: asNumber(row.fullRewardLimit, Math.floor(dailyCareLimit / 3)),
    moderateRewardLimit: asNumber(
      row.moderateRewardLimit,
      Math.floor((dailyCareLimit * 2) / 3),
    ),
    moderateActionsRequired: asNumber(row.moderateActionsRequired, 4),
    longActionsRequired: asNumber(row.longActionsRequired, 20),
    updatedAt:
      typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
    auditHistory,
  };
}

export async function getCommunityGardenEconomy() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_community_garden_economy_settings_v1",
  );
  if (error) throw error;
  return parseEconomy(data);
}

export async function updateCommunityGardenEconomy(
  dailyCareLimit: number,
  updatedBy: string,
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "update_community_garden_economy_settings_v1",
    {
      p_daily_care_limit: dailyCareLimit,
      p_updated_by: updatedBy,
    },
  );
  if (error) throw error;
  return parseEconomy(data);
}

export function publicCommunityGardenEconomy(
  economy: CommunityGardenEconomyAdmin,
): CommunityGardenEconomy {
  const publicEconomy: CommunityGardenEconomy = {
    dailyCareLimit: economy.dailyCareLimit,
    fullRewardLimit: economy.fullRewardLimit,
    moderateRewardLimit: economy.moderateRewardLimit,
    moderateActionsRequired: economy.moderateActionsRequired,
    longActionsRequired: economy.longActionsRequired,
    updatedAt: economy.updatedAt,
  };
  return publicEconomy;
}
