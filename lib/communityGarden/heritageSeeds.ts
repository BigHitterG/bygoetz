import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type HeritageSeedStatus = {
  eligible: boolean;
  status: "unavailable" | "growing" | "heritage";
  badgeEarned?: boolean;
  redeemedAt?: string | null;
  heritageFlower?: {
    id: string;
    plantType: "rose" | "sunflower" | "lavender";
    gridX: number;
    gridY: number;
    plantedAt: string;
    becameHeritageAt: string;
  } | null;
  criteria?: {
    minimumAgeDays: number;
    careDays: number;
    gardeners: number;
    neighbors: number;
    regionalCapacity: number;
  };
};

function asHeritageSeedStatus(value: unknown): HeritageSeedStatus {
  if (!value || typeof value !== "object") {
    throw new Error("Basil could not load this Heritage Seed.");
  }
  const status = value as Partial<HeritageSeedStatus>;
  return {
    ...status,
    eligible: Boolean(status.eligible),
    status: status.status ?? "unavailable",
  } as HeritageSeedStatus;
}

export async function getHeritageSeedStatus(userId: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_community_garden_heritage_seed_v3",
    { p_user_id: userId },
  );
  if (error) throw error;
  return asHeritageSeedStatus(data);
}
