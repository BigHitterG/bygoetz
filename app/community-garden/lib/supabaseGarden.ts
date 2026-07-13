import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GardenBounds } from "./gardenConfig";
import type { RoseRecord } from "./roseLifecycle";

export type GardenMapRose = Pick<RoseRecord, "grid_x" | "grid_y">;

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

function normalizeRpcRose(data: unknown): RoseRecord {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("The garden did not return a rose.");
  }
  return value as RoseRecord;
}

export async function fetchGardenRoses(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return [];

  const { data, error } = await client
    .from("community_garden_roses")
    .select("id,grid_x,grid_y,planted_at,last_watered_at,created_at")
    .gte("grid_x", bounds.minX)
    .lte("grid_x", bounds.maxX)
    .gte("grid_y", bounds.minY)
    .lte("grid_y", bounds.maxY)
    .order("grid_x")
    .order("grid_y");

  if (error) throw error;
  return (data ?? []) as RoseRecord[];
}

export async function fetchGardenRoseMap(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return [];

  const { data, error } = await client
    .from("community_garden_roses")
    .select("grid_x,grid_y")
    .gte("grid_x", bounds.minX)
    .lte("grid_x", bounds.maxX)
    .gte("grid_y", bounds.minY)
    .lte("grid_y", bounds.maxY)
    .order("grid_x")
    .order("grid_y")
    .limit(1000);

  if (error) throw error;
  return (data ?? []) as GardenMapRose[];
}

export async function plantGardenRose(gridX: number, gridY: number) {
  const client = getGardenClient();
  if (!client) throw new Error("The shared garden is not connected yet.");

  const { data, error } = await client.rpc("plant_community_garden_rose", {
    p_grid_x: gridX,
    p_grid_y: gridY,
  });

  if (error) throw error;
  return normalizeRpcRose(data);
}

export async function waterGardenRose(roseId: string) {
  const client = getGardenClient();
  if (!client) throw new Error("The shared garden is not connected yet.");

  const { data, error } = await client.rpc("water_community_garden_rose", {
    p_rose_id: roseId,
  });

  if (error) throw error;
  return normalizeRpcRose(data);
}

export async function cleanupExpiredGardenRoses(bounds: GardenBounds) {
  const client = getGardenClient();
  if (!client) return;

  const { error } = await client.rpc("cleanup_community_garden_roses", {
    p_min_x: bounds.minX,
    p_max_x: bounds.maxX,
    p_min_y: bounds.minY,
    p_max_y: bounds.maxY,
  });

  if (error) throw error;
}

