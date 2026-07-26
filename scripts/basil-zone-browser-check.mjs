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

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3010/community-garden";
const generatedAt = new Date().toISOString();
const nextRefreshAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const regions = [];

for (let regionY = -3; regionY <= 3; regionY += 1) {
  for (let regionX = -3; regionX <= 3; regionX += 1) {
    const locked = Math.abs(regionX) === 3 || Math.abs(regionY) === 3;
    const heart = !locked && Math.abs(regionX) <= 1 && Math.abs(regionY) <= 1;
    const ring = !locked && !heart && Math.abs(regionX) <= 2 && Math.abs(regionY) <= 2;
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
      publicStage: locked ? "edge" : "garden",
      supportLevel: locked ? 0 : 3,
      isOpen: !locked,
      newlyOpened: false,
      plantCount: heart ? 80 : ring ? 18 : 0,
      heritagePlantCount: heart ? 2 : 0,
      weedCount: 0,
      occupancyPercent: heart ? 31 : ring ? 7 : 0,
      guidanceZone: heart ? "heart" : ring ? "growth-ring" : null,
    });
  }
}

const manifest = {
  schemaVersion: 3,
  snapshotVersion: 123,
  generatedAt,
  nextRefreshAt,
  regionSize: 16,
  worldBounds: { minX: -48, maxX: 63, minY: -48, maxY: 63 },
  mapBounds: { minX: -48, maxX: 63, minY: -48, maxY: 63 },
  regions,
  zonePlan: {
    formulaVersion: 1,
    evaluatedOn: generatedAt.slice(0, 10),
    source: "daily-frontier",
    heartRegions: 9,
    growthRingRegions: 16,
  },
  spawnPoints: [{ gridX: 0, gridY: 0 }],
};

const browser = await playwright.chromium.launch({
  headless: true,
  channel: "msedge",
});
const results = [];

for (const device of [
  { name: "phone", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1440, height: 1000, isMobile: false },
]) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    isMobile: device.isMobile,
    hasTouch: device.isMobile,
  });
  await context.addInitScript(() => {
    localStorage.setItem("basil-onboarding-v1", "complete");
    localStorage.setItem("basil-onboarding-community-plantings-v1", "3");
    localStorage.setItem("basil-garden-zones-intro-v2", "seen");
  });
  await context.route("**/api/community-garden/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/regions/manifest")) {
      await route.fulfill({ json: manifest });
      return;
    }
    if (url.pathname.endsWith("/regions/window")) {
      const centerRegionX = Number(url.searchParams.get("centerX") ?? 0);
      const centerRegionY = Number(url.searchParams.get("centerY") ?? 0);
      const radius = Number(url.searchParams.get("radius") ?? 2);
      const loadedRegionKeys = regions
        .filter(
          (region) =>
            region.isOpen &&
            Math.abs(region.regionX - centerRegionX) <= radius &&
            Math.abs(region.regionY - centerRegionY) <= radius,
        )
        .map((region) => region.regionKey);
      await route.fulfill({
        json: {
          snapshotVersion: 123,
          generatedAt,
          nextRefreshAt,
          centerRegionX,
          centerRegionY,
          radius,
          loadedRegionKeys,
          plants: [],
          weeds: [],
        },
      });
      return;
    }
    if (url.pathname.endsWith("/snapshot")) {
      await route.fulfill({
        json: {
          version: 123,
          generatedAt,
          nextRefreshAt,
          plantCount: 0,
          plants: [],
          weeds: [],
          spawnPoints: [{ gridX: 0, gridY: 0 }],
        },
      });
      return;
    }
    if (url.pathname.endsWith("/watering-status")) {
      await route.fulfill({ json: { checkedAt: generatedAt, readyPlantIds: [] } });
      return;
    }
    await route.fulfill({ json: {} });
  });

  const page = await context.newPage();
  const browserErrors = [];
  const apiRequests = [];
  const failedResponses = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/community-garden/")) {
      apiRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) {
      browserErrors.push(message.text());
    }
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".cg-game-frame").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(3_000);

  const result = await page.evaluate(() => ({
    contentLength: document.body.innerText.trim().length,
    errorOverlay: Boolean(
      document.querySelector(
        "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
      ),
    ),
    heartCells: document.querySelectorAll(".cg-map-region.is-zone-heart").length,
    ringCells: document.querySelectorAll(".cg-map-region.is-zone-growth-ring").length,
    lockedCells: document.querySelectorAll(".cg-map-region.is-locked").length,
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    miniMapLabel:
      document.querySelector(".cg-mini-map")?.getAttribute("aria-label") ?? "",
  }));
  await page.screenshot({
    path: join(tmpdir(), `basil-zone-${device.name}.png`),
    fullPage: true,
  });
  results.push({ ...device, ...result, browserErrors, apiRequests, failedResponses });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results));

if (
  results.some(
    (result) =>
      result.contentLength === 0 ||
      result.errorOverlay ||
      result.heartCells === 0 ||
      result.ringCells === 0 ||
      result.lockedCells === 0 ||
      result.horizontalOverflow ||
      result.browserErrors.length > 0,
  )
) {
  process.exitCode = 1;
}
