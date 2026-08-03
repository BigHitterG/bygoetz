
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");

function option(name, fallback) {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value ? value.slice(name.length + 1) : fallback;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const runtimePackage = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright");
    if (existsSync(runtimePackage)) return require(runtimePackage);
    const pnpmDirectory = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", ".pnpm");
    const packageDirectory = readdirSync(pnpmDirectory).find((name) => name.startsWith("playwright@"));
    if (!packageDirectory) throw new Error("Playwright is required to render the Basil diagram.");
    return require(join(pnpmDirectory, packageDirectory, "node_modules", "playwright"));
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("The Basil development server stopped before diagram capture began.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Next.js is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

const recipePath = resolve(root, option("--recipe", "content/basil-social/today-3.json"));
const recipe = require(recipePath);
let productionRecipe = recipe;
if (recipe.assetKind !== "image" || recipe.scene !== "community-grid-diagram") {
  throw new Error("The diagram renderer accepts only the implemented community-grid-diagram image recipe.");
}
if (!Array.isArray(recipe.truthClaims) || recipe.truthClaims.some((claim) => claim?.supported !== true || !claim?.basis)) {
  throw new Error("Every diagram truth claim must be explicitly supported before rendering.");
}
for (const channel of ["instagram", "reddit"]) {
  const copy = recipe.platformCopy?.[channel];
  if (!copy || typeof copy.headline !== "string" || typeof copy.body !== "string" || !Array.isArray(copy.hashtags)) {
    throw new Error(`The diagram recipe is missing complete ${channel} copy.`);
  }
}
if (recipe.platformCopy?.youtube) throw new Error("Static diagrams must not create a YouTube draft.");

function hydrateRecipe(snapshot) {
  const values = {
    "{{plantCount}}": snapshot.plantCount.toLocaleString("en-US"),
    "{{roses}}": snapshot.counts.rose.toLocaleString("en-US"),
    "{{lavender}}": snapshot.counts.lavender.toLocaleString("en-US"),
    "{{sunflowers}}": snapshot.counts.sunflower.toLocaleString("en-US"),
    "{{generatedAt}}": snapshot.generatedAt,
  };
  let serialized = JSON.stringify(recipe);
  for (const [token, value] of Object.entries(values)) serialized = serialized.replaceAll(token, value);
  return JSON.parse(serialized);
}

const outputDirectory = resolve(root, "artifacts", "basil-social-studio");
const stem = String(recipe.id).replace(/[^a-z0-9_-]+/gi, "-");
const outputImage = resolve(outputDirectory, `${stem}.png`);
const outputManifest = resolve(outputDirectory, `${stem}.manifest.json`);
mkdirSync(outputDirectory, { recursive: true });

const captureUrl = option("--url", "http://localhost:3010/community-garden/social-diagram");
const server = process.argv.includes("--no-server")
  ? null
  : spawn(process.execPath, [resolve(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3010"], { cwd: root, stdio: "inherit", windowsHide: true });
const playwright = loadPlaywright();
let browser;
let liveSnapshot;
try {
  if (server) await waitForServer(captureUrl, server);
  browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const snapshotVersion = Math.floor(Date.now() / (10 * 60 * 1000));
  const snapshotResponse = await context.request.get(`https://basilcommunitygarden.com/api/community-garden/snapshot?version=${snapshotVersion}`, { timeout: 30_000 });
  if (!snapshotResponse.ok()) throw new Error(`The live Basil garden snapshot returned HTTP ${snapshotResponse.status()}.`);
  const gardenSnapshot = await snapshotResponse.json();
  await page.goto(captureUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__BASIL_SOCIAL_DIAGRAM_CONTROL__), undefined, { timeout: 30_000 });
  await page.evaluate((snapshot) => window.__BASIL_SOCIAL_DIAGRAM_CONTROL__?.loadSnapshot(snapshot), gardenSnapshot);
  await page.locator('[data-diagram-ready="true"]').waitFor({ state: "visible", timeout: 30_000 });
  liveSnapshot = await page.evaluate(() => window.__BASIL_SOCIAL_DIAGRAM__);
  if (!liveSnapshot || liveSnapshot.source !== "live-community-snapshot" || !liveSnapshot.generatedAt) {
    throw new Error("The diagram did not provide a verified live community-garden snapshot.");
  }
  const expected = recipe.snapshotExpectation;
  const countSum = Object.values(liveSnapshot.counts ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!expected || liveSnapshot.plantCount < expected.minimumPlantCount
    || expected.requiredTypes.some((type) => !(liveSnapshot.counts?.[type] > 0))
    || countSum !== liveSnapshot.plantCount) {
    throw new Error(`The live community garden snapshot failed the diversity contract: ${JSON.stringify({ plantCount: liveSnapshot.plantCount, counts: liveSnapshot.counts, generatedAt: liveSnapshot.generatedAt })}`);
  }
  productionRecipe = hydrateRecipe(liveSnapshot);
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.screenshot({ path: outputImage });
  await context.close();
} finally {
  await browser?.close();
  if (server && server.exitCode === null) server.kill();
}

const bytes = readFileSync(outputImage);
const isPng = bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG";
const width = isPng ? bytes.readUInt32BE(16) : 0;
const height = isPng ? bytes.readUInt32BE(20) : 0;
if (!isPng || width !== 1080 || height !== 1350 || statSync(outputImage).size < 100_000) {
  throw new Error("The diagram failed Basil's 1080x1350 PNG delivery contract.");
}

const manifest = {
  schemaVersion: 2,
  recipe: productionRecipe.id,
  assetKind: "image",
  contentFamily: productionRecipe.contentFamily,
  bulletinType: productionRecipe.bulletinType,
  bulletinLabel: productionRecipe.bulletinLabel,
  objective: productionRecipe.objective,
  format: productionRecipe.format,
  scene: productionRecipe.scene,
  gameplayRecipe: productionRecipe.gameplayRecipe,
  title: productionRecipe.title,
  summary: productionRecipe.summary,
  whyToday: productionRecipe.whyToday,
  hook: productionRecipe.hook,
  intendedAudience: productionRecipe.intendedAudience,
  distribution: productionRecipe.distribution,
  hypothesis: productionRecipe.hypothesis,
  alternateHooks: productionRecipe.alternateHooks,
  platforms: productionRecipe.platforms,
  destinationUrl: productionRecipe.destinationUrl,
  trackingCode: productionRecipe.trackingCode,
  truthClaims: productionRecipe.truthClaims,
  platformCopy: productionRecipe.platformCopy,
  source: productionRecipe.sourceNote,
  liveSnapshot,
  image: outputImage,
  mimeType: "image/png",
  width,
  height,
  codec: "PNG",
  validationStatus: "valid",
};
writeFileSync(outputManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...manifest, manifest: outputManifest }, null, 2));

