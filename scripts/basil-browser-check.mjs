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
  results.push({ ...device, ...result, errors });
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
      result.errors.length > 0,
  )
) {
  process.exitCode = 1;
}
