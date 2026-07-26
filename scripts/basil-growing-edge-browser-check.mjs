import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const playwright = require(
  join(
    homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
    "playwright",
  ),
);

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3013/community-garden";
const now = new Date().toISOString();
const nextRefreshAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const regions = [];
for (let regionY = -6; regionY <= 3; regionY += 1) {
  for (let regionX = -6; regionX <= 3; regionX += 1) {
    const distance = Math.hypot(regionX + 1.5, regionY + 1.5);
    const plantCount = Math.round(Math.max(0, 130 - distance * 17));
    regions.push({
      regionKey: `${regionX}:${regionY}`,
      regionX,
      regionY,
      bounds: {
        minX: regionX * 16,
        maxX: regionX * 16 + 15,
        minY: regionY * 16,
        maxY: regionY * 16 + 15,
      },
      publicStage: regionX === 3 && regionY === 0 ? "new" : "garden",
      supportLevel: 0,
      isOpen: true,
      newlyOpened: regionX === 3 && regionY === 0,
      plantCount,
      heritagePlantCount: (regionX + regionY) % 5 === 0 ? 2 : 0,
      weedCount: 0,
      occupancyPercent: Math.min(100, (plantCount / 180) * 100),
    });
  }
}
for (const candidate of [
  { regionX: -7, regionY: -2, stage: "edge", support: 0 },
  { regionX: -7, regionY: 0, stage: "growing", support: 2 },
  { regionX: 4, regionY: -1, stage: "ready", support: 3 },
  { regionX: 1, regionY: -7, stage: "growing", support: 1 },
  { regionX: -2, regionY: 4, stage: "edge", support: 0 },
]) {
  regions.push({
    regionKey: `${candidate.regionX}:${candidate.regionY}`,
    regionX: candidate.regionX,
    regionY: candidate.regionY,
    bounds: {
      minX: candidate.regionX * 16,
      maxX: candidate.regionX * 16 + 15,
      minY: candidate.regionY * 16,
      maxY: candidate.regionY * 16 + 15,
    },
    publicStage: candidate.stage,
    supportLevel: candidate.support,
    isOpen: false,
    newlyOpened: false,
    plantCount: 0,
    heritagePlantCount: 0,
    weedCount: 0,
    occupancyPercent: 0,
  });
}

const manifest = {
  schemaVersion: 2,
  deliveryMode: "regional-window",
  gardenId: "founding-garden",
  snapshotVersion: 2_975_100,
  generatedAt: now,
  nextRefreshAt,
  regionSize: 16,
  worldBounds: { minX: -96, maxX: 63, minY: -96, maxY: 63 },
  mapBounds: { minX: -112, maxX: 79, minY: -112, maxY: 79 },
  regionBounds: { minX: -7, maxX: 4, minY: -7, maxY: 4 },
  regions,
  spawnPoints: [{ gridX: 62, gridY: 0 }],
};

const regionalWindow = {
  schemaVersion: 1,
  deliveryMode: "regional-window",
  gardenId: "founding-garden",
  snapshotVersion: manifest.snapshotVersion,
  generatedAt: now,
  nextRefreshAt,
  centerRegionX: 0,
  centerRegionY: 0,
  radius: 2,
  loadedRegionKeys: ["0:0"],
  plants: [
    {
      id: "map-rose",
      grid_x: 3,
      grid_y: 2,
      plant_type: "rose",
      planted_at: now,
      last_watered_at: null,
      created_at: now,
    },
  ],
  weeds: [],
};

const browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
const results = [];
for (const device of [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "desktop", width: 1440, height: 1000, touch: false },
]) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    hasTouch: device.touch,
    isMobile: device.touch,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("basil-onboarding-v1", "complete");
    window.localStorage.setItem("basil-onboarding-community-plantings-v1", "3");
    window.localStorage.setItem("basil-growing-edge-intro-v1", "seen");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/community-garden/regions/manifest**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifest) }),
  );
  await page.route("**/api/community-garden/regions/window**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(regionalWindow) }),
  );
  await page.route("**/api/community-garden/watering-status**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ checkedAt: now, readyPlantIds: [] }) }),
  );
  await page.route("**/api/community-garden/funnel", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.route("**/api/community-garden/health/pulse", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".cg-map-region").first().waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    regionCells: document.querySelectorAll(".cg-map-region").length,
    growingEdgeCells: document.querySelectorAll(
      ".cg-map-region.is-edge, .cg-map-region.is-growing, .cg-map-region.is-ready",
    ).length,
    lockedCells: document.querySelectorAll(
      ".cg-map-region.is-locked .cg-map-region-lock",
    ).length,
    playerVisible: Boolean(document.querySelector(".cg-map-player")),
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    errorOverlay: Boolean(document.querySelector("[data-nextjs-dialog]")),
  }));
  await page.screenshot({
    path: join(tmpdir(), `basil-growing-edge-${device.name}.png`),
    fullPage: true,
  });
  results.push({ ...device, ...result, errors });
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results));
if (
  results.some(
    (result) =>
      result.regionCells < 100 ||
      result.growingEdgeCells < 3 ||
      result.lockedCells < result.growingEdgeCells ||
      !result.playerVisible ||
      result.horizontalOverflow ||
      result.errorOverlay ||
      result.errors.length > 0,
  )
) {
  process.exitCode = 1;
}
