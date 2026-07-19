import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GardenBounds } from "./gardenConfig";
import {
  PLANT_TYPES,
  type PlantRecord,
  type PlantType,
} from "./roseLifecycle";

export type GardenMapPlant = Pick<PlantRecord, "grid_x" | "grid_y" | "plant_type">;
export type GardenContribution = {
  action: "plant" | "water";
  receiptToken: string;
  careValue: number;
};

let gardenClient: SupabaseClient | null = null;

export function isGardenConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function getGardenClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  if (!gardenClient) {
    gardenClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return gardenClient;
}

function normalizePlant(value: Record<string, unknown>): PlantRecord {
  const plantType = PLANT_TYPES.includes(value.plant_type as PlantType)
    ? (value.plant_type as PlantType)
    : "rose";
  return { ...value, plant_type: plantType } as PlantRecord;
}

function normalizeContributionRpc(
  data: unknown,
  action: GardenContribution["action"],
) {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("The garden did not return a plant.");
  }
  const record = value as Record<string, unknown>;
  const plant = normalizePlant({
    ...record,
    id: record.plant_id,
  });
  const receiptToken =
    typeof record.receipt_token === "string" ? record.receipt_token : null;
  const careValue = Number(record.care_value ?? 0);
  return {
    plant,
    contribution:
      receiptToken && careValue > 0
        ? { action, receiptToken, careValue } satisfies GardenContribution
        : null,
  };
}

export async function fetchGardenPlants(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return [];

  const { data, error } = await client
    .from("community_garden_roses")
    .select("id,grid_x,grid_y,plant_type,planted_at,last_watered_at,created_at")
    .gte("grid_x", bounds.minX)
    .lte("grid_x", bounds.maxX)
    .gte("grid_y", bounds.minY)
    .lte("grid_y", bounds.maxY)
    .order("grid_x")
    .order("grid_y");

  if (error) throw error;
  return (data ?? []).map((plant) => normalizePlant(plant));
}

export async function fetchGardenPlantMap(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return [];

  const { data, error } = await client
    .from("community_garden_roses")
    .select("grid_x,grid_y,plant_type")
    .gte("grid_x", bounds.minX)
    .lte("grid_x", bounds.maxX)
    .gte("grid_y", bounds.minY)
    .lte("grid_y", bounds.maxY)
    .order("grid_x")
    .order("grid_y")
    .limit(1000);

  if (error) throw error;
  return (data ?? []).map((plant) => normalizePlant(plant)) as GardenMapPlant[];
}

export async function plantGardenPlant(
  gridX: number,
  gridY: number,
  plantType: PlantType,
) {
  const client = getGardenClient();
  if (!client) throw new Error("The shared garden is not connected yet.");

  const { data, error } = await client.rpc("perform_community_garden_planting", {
    p_grid_x: gridX,
    p_grid_y: gridY,
    p_plant_type: plantType,
  });

  if (error) throw error;
  return normalizeContributionRpc(data, "plant");
}

export async function waterGardenPlant(plantId: string) {
  const client = getGardenClient();
  if (!client) throw new Error("The shared garden is not connected yet.");

  const { data, error } = await client.rpc("perform_community_garden_watering", {
    p_plant_id: plantId,
  });

  if (error) throw error;
  return normalizeContributionRpc(data, "water");
}

export async function cleanupExpiredGardenPlants(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return;

  const { error } = await client.rpc("cleanup_community_garden_plants", {
    p_min_x: bounds.minX,
    p_max_x: bounds.maxX,
    p_min_y: bounds.minY,
    p_max_y: bounds.maxY,
  });

  if (error) throw error;
}

