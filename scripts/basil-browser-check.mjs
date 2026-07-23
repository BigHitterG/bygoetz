import { createRequire } from "node:module";
import { homedir } from "node:os";
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
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(750);
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
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

await browser.close();
console.log(JSON.stringify(results));
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
  )
) {
  process.exitCode = 1;
}
