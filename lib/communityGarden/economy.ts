import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  CARE_ECONOMY_MODE,
  type CommunityGardenEconomy,
  type CommunityGardenEconomyAdmin,
} from "./economyPolicy";
import { BASIL_COMMONS_POLICY } from "./commonsPolicy";

export type {
  CommunityGardenEconomy,
  CommunityGardenEconomyAdmin,
} from "./economyPolicy";

function parseEconomy(value: unknown): CommunityGardenEconomyAdmin {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    mode: CARE_ECONOMY_MODE,
    firstHelpfulActionCare: BASIL_COMMONS_POLICY.firstHelpfulActionCare,
    standardActionCare: 1,
    dailyCareLimit: null,
    actorActionsPerMinute: BASIL_COMMONS_POLICY.actorActionsPerMinute,
    dailyTechnicalActionLimit: BASIL_COMMONS_POLICY.dailyMutationLimit,
    updatedAt:
      typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
    auditHistory: [],
  };
}

export async function getCommunityGardenEconomy() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_community_garden_economy_settings_v1",
  );
  if (error) throw error;
  return parseEconomy(data);
}

export function publicCommunityGardenEconomy(
  economy: CommunityGardenEconomyAdmin,
): CommunityGardenEconomy {
  const publicEconomy: CommunityGardenEconomy = {
    mode: economy.mode,
    firstHelpfulActionCare: economy.firstHelpfulActionCare,
    standardActionCare: economy.standardActionCare,
    dailyCareLimit: economy.dailyCareLimit,
    actorActionsPerMinute: economy.actorActionsPerMinute,
    dailyTechnicalActionLimit: economy.dailyTechnicalActionLimit,
    updatedAt: economy.updatedAt,
  };
  return publicEconomy;
}
