import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  const pnpmDirectory = join(
    homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
    ".pnpm",
  );
  const playwrightPackage = readdirSync(pnpmDirectory).find((name) =>
    name.startsWith("playwright@"),
  );
  if (!playwrightPackage) throw new Error("Playwright is not available for browser checks.");
  playwright = require(
    join(
      pnpmDirectory,
      playwrightPackage,
      "node_modules",
      "playwright",
    ),
  );
}

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3010/community-garden";
const cases = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "tablet-portrait", width: 820, height: 1180, touch: true },
  { name: "tablet-landscape", width: 1180, height: 820, touch: true },
  { name: "desktop", width: 1440, height: 1000, touch: false },
];
const inventoryPortraits = {
  stone_paver: "paver",
  gravel_tile: "paver",
  brick_paver: "paver",
  clay_pot: "pot",
  hedge: "shrub",
  birdhouse: "birdhouse",
  bench: "bench",
  fern: "shrub",
  hydrangea: "shrub",
  wheelbarrow: "tool",
  wooden_planter: "planter",
  bird_feeder: "feeder",
  rustic_bench: "bench",
  trellis: "trellis",
  butterfly_bush: "shrub",
  pollinator_sign: "sign",
  butterfly_house: "birdhouse",
  beehive: "hive",
  rose_trellis: "trellis",
  reeds: "reeds",
  lily_pads: "lily",
  birdbath: "basin",
  stone_basin: "basin",
  willow_tree: "tree",
  fountain: "fountain",
  small_pond: "pond",
};

const browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
const results = [];

for (const device of cases) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    hasTouch: device.touch,
    isMobile: device.name === "phone",
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("basil-onboarding-v1", "complete");
    window.localStorage.setItem("basil-onboarding-community-plantings-v1", "3");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (
      message.type() === "error" &&
      !text.includes("/_next/webpack-hmr")
    ) {
      errors.push(text);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".cg-game-frame").waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.waitForTimeout(750);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator(".cg-game-frame").waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await page.waitForTimeout(750);
  let inventoryModal = null;
  if (device.name === "phone") {
    const inventoryToggle = page.locator(".cg-inventory-toggle");
    const toggleDisabled = await inventoryToggle.isDisabled();
    await inventoryToggle.dispatchEvent("click");
    await page.waitForTimeout(150);
    inventoryModal = await page.locator(".cg-inventory").evaluate((inventory, toggleDisabled) => {
      const panel = inventory.querySelector(".cg-inventory-panel");
      const firstItem = inventory.querySelector(".cg-inventory-grid button");
      const panelBounds = panel?.getBoundingClientRect();
      return {
        open: inventory.classList.contains("is-open"),
        toggleDisabled,
        position: window.getComputedStyle(inventory).position,
        panelWidth: panelBounds?.width ?? 0,
        itemHeight: firstItem?.getBoundingClientRect().height ?? 0,
        itemFontSize: firstItem
          ? Number.parseFloat(window.getComputedStyle(firstItem).fontSize)
          : 0,
      };
    }, toggleDisabled);
    if (inventoryModal.open) {
      await page.locator(".cg-inventory-close").click();
    }
  }
  const result = await page.evaluate(() => ({
    title: document.title,
    bodyLength: document.body.innerText.trim().length,
    basilVisible: document.body.innerText.includes("BASIL"),
    inventoryVisible: document.body.innerText.toLowerCase().includes("inventory"),
    gardenControlVisible: document.body.innerText.toLowerCase().includes("my garden"),
    errorOverlay: Boolean(
      document.querySelector(
        "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
      ),
    ),
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  results.push({ ...device, ...result, inventoryModal, errors });
  await context.close();
}

const auditContext = await browser.newContext({
  viewport: { width: 900, height: 700 },
});
const auditPage = await auditContext.newPage();
await auditPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
const stylesheetUrls = await auditPage
  .locator('link[rel="stylesheet"]')
  .evaluateAll((links) => links.map((link) => link.href));
await auditPage.setContent(
  `<!doctype html><html><head>${stylesheetUrls
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("")}</head><body></body></html>`,
  { waitUntil: "load" },
);
const inventoryAudit = await auditPage.evaluate((portraits) => {
  document.body.innerHTML =
    '<main id="inventory-audit" style="padding:24px;background:#f5eddd;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;font:12px monospace"></main>';
  const root = document.querySelector("#inventory-audit");
  for (const [type, icon] of Object.entries(portraits)) {
    const card = document.createElement("div");
    card.style.cssText =
      "height:90px;border:2px solid #34231f;background:#fff8e9;display:grid;place-items:center;text-align:center;padding:8px";
    card.innerHTML = `<span class="cg-item-glyph is-${icon} is-item-${type}"></span><b>${type.replaceAll("_", " ")}</b>`;
    root.append(card);
  }
  const signatures = Object.fromEntries(
    Object.keys(portraits).map((type) => {
      const element = document.querySelector(`.is-item-${type}`);
      const signatureFor = (pseudo) => {
        const style = getComputedStyle(element, pseudo);
        return [
          style.background,
          style.backgroundColor,
          style.border,
          style.borderRadius,
          style.boxShadow,
          style.width,
          style.height,
          style.left,
          style.top,
          style.transform,
          style.display,
        ].join("|");
      };
      return [type, `${signatureFor("::before")}//${signatureFor("::after")}`];
    }),
  );
  const entries = Object.entries(signatures);
  return {
    count: entries.length,
    duplicatePortraits: entries
      .filter(([, signature], index) =>
        entries.some(
          ([, candidate], candidateIndex) =>
            candidateIndex < index && candidate === signature,
        ),
      )
      .map(([type]) => type),
  };
}, inventoryPortraits);
await auditPage.screenshot({
  path: join(tmpdir(), "basil-inventory-audit.png"),
  fullPage: true,
});
await auditContext.close();

await browser.close();
console.log(JSON.stringify({ viewports: results, inventoryAudit }));
if (
  results.some(
    (result) =>
      !result.basilVisible ||
      !result.inventoryVisible ||
      !result.gardenControlVisible ||
      result.errorOverlay ||
      (result.name === "phone" &&
        (!result.inventoryModal?.open ||
          result.inventoryModal.position !== "fixed" ||
          result.inventoryModal.panelWidth < 340 ||
          result.inventoryModal.itemHeight < 80 ||
          result.inventoryModal.itemFontSize < 10)) ||
      result.errors.length > 0,
  ) ||
  inventoryAudit.count !== Object.keys(inventoryPortraits).length ||
  inventoryAudit.duplicatePortraits.length > 0
) {
  process.exitCode = 1;
}
