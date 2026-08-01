import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const path = resolve(root, filename);
    try {
      for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[match[1]] = value.replaceAll("\\n", "\n");
      }
    } catch {
      // Environment variables may already be supplied by the scheduled task.
    }
  }
}

loadLocalEnv();

function option(name) {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value?.slice(name.length + 1) ?? "";
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

let storyId = option("--story-id");
const recipePath = resolve(option("--recipe") || resolve(root, "content", "basil-social", "today.json"));
const dailyRecipe = require(recipePath);
const manifestStem = String(dailyRecipe.id ?? "basil-social-sample").replace(/[^a-z0-9_-]+/gi, "-");
const manifestPath = resolve(option("--manifest") || resolve(root, "artifacts", "basil-social-studio", `${manifestStem}.manifest.json`));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qripkmzrujarmmbgewub.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const transferToken = option("--transfer-token");
if (!serviceRoleKey) {
  if (!/^[0-9a-f-]{36}$/i.test(storyId) || !/^[0-9a-f]{64}$/.test(transferToken)) {
    throw new Error("Without a local service key, pass the one-time --story-id=<uuid> and --transfer-token=<64-hex-token> issued through the Supabase connector.");
  }
  const form = new FormData();
  form.set("video", new Blob([readFileSync(resolve(manifest.video))], { type: "video/mp4" }), basename(resolve(manifest.video)));
  form.set("poster", new Blob([readFileSync(resolve(manifest.poster))], { type: "image/jpeg" }), basename(resolve(manifest.poster)));
  form.set("manifest", JSON.stringify(manifest));
  const response = await fetch(`${supabaseUrl}/functions/v1/basil-social-transfer`, {
    method: "POST",
    headers: { "x-basil-story-id": storyId, "x-basil-transfer-token": transferToken },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Basil social upload failed with HTTP ${response.status}.`);
  console.log(JSON.stringify(result));
  process.exit(0);
}
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
if (!storyId) {
  const { data: digest, error: digestError } = await supabase.from("basil_social_digests").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (digestError) throw digestError;
  if (!digest) throw new Error("No Social Studio digest exists yet. Run the daily digest before uploading the package.");
  const { data: rankedStory, error: rankedStoryError } = await supabase.from("basil_social_stories").select("id").eq("digest_id", digest.id).order("rank", { ascending: true }).limit(1).maybeSingle();
  if (rankedStoryError) throw rankedStoryError;
  storyId = rankedStory?.id ?? "";
}
if (!/^[0-9a-f-]{36}$/i.test(storyId)) throw new Error("The destination Social Studio story is missing or invalid.");
const { data: story, error: storyError } = await supabase.from("basil_social_stories").select("id,digest_id,evidence").eq("id", storyId).maybeSingle();
if (storyError) throw storyError;
if (!story) throw new Error("The Social Studio story was not found.");

const assets = [
  { kind: "video", path: resolve(manifest.video), mimeType: "video/mp4", width: manifest.width, height: manifest.height, durationMs: manifest.durationMs },
  { kind: "poster", path: resolve(manifest.poster), mimeType: "image/jpeg", width: manifest.width, height: manifest.height, durationMs: null },
];
for (const asset of assets) {
  const objectPath = `${story.digest_id}/${storyId}/${Date.now()}-${basename(asset.path)}`;
  const bytes = readFileSync(asset.path);
  const { error: uploadError } = await supabase.storage.from("basil-social-assets").upload(objectPath, bytes, {
    contentType: asset.mimeType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { error: metadataError } = await supabase.from("basil_social_assets").insert({
    story_id: storyId,
    kind: asset.kind,
    bucket_id: "basil-social-assets",
    object_path: objectPath,
    mime_type: asset.mimeType,
    byte_size: statSync(asset.path).size,
    width: asset.width,
    height: asset.height,
    duration_ms: asset.durationMs,
    sha256: hashFile(asset.path),
    validation_status: "valid",
    metadata: {
      recipe: manifest.recipe,
      contentFamily: manifest.contentFamily,
      codec: manifest.codec,
      productionManifest: {
        objective: manifest.objective,
        format: manifest.format,
        scene: manifest.scene,
        hook: manifest.hook,
        intendedAudience: manifest.intendedAudience,
        distribution: manifest.distribution,
        hypothesis: manifest.hypothesis,
        alternateHooks: manifest.alternateHooks,
        platforms: manifest.platforms,
        destinationUrl: manifest.destinationUrl,
        trackingCode: manifest.trackingCode,
        truthClaims: manifest.truthClaims,
      },
    },
  });
  if (metadataError) {
    await supabase.storage.from("basil-social-assets").remove([objectPath]);
    throw metadataError;
  }
}
const previousEvidence = story.evidence && typeof story.evidence === "object" ? story.evidence : {};
await supabase.from("basil_social_stories").update({
  title: manifest.title,
  summary: manifest.summary,
  why_today: manifest.whyToday,
  asset_kind: "video",
  evidence: { ...previousEvidence, productionManifest: manifest },
  status: "ready",
  updated_at: new Date().toISOString(),
}).eq("id", storyId);
for (const channel of ["youtube", "instagram", "reddit"]) {
  const copy = manifest.platformCopy?.[channel];
  if (!copy?.headline || !copy?.body || !Array.isArray(copy.hashtags)) {
    throw new Error(`The ${channel} copy is missing from the production manifest.`);
  }
  const { error: copyError } = await supabase.from("basil_social_variants").update({
    headline: String(copy.headline).slice(0, 300),
    body: String(copy.body).slice(0, 10_000),
    hashtags: copy.hashtags.filter((tag) => typeof tag === "string").slice(0, 12),
    status: "draft",
    approved_at: null,
    updated_at: new Date().toISOString(),
  }).eq("story_id", storyId).eq("channel", channel).neq("status", "published");
  if (copyError) throw copyError;
}
console.log(JSON.stringify({ ok: true, storyId, assets: assets.map((asset) => asset.kind) }));

