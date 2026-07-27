import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type HeritageSeedCandidate = {
  id: string;
  plantType: "rose" | "sunflower" | "lavender";
  gridX: number;
  gridY: number;
  plantedAt: string;
  ageDays: number;
  careDays: number;
  gardeners: number;
  neighbors: number;
  regionHeritageCount: number;
  regionHeritageCapacity: number;
  nominated: boolean;
  criteriaMet: boolean;
};

export type HeritageSeedStatus = {
  eligible: boolean;
  status: "unavailable" | "available" | "nominated" | "heritage";
  badgeEarned?: boolean;
  nominatedAt?: string | null;
  redeemedAt?: string | null;
  nominatedFlower?: HeritageSeedCandidate | null;
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
  candidates: HeritageSeedCandidate[];
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
    candidates: Array.isArray(status.candidates) ? status.candidates : [],
  } as HeritageSeedStatus;
}

export async function getHeritageSeedStatus(userId: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_community_garden_heritage_seed_v2",
    { p_user_id: userId },
  );
  if (error) throw error;
  return asHeritageSeedStatus(data);
}

export async function nominateHeritageSeed(userId: string, plantId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(plantId)) {
    throw new Error("Choose a valid Community Garden flower.");
  }
  const { error } = await getSupabaseAdmin().rpc(
    "nominate_community_garden_heritage_seed_v1",
    { p_user_id: userId, p_plant_id: plantId },
  );
  if (error) throw error;
  return getHeritageSeedStatus(userId);
}
