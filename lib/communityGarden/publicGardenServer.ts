import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeFrontierSpawnPoints } from "./frontierSpawns";

const SESSION_COOKIE = "basil-garden-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const snapshotCache = new Map<number, Record<string, unknown>>();

type SignedSession = {
  id: string;
  value: string;
  isNew: boolean;
};

function getSigningSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("The garden server is not configured.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function readSession(request: NextRequest): SignedSession {
  const stored = request.cookies.get(SESSION_COOKIE)?.value;
  if (stored) {
    const [id, signature] = stored.split(".");
    if (
      id &&
      signature &&
      /^[0-9a-f-]{36}$/i.test(id) &&
      safeEqual(sign(id), signature)
    ) {
      return { id, value: stored, isNew: false };
    }
  }

  const id = randomUUID();
  return { id, value: `${id}.${sign(id)}`, isNew: true };
}

function getNetworkAddress(request: NextRequest) {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function getGardenActor(request: NextRequest) {
  const session = readSession(request);
  return {
    session,
    actorKey: sign(`actor:${session.id}`),
    networkKey: sign(`network:${getNetworkAddress(request)}`),
  };
}

export function attachGardenSession(
  response: NextResponse,
  session: SignedSession,
) {
  if (!session.isNew) return;
  response.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function loadCommunityGardenSnapshot() {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_or_create_community_garden_snapshot",
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("The shared garden did not return a snapshot.");
  }
  const snapshot = data as Record<string, unknown>;
  const version = Number(snapshot.version);
  const cached = snapshotCache.get(version);
  if (cached) return cached;

  const plants = Array.isArray(snapshot.plants) ? snapshot.plants : [];
  const enrichedSnapshot: Record<string, unknown> = {
    ...snapshot,
    spawnPoints: computeFrontierSpawnPoints(plants, version),
  };
  snapshotCache.set(version, enrichedSnapshot);
  for (const cachedVersion of snapshotCache.keys()) {
    if (cachedVersion !== version) snapshotCache.delete(cachedVersion);
  }
  return enrichedSnapshot;
}

export async function submitCommunityGardenAction(input: {
  actionId: string;
  actorKey: string;
  networkKey: string;
  action: "plant" | "water";
  gridX?: number;
  gridY?: number;
  plantType?: string;
  plantIds?: string[];
}) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "perform_idempotent_community_garden_action_v2",
    {
      p_action_id: input.actionId,
      p_actor_key: input.actorKey,
      p_network_key: input.networkKey,
      p_action_type: input.action,
      p_grid_x: input.gridX ?? null,
      p_grid_y: input.gridY ?? null,
      p_plant_type: input.plantType ?? null,
      p_plant_ids: input.plantIds ?? null,
    },
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("The shared garden did not confirm that action.");
  }
  return data;
}
