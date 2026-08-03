import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const root = resolve(import.meta.dirname, "..");

function option(name) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function writePreparedQueue(outputDirectory, queue) {
  const queuePath = resolve(outputDirectory, `approved-queue-${queue.storyId}.json`);
  const legacyQueuePath = resolve(outputDirectory, "approved-queue.json");
  const serialized = `${JSON.stringify(queue, null, 2)}\n`;
  writeFileSync(queuePath, serialized, "utf8");
  // Keep the legacy pointer for one-story callers, but retain every story's queue.
  writeFileSync(legacyQueuePath, serialized, "utf8");
  return { queuePath, legacyQueuePath };
}

for (const filename of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(root, filename), "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value.replaceAll("\\n", "\n");
    }
  } catch {
    // Scheduled tasks may provide environment variables directly.
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qripkmzrujarmmbgewub.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const transferToken = option("--transfer-token");
const transferStoryId = option("--story-id");
if (!serviceRoleKey) {
  if (!/^[0-9a-f-]{36}$/i.test(transferStoryId) || !/^[0-9a-f]{64}$/.test(transferToken)) {
    throw new Error("Without a local service key, pass the one-time --story-id=<uuid> and --transfer-token=<64-hex-token> issued through the Supabase connector.");
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/basil-social-transfer`, {
    method: "GET",
    headers: { "x-basil-story-id": transferStoryId, "x-basil-transfer-token": transferToken },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Approved package download failed with HTTP ${response.status}.`);
  const runKey = option("--run-key") || `approved-${new Date().toISOString().slice(0, 10)}`;
  const outputDirectory = resolve(root, "artifacts", "basil-social-publish", runKey);
  mkdirSync(outputDirectory, { recursive: true });
  const downloaded = {};
  for (const kind of ["video", "poster"]) {
    if (typeof payload.assets?.[kind] !== "string") continue;
    const assetResponse = await fetch(payload.assets[kind], { signal: AbortSignal.timeout(120_000) });
    if (!assetResponse.ok) throw new Error(`Could not download the approved ${kind}.`);
    const extension = kind === "video" ? "mp4" : "jpg";
    const path = resolve(outputDirectory, `${transferStoryId}-${kind}.${extension}`);
    writeFileSync(path, Buffer.from(await assetResponse.arrayBuffer()));
    downloaded[kind] = path;
  }
  if (!downloaded.video) throw new Error("The approved transfer did not include a validated video.");
  const platformOrder = ["youtube", "instagram", "reddit"];
  const approved = platformOrder.flatMap((channel) => (payload.posts ?? []).filter((variant) => variant.channel === channel).slice(0, 1));
  const queue = {
    schemaVersion: 1,
    preparedAt: new Date().toISOString(),
    runKey,
    storyId: transferStoryId,
    files: downloaded,
    posts: approved.map((variant) => ({
      variantId: variant.id,
      channel: variant.channel,
      headline: variant.headline,
      body: variant.body,
      hashtags: Array.isArray(variant.hashtags) ? variant.hashtags : [],
      destinationUrl: `https://basilcommunitygarden.com/?utm_source=${variant.channel}&utm_medium=organic&utm_campaign=basil_daily&utm_content=${transferStoryId}`,
      publishState: "approved_not_published",
    })),
  };
  const { queuePath, legacyQueuePath } = writePreparedQueue(outputDirectory, queue);
  console.log(JSON.stringify({ ok: true, approved: queue.posts.length, queue: queuePath, legacyQueue: legacyQueuePath, video: downloaded.video, poster: downloaded.poster ?? null }, null, 2));
  process.exit(0);
}
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: digest, error: digestError } = await supabase
  .from("basil_social_digests")
  .select("id,run_key,approval_expires_at,created_at")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (digestError) throw digestError;
if (!digest) throw new Error("No Social Studio package exists.");
if (new Date(digest.approval_expires_at).getTime() <= Date.now()) throw new Error("The latest Social Studio review has expired.");

const { data: stories, error: storiesError } = await supabase
  .from("basil_social_stories")
  .select("id,title,rank")
  .eq("digest_id", digest.id)
  .order("rank", { ascending: true });
if (storiesError) throw storiesError;
const storyIds = (stories ?? []).map((story) => story.id);
if (!storyIds.length) throw new Error("The latest Social Studio package has no stories.");

const [{ data: assets, error: assetsError }, { data: variants, error: variantsError }] = await Promise.all([
  supabase.from("basil_social_assets").select("id,story_id,kind,bucket_id,object_path,mime_type,created_at").in("story_id", storyIds).eq("validation_status", "valid").in("kind", ["video", "poster"]).order("created_at", { ascending: false }),
  supabase.from("basil_social_variants").select("id,story_id,channel,headline,body,hashtags,status").in("story_id", storyIds).eq("status", "manual_ready").in("channel", ["youtube", "instagram", "reddit"]),
]);
if (assetsError) throw assetsError;
if (variantsError) throw variantsError;

const sourceStory = (stories ?? []).find((story) => (assets ?? []).some((asset) => asset.story_id === story.id && asset.kind === "video"));
if (!sourceStory) throw new Error("No approved package has a validated video yet.");
const platformOrder = ["youtube", "instagram", "reddit"];
const approved = platformOrder.flatMap((channel) => (variants ?? []).filter((variant) => variant.story_id === sourceStory.id && variant.channel === channel).slice(0, 1));
if (!approved.length) {
  console.log(JSON.stringify({ ok: true, digest: digest.run_key, approved: 0, message: "Nothing was approved; no publishing files were prepared." }, null, 2));
  process.exit(0);
}

const outputDirectory = resolve(root, "artifacts", "basil-social-publish", digest.run_key);
mkdirSync(outputDirectory, { recursive: true });
const downloaded = {};
for (const kind of ["video", "poster"]) {
  const asset = (assets ?? []).find((candidate) => candidate.story_id === sourceStory.id && candidate.kind === kind);
  if (!asset) continue;
  const { data, error } = await supabase.storage.from(asset.bucket_id).download(asset.object_path);
  if (error) throw error;
  const extension = kind === "video" ? "mp4" : "jpg";
  const path = resolve(outputDirectory, `${sourceStory.id}-${kind}.${extension}`);
  writeFileSync(path, Buffer.from(await data.arrayBuffer()));
  downloaded[kind] = path;
}
if (!downloaded.video) throw new Error("The validated video could not be downloaded.");

const destinationUrl = "https://basilcommunitygarden.com/";
const queue = {
  schemaVersion: 1,
  preparedAt: new Date().toISOString(),
  digestId: digest.id,
  runKey: digest.run_key,
  storyId: sourceStory.id,
  storyTitle: sourceStory.title,
  files: downloaded,
  posts: approved.map((variant) => ({
    variantId: variant.id,
    channel: variant.channel,
    headline: variant.headline,
    body: variant.body,
    hashtags: Array.isArray(variant.hashtags) ? variant.hashtags : [],
    destinationUrl: `${destinationUrl}?utm_source=${variant.channel}&utm_medium=organic&utm_campaign=basil_daily&utm_content=${sourceStory.id}`,
    publishState: "approved_not_published",
  })),
};
const { queuePath, legacyQueuePath } = writePreparedQueue(outputDirectory, queue);
console.log(JSON.stringify({ ok: true, approved: queue.posts.length, queue: queuePath, legacyQueue: legacyQueuePath, video: downloaded.video, poster: downloaded.poster ?? null }, null, 2));
