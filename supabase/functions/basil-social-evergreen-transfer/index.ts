import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "basil-social-evergreen";
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "image/jpeg",
  "image/png",
  "application/json",
]);
const ALLOWED_ROLES = new Set([
  "keyframe",
  "alternate_keyframe",
  "final_video",
  "poster",
  "diagram",
  "species_profile",
  "production_manifest",
  "caption_timing",
]);

function response(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  return keys.default;
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  const collectionId = request.headers.get("x-basil-collection-id") ?? "";
  const token = request.headers.get("x-basil-transfer-token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(collectionId) || !/^[0-9a-f]{64}$/i.test(token)) {
    return response(401, { error: "A valid evergreen upload capability is required." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!url || !key) return response(500, { error: "Supabase server credentials are unavailable." });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_basil_social_evergreen_transfer_token", {
    p_collection_id: collectionId,
    p_token: token,
  });
  if (claimError) return response(500, { error: claimError.message });
  if (claimed !== true) return response(401, { error: "This evergreen upload capability is invalid, expired, or exhausted." });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const rawMetadata = form?.get("metadata");
  if (!(file instanceof File) || typeof rawMetadata !== "string") {
    return response(400, { error: "The evergreen upload requires one file and its metadata." });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type) || file.size < 1 || file.size > MAX_BYTES) {
    return response(400, { error: "The evergreen file type or size is invalid." });
  }

  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(rawMetadata) as Record<string, unknown>;
  } catch {
    return response(400, { error: "Evergreen metadata is not valid JSON." });
  }
  const assetKey = String(metadata.assetKey ?? "");
  const assetRole = String(metadata.assetRole ?? "");
  if (!/^[a-z0-9][a-z0-9._-]{1,119}$/.test(assetKey) || !ALLOWED_ROLES.has(assetRole)) {
    return response(400, { error: "The evergreen asset key or role is invalid." });
  }
  const stageIndex = metadata.stageIndex == null ? null : Number(metadata.stageIndex);
  const width = metadata.width == null ? null : Number(metadata.width);
  const height = metadata.height == null ? null : Number(metadata.height);
  const durationMs = metadata.durationMs == null ? null : Number(metadata.durationMs);
  if (stageIndex != null && (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 100)) {
    return response(400, { error: "The evergreen stage index is invalid." });
  }
  if (width != null && (!Number.isInteger(width) || width < 1 || width > 7680)) {
    return response(400, { error: "The evergreen width is invalid." });
  }
  if (height != null && (!Number.isInteger(height) || height < 1 || height > 7680)) {
    return response(400, { error: "The evergreen height is invalid." });
  }
  if (durationMs != null && (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > 900000)) {
    return response(400, { error: "The evergreen duration is invalid." });
  }

  const { data: collection, error: collectionError } = await supabase
    .from("basil_social_evergreen_collections")
    .select("id,collection_key")
    .eq("id", collectionId)
    .maybeSingle();
  if (collectionError) return response(500, { error: collectionError.message });
  if (!collection) return response(404, { error: "Evergreen collection not found." });

  const bytes = await file.arrayBuffer();
  const hash = await sha256(bytes);
  const { data: existing, error: existingError } = await supabase
    .from("basil_social_evergreen_assets")
    .select("id,object_path,version")
    .eq("collection_id", collectionId)
    .eq("asset_key", assetKey)
    .eq("sha256", hash)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return response(500, { error: existingError.message });
  if (existing) return response(200, { ok: true, idempotent: true, asset: existing });

  const { data: latest, error: latestError } = await supabase
    .from("basil_social_evergreen_assets")
    .select("version")
    .eq("collection_id", collectionId)
    .eq("asset_key", assetKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) return response(500, { error: latestError.message });
  const version = Number(latest?.version ?? 0) + 1;
  const filename = safeFilename(file.name) || `${assetKey}.bin`;
  const objectPath = `${collection.collection_key}/${assetKey}/${hash}-${filename}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return response(500, { error: uploadError.message });

  await supabase.from("basil_social_evergreen_assets")
    .update({ is_current: false })
    .eq("collection_id", collectionId)
    .eq("asset_key", assetKey)
    .eq("is_current", true);
  const { data: asset, error: insertError } = await supabase
    .from("basil_social_evergreen_assets")
    .insert({
      collection_id: collectionId,
      asset_key: assetKey,
      asset_role: assetRole,
      version,
      is_current: true,
      stage_index: stageIndex,
      stage_key: metadata.stageKey == null ? null : String(metadata.stageKey).slice(0, 120),
      bucket_id: BUCKET,
      object_path: objectPath,
      original_filename: filename,
      mime_type: file.type,
      byte_size: file.size,
      sha256: hash,
      width,
      height,
      duration_ms: durationMs,
      metadata: metadata.metadata && typeof metadata.metadata === "object" ? metadata.metadata : {},
    })
    .select("id,asset_key,asset_role,version,object_path,sha256,byte_size")
    .single();
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    if (latest) {
      await supabase.from("basil_social_evergreen_assets")
        .update({ is_current: true })
        .eq("collection_id", collectionId)
        .eq("asset_key", assetKey)
        .eq("version", latest.version);
    }
    return response(500, { error: insertError.message });
  }
  return response(200, { ok: true, idempotent: false, asset });
});

