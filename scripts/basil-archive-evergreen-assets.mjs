import { readFileSync, statSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadLocalEnv() {
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
      // Scheduled runs may supply environment variables directly.
    }
  }
}

function option(name) {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value?.slice(name.length + 1) ?? "";
}

function localPath(value) {
  const path = resolve(root, value.replace(/^\//, "public/"));
  const rel = relative(root, path);
  if (rel.startsWith(`..${sep}`) || rel === "..") throw new Error(`Archive path escapes the repository: ${value}`);
  return path;
}

function expandLifecycle(collection) {
  if (!collection.lifecycleProfile) return collection.assets;
  const profile = JSON.parse(readFileSync(localPath(collection.lifecycleProfile), "utf8"));
  const stages = profile.stages.map((stage, stageIndex) => ({
    assetKey: `stage-${String(stageIndex + 1).padStart(2, "0")}-${stage.id}`,
    assetRole: "keyframe",
    stageIndex,
    stageKey: stage.id,
    path: stage.image,
    mimeType: "image/png",
    width: 941,
    height: 1672,
    metadata: { label: stage.label, ageRange: stage.ageRange, biology: stage.biology },
  }));
  return [...stages, ...collection.assets];
}

loadLocalEnv();
const manifestPath = localPath(option("--manifest") || "content/basil-social/evergreen-archive.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const collectionKey = option("--collection-key");
const collectionId = option("--collection-id");
const transferToken = option("--transfer-token");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qripkmzrujarmmbgewub.supabase.co";
if (!collectionKey) throw new Error("Pass --collection-key=<manifest collection key>.");
if (!/^[0-9a-f-]{36}$/i.test(collectionId) || !/^[0-9a-f]{64}$/i.test(transferToken)) {
  throw new Error("Pass the collection UUID and short-lived 64-hex transfer token issued through the connected Supabase tool.");
}
const collection = manifest.collections.find((entry) => entry.collectionKey === collectionKey);
if (!collection) throw new Error(`Collection is not present in ${relative(root, manifestPath)}: ${collectionKey}`);
const assets = expandLifecycle(collection);

for (const asset of assets) {
  const path = localPath(asset.path);
  const size = statSync(path).size;
  if (size < 1 || size > 100 * 1024 * 1024) throw new Error(`Archive asset has an invalid size: ${asset.path}`);
  const form = new FormData();
  form.set("file", new Blob([readFileSync(path)], { type: asset.mimeType }), basename(path));
  form.set("metadata", JSON.stringify({
    assetKey: asset.assetKey,
    assetRole: asset.assetRole,
    stageIndex: asset.stageIndex,
    stageKey: asset.stageKey,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    metadata: { repositoryPath: asset.path, ...(asset.metadata ?? {}) },
  }));
  const response = await fetch(`${supabaseUrl}/functions/v1/basil-social-evergreen-transfer`, {
    method: "POST",
    headers: { "x-basil-collection-id": collectionId, "x-basil-transfer-token": transferToken },
    body: form,
    signal: AbortSignal.timeout(300_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${asset.assetKey}: ${result.error ?? `HTTP ${response.status}`}`);
  console.log(JSON.stringify({ assetKey: asset.assetKey, bytes: size, idempotent: result.idempotent === true }));
}

console.log(JSON.stringify({ ok: true, collectionKey, uploadedOrVerified: assets.length }));

