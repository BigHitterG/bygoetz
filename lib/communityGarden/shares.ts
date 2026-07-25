import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getBasilUrl } from "./urls";

export const GARDEN_SHARE_BUCKET = "basil-garden-shares";
export const GARDEN_SHARE_MAX_BYTES = 2_500_000;
export const GARDEN_SHARE_WIDTH = 1200;
export const GARDEN_SHARE_HEIGHT = 630;
export const GARDEN_SHARE_SCOPES = ["whole", "current"] as const;

const MAX_ACTIVE_SHARES = 20;
const MAX_SHARES_PER_HOUR = 10;

export type GardenShareScope = (typeof GARDEN_SHARE_SCOPES)[number];

type GardenShareRow = {
  id: string;
  share_token: string;
  steward_id: string;
  scope: GardenShareScope;
  storage_path: string;
  image_width: number;
  image_height: number;
  created_at: string;
  revoked_at: string | null;
};

export type GardenPublicShare = {
  token: string;
  scope: GardenShareScope;
  width: number;
  height: number;
  createdAt: string;
  url: string;
  imageUrl: string;
};

function publicShare(row: GardenShareRow): GardenPublicShare {
  return {
    token: row.share_token,
    scope: row.scope,
    width: row.image_width,
    height: row.image_height,
    createdAt: row.created_at,
    url: getBasilUrl(`/garden/${row.share_token}`),
    imageUrl: getBasilUrl(
      `/api/community-garden/shares/${row.share_token}/image`,
    ),
  };
}

function createShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function listGardenShares(stewardId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("garden_public_snapshots")
    .select(
      "id,share_token,steward_id,scope,storage_path,image_width,image_height,created_at,revoked_at",
    )
    .eq("steward_id", stewardId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ACTIVE_SHARES)
    .returns<GardenShareRow[]>();

  if (error) throw error;
  return (data ?? []).map(publicShare);
}

export async function createGardenShare(input: {
  stewardId: string;
  scope: GardenShareScope;
  image: ArrayBuffer;
}) {
  const supabase = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [
    { count: activeCount, error: activeError },
    { count: recentCount, error: recentError },
  ] = await Promise.all([
    supabase
      .from("garden_public_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("steward_id", input.stewardId)
      .is("revoked_at", null),
    supabase
      .from("garden_public_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("steward_id", input.stewardId)
      .gte("created_at", oneHourAgo),
  ]);

  if (activeError) throw activeError;
  if (recentError) throw recentError;
  if ((activeCount ?? 0) >= MAX_ACTIVE_SHARES) {
    throw new Error("Stop sharing an older garden before creating another.");
  }
  if ((recentCount ?? 0) >= MAX_SHARES_PER_HOUR) {
    throw new Error("That is plenty of garden snapshots for now. Try again later.");
  }

  const id = randomUUID();
  const token = createShareToken();
  const storagePath = `${input.stewardId}/${id}.png`;
  const { error: uploadError } = await supabase.storage
    .from(GARDEN_SHARE_BUCKET)
    .upload(storagePath, input.image, {
      cacheControl: "300",
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("garden_public_snapshots")
    .insert({
      id,
      share_token: token,
      steward_id: input.stewardId,
      scope: input.scope,
      storage_path: storagePath,
      image_width: GARDEN_SHARE_WIDTH,
      image_height: GARDEN_SHARE_HEIGHT,
    })
    .select(
      "id,share_token,steward_id,scope,storage_path,image_width,image_height,created_at,revoked_at",
    )
    .single<GardenShareRow>();

  if (error || !data) {
    try {
      await supabase.storage.from(GARDEN_SHARE_BUCKET).remove([storagePath]);
    } catch {
      // Preserve the database error. The random orphan path is not publicly readable.
    }
    throw error ?? new Error("The garden snapshot could not be saved.");
  }

  return publicShare(data);
}

export async function getPublicGardenShare(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("garden_public_snapshots")
    .select(
      "id,share_token,steward_id,scope,storage_path,image_width,image_height,created_at,revoked_at",
    )
    .eq("share_token", token)
    .is("revoked_at", null)
    .maybeSingle<GardenShareRow>();

  if (error) throw error;
  return data ? { ...publicShare(data), storagePath: data.storage_path } : null;
}

export async function downloadGardenShareImage(storagePath: string) {
  const { data, error } = await getSupabaseAdmin().storage
    .from(GARDEN_SHARE_BUCKET)
    .download(storagePath);
  if (error || !data) throw error ?? new Error("The garden image is unavailable.");
  return data;
}

export async function revokeGardenShare(stewardId: string, token: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garden_public_snapshots")
    .update({ revoked_at: new Date().toISOString() })
    .eq("steward_id", stewardId)
    .eq("share_token", token)
    .is("revoked_at", null)
    .select("storage_path")
    .maybeSingle<{ storage_path: string }>();

  if (error) throw error;
  if (!data) return false;

  const { error: removeError } = await supabase.storage
    .from(GARDEN_SHARE_BUCKET)
    .remove([data.storage_path]);
  if (removeError) {
    console.warn("Revoked Basil share image cleanup failed", {
      tokenSuffix: token.slice(-6),
      message: removeError.message,
    });
  }
  return true;
}

export async function removeGardenShareAssetsForUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: steward, error: stewardError } = await supabase
    .from("garden_stewards")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (stewardError) throw stewardError;
  if (!steward) return;

  const { data: shares, error: sharesError } = await supabase
    .from("garden_public_snapshots")
    .select("storage_path")
    .eq("steward_id", steward.id)
    .returns<Array<{ storage_path: string }>>();
  if (sharesError) throw sharesError;

  const paths = (shares ?? []).map((share) => share.storage_path);
  if (!paths.length) return;
  const { error: removeError } = await supabase.storage
    .from(GARDEN_SHARE_BUCKET)
    .remove(paths);
  if (removeError) throw removeError;
}
