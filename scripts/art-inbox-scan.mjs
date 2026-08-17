import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const inboxRoot = path.join(process.cwd(), ".art-inbox");
const assetsRoot = path.join(inboxRoot, "assets");
const manifestPath = path.join(inboxRoot, "inbox.json");
const imageExtensions = new Set([".avif", ".heic", ".jpeg", ".jpg", ".png", ".webp"]);

await mkdir(assetsRoot, { recursive: true });

async function listImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listImages(fullPath);
      return imageExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
    }),
  );

  return nested.flat();
}

async function readExistingManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { version: 1, photos: [], assignments: [], groups: [] };
    }
    throw error;
  }
}

const existing = await readExistingManifest();
const existingByRelativePath = new Map(
  existing.photos.map((photo) => [photo.relativePath, photo]),
);
const existingByChecksum = new Map();
for (const photo of existing.photos) {
  const matches = existingByChecksum.get(photo.checksum) ?? [];
  matches.push(photo);
  existingByChecksum.set(photo.checksum, matches);
}
const reusedPhotoIds = new Set();
const files = await listImages(assetsRoot);
const photos = [];

for (const file of files.toSorted()) {
  const bytes = await readFile(file);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const relativePath = path.relative(inboxRoot, file).replaceAll(path.sep, "/");
  const pathMatch = existingByRelativePath.get(relativePath);
  const checksumMatch = existingByChecksum
    .get(checksum)
    ?.find((photo) => !reusedPhotoIds.has(photo.id));
  const previous =
    pathMatch?.checksum === checksum && !reusedPhotoIds.has(pathMatch.id)
      ? pathMatch
      : checksumMatch;
  const fileStat = await stat(file);

  if (previous) reusedPhotoIds.add(previous.id);

  photos.push({
    id: previous?.id ?? randomUUID(),
    relativePath,
    originalFilename: path.basename(file),
    importedAt: previous?.importedAt ?? new Date().toISOString(),
    byteLength: fileStat.size,
    checksum,
    review: previous?.review ?? "unreviewed",
  });
}

const photoIds = new Set(photos.map((photo) => photo.id));
const manifest = {
  version: 1,
  photos,
  assignments: existing.assignments.filter((assignment) => photoIds.has(assignment.photoId)),
  groups: existing.groups
    .map((group) => ({
      ...group,
      photoIds: group.photoIds.filter((photoId) => photoIds.has(photoId)),
    }))
    .filter((group) => group.photoIds.length > 0),
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Artwork Inbox: ${photos.length} photo${photos.length === 1 ? "" : "s"} indexed.`);
console.log(path.relative(process.cwd(), manifestPath));
