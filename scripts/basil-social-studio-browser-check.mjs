import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts", "basil-social-studio");
mkdirSync(output, { recursive: true });

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const runtimePackage = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright");
    if (existsSync(runtimePackage)) return require(runtimePackage);
    const pnpmDirectory = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", ".pnpm");
    const packageDirectory = readdirSync(pnpmDirectory).find((name) => name.startsWith("playwright@"));
    if (!packageDirectory) throw new Error("Playwright is required for the Social Studio browser check.");
    return require(join(pnpmDirectory, packageDirectory, "node_modules", "playwright"));
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("The development server stopped during browser verification.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }
  throw new Error("Timed out waiting for the Social Studio development server.");
}

const baseUrl = "http://localhost:3011";
const server = spawn(process.execPath, [resolve(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3011"], {
  cwd: root,
  stdio: "ignore",
  windowsHide: true,
});
let browser;
try {
  await waitForServer(`${baseUrl}/community-garden/social-capture`, server);
  const playwright = loadPlaywright();
  browser = await playwright.chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("webpack-hmr")) errors.push(message.text());
  });

  await page.goto(`${baseUrl}/community-garden/social-capture`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__BASIL_SOCIAL_CAPTURE__));
  await page.evaluate(() => window.__BASIL_SOCIAL_CAPTURE__?.setTime(1.55));
  const capture = await page.evaluate(() => ({
    hasContent: document.body.innerText.trim().length > 0,
    hasOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
    dimensions: window.__BASIL_SOCIAL_CAPTURE__?.dimensions,
    time: document.querySelector("[data-capture-ready='true']")?.getAttribute("data-time"),
    taskProgress: document.body.innerText.includes("3 flowers cared for"),
  }));
  await page.screenshot({ path: resolve(output, "capture-mobile-check.png"), fullPage: true });

  await page.goto(`${baseUrl}/community-garden/social-studio?demo=1`, { waitUntil: "networkidle", timeout: 60_000 });
  const studio = await page.evaluate(() => ({
    hasContent: document.body.innerText.includes("Basil Social Studio"),
    hasOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
    approveAll: Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Approve all")),
    revision: Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Request revision")),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  await page.screenshot({ path: resolve(output, "studio-mobile-check.png"), fullPage: true });
  await context.close();

  if (!capture.hasContent || capture.hasOverlay || capture.dimensions?.width !== 1080 || capture.dimensions?.height !== 1920 || capture.time !== "1.550" || !capture.taskProgress) {
    throw new Error(`Capture verification failed: ${JSON.stringify(capture)}`);
  }
  if (!studio.hasContent || studio.hasOverlay || !studio.approveAll || !studio.revision || studio.horizontalOverflow) {
    throw new Error(`Studio verification failed: ${JSON.stringify(studio)}`);
  }
  if (errors.length) throw new Error(`Browser console errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ ok: true, capture, studio, errors }, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill();
}
