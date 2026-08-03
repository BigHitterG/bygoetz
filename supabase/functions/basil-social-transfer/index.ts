
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_POSTER_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const allowedChannels = ["youtube", "instagram", "reddit"];

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

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const storyId = request.headers.get("x-basil-story-id") ?? "";
  const token = request.headers.get("x-basil-transfer-token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(storyId) || !/^[0-9a-f]{64}$/.test(token)) {
    return response(401, { error: "Invalid or missing Basil transfer capability." });
  }
  const url = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!url || !key) return response(500, { error: "Supabase server credentials are unavailable." });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const purpose = request.method === "POST"
    ? "upload"
    : request.method === "GET"
      ? "download"
      : request.method === "DELETE"
        ? "cleanup"
        : "";
  if (!purpose) return response(405, { error: "Method not allowed." });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_basil_social_transfer_token", {
    p_story_id: storyId,
    p_purpose: purpose,
    p_token: token,
  });
  if (claimError) return response(500, { error: claimError.message });
  if (claimed !== true) return response(401, { error: "This transfer capability is invalid, expired, or already used." });

  if (request.method === "GET") {
    const [{ data: variants, error: variantError }, { data: assets, error: assetError }] = await Promise.all([
      supabase.from("basil_social_variants")
        .select("id,channel,headline,body,hashtags")
        .eq("story_id", storyId)
        .eq("status", "manual_ready")
        .in("channel", allowedChannels),
      supabase.from("basil_social_assets")
        .select("kind,bucket_id,object_path,created_at")
        .eq("story_id", storyId)
        .eq("validation_status", "valid")
        .in("kind", ["video", "poster", "image"])
        .order("created_at", { ascending: false }),
    ]);
    if (variantError) return response(500, { error: variantError.message });
    if (assetError) return response(500, { error: assetError.message });
    if (!variants?.length) return response(409, { error: "This story has no explicitly approved posts." });
    const signed: Record<string, string> = {};
    for (const kind of ["video", "poster", "image"]) {
      const asset = assets?.find((candidate) => candidate.kind === kind);
      if (!asset) continue;
      const { data, error } = await supabase.storage.from(asset.bucket_id).createSignedUrl(asset.object_path, 15 * 60);
      if (error) return response(500, { error: error.message });
      signed[kind] = data.signedUrl;
    }
    if (!signed.video && !signed.image) return response(409, { error: "This story does not have a validated video or diagram." });
    return response(200, { storyId, assets: signed, posts: variants });
  }

  if (request.method === "DELETE") {
    const { data: assets, error: assetError } = await supabase.from("basil_social_assets")
      .select("id,bucket_id,object_path")
      .eq("story_id", storyId);
    if (assetError) return response(500, { error: assetError.message });
    const byBucket = new Map<string, string[]>();
    for (const asset of assets ?? []) {
      const paths = byBucket.get(asset.bucket_id) ?? [];
      paths.push(asset.object_path);
      byBucket.set(asset.bucket_id, paths);
    }
    for (const [bucket, paths] of byBucket) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) return response(409, { error: error.message });
    }
    if (assets?.length) {
      const { error } = await supabase.from("basil_social_assets")
        .delete()
        .in("id", assets.map((asset) => asset.id));
      if (error) return response(500, { error: error.message });
    }
    return response(200, { ok: true, storyId, removed: assets?.length ?? 0 });
  }

  const uploaded: string[] = [];
  try {
    const form = await request.formData();
    const video = form.get("video");
    const poster = form.get("poster");
    const image = form.get("image");
    const manifestPart = form.get("manifest");
    const diagramFile = image instanceof File ? image : null;
    const isImagePackage = diagramFile !== null;
    if (isImagePackage && (video instanceof File || poster instanceof File)) return response(400, { error: "A package must contain either one diagram or one video with its poster." });
    if (isImagePackage) {
      if (diagramFile.type !== "image/png" || diagramFile.size < 100_000 || diagramFile.size > MAX_IMAGE_BYTES) {
        return response(400, { error: "A valid PNG diagram within the private bucket limit is required." });
      }
    } else {
      if (!(video instanceof File) || video.type !== "video/mp4" || video.size < 100_000 || video.size > MAX_VIDEO_BYTES) {
        return response(400, { error: "A valid MP4 within the private bucket limit is required." });
      }
      if (!(poster instanceof File) || poster.type !== "image/jpeg" || poster.size < 10_000 || poster.size > MAX_POSTER_BYTES) {
        return response(400, { error: "A valid JPEG poster is required." });
      }
    }
    const manifestText = typeof manifestPart === "string"
      ? manifestPart
      : manifestPart instanceof File && manifestPart.size <= 200_000
        ? await manifestPart.text()
        : "";
    if (!manifestText) return response(400, { error: "A valid production manifest is required." });
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    const claims = Array.isArray(manifest.truthClaims) ? manifest.truthClaims as Array<Record<string, unknown>> : [];
    const dimensionsValid = isImagePackage
      ? manifest.assetKind === "image" && manifest.width === 1080 && manifest.height === 1350 && manifest.codec === "PNG"
      : manifest.assetKind !== "image" && manifest.width === 1080 && manifest.height === 1920 && manifest.codec === "H.264/AAC";
    if (!dimensionsValid || manifest.validationStatus !== "valid") {
      return response(400, { error: `The ${isImagePackage ? "diagram" : "video"} manifest did not pass Basil's delivery contract.` });
    }
    if (!claims.length || claims.some((claim) => claim.supported !== true || typeof claim.basis !== "string")) {
      return response(400, { error: "Every production truth claim must be supported." });
    }
    const platformCopy = manifest.platformCopy && typeof manifest.platformCopy === "object"
      ? manifest.platformCopy as Record<string, Record<string, unknown>>
      : {};
    const requiredChannels = isImagePackage ? ["instagram", "reddit"] : allowedChannels;
    if (requiredChannels.some((channel) => {
      const copy = platformCopy[channel];
      return !copy || typeof copy.headline !== "string" || typeof copy.body !== "string" || !Array.isArray(copy.hashtags);
    })) {
      return response(400, { error: `${requiredChannels.join(", ")} copy must be included in the production manifest.` });
    }
    const { data: story, error: storyError } = await supabase.from("basil_social_stories").select("id,digest_id,evidence").eq("id", storyId).maybeSingle();
    if (storyError) throw storyError;
    if (!story) return response(404, { error: "The Social Studio story was not found." });
    const packageId = crypto.randomUUID();
    const files = isImagePackage
      ? [{ kind: "image", file: diagramFile, path: `${story.digest_id}/${storyId}/${packageId}.png`, width: manifest.width, height: manifest.height, durationMs: null }]
      : [
          { kind: "video", file: video as File, path: `${story.digest_id}/${storyId}/${packageId}.mp4`, width: manifest.width, height: manifest.height, durationMs: manifest.durationMs },
          { kind: "poster", file: poster as File, path: `${story.digest_id}/${storyId}/${packageId}-poster.jpg`, width: manifest.width, height: manifest.height, durationMs: null },
        ];
    for (const asset of files) {
      const bytes = await asset.file.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from("basil-social-assets").upload(asset.path, bytes, {
        contentType: asset.file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploaded.push(asset.path);
      const { error: metadataError } = await supabase.from("basil_social_assets").insert({
        story_id: storyId,
        kind: asset.kind,
        bucket_id: "basil-social-assets",
        object_path: asset.path,
        mime_type: asset.file.type,
        byte_size: asset.file.size,
        width: asset.width,
        height: asset.height,
        duration_ms: asset.durationMs,
        sha256: await sha256(bytes),
        validation_status: "valid",
        metadata: { recipe: manifest.recipe, contentFamily: manifest.contentFamily, codec: manifest.codec, productionManifest: manifest },
      });
      if (metadataError) throw metadataError;
    }
    const previousEvidence = story.evidence && typeof story.evidence === "object" ? story.evidence : {};
    const { error: updateError } = await supabase.from("basil_social_stories").update({
      title: typeof manifest.title === "string" ? manifest.title : undefined,
      summary: typeof manifest.summary === "string" ? manifest.summary : undefined,
      why_today: typeof manifest.whyToday === "string" ? manifest.whyToday : undefined,
      asset_kind: isImagePackage ? "image" : "video",
      evidence: { ...previousEvidence, productionManifest: manifest },
      status: "ready",
      updated_at: new Date().toISOString(),
    }).eq("id", storyId);
    if (updateError) throw updateError;
    for (const channel of requiredChannels) {
      const copy = platformCopy[channel];
      const { error: copyError } = await supabase.from("basil_social_variants").update({
        headline: String(copy.headline).slice(0, 300),
        body: String(copy.body).slice(0, 10_000),
        hashtags: (copy.hashtags as unknown[]).filter((tag): tag is string => typeof tag === "string").slice(0, 12),
        status: "draft",
        approved_at: null,
        updated_at: new Date().toISOString(),
      }).eq("story_id", storyId).eq("channel", channel).neq("status", "published");
      if (copyError) throw copyError;
    }
    if (isImagePackage) {
      const { error: removeVideoDraftError } = await supabase.from("basil_social_variants")
        .delete()
        .eq("story_id", storyId)
        .eq("channel", "youtube")
        .neq("status", "published");
      if (removeVideoDraftError) throw removeVideoDraftError;
    }
    return response(200, { ok: true, storyId, assets: files.map((asset) => asset.kind) });
  } catch (error) {
    if (uploaded.length) await supabase.storage.from("basil-social-assets").remove(uploaded);
    return response(409, { error: error instanceof Error ? error.message : "Basil social transfer failed." });
  }
});


