import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts", "basil-social-studio", "wren-live-capture-check.png");
const baseUrl = "http://localhost:3011/community-garden/social-capture?scene=garden-composition&captureMode=live_gameplay";

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const runtimePackage = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", "playwright");
    if (existsSync(runtimePackage)) return require(runtimePackage);
    const pnpmDirectory = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules", ".pnpm");
    const packageDirectory = readdirSync(pnpmDirectory).find((name) => name.startsWith("playwright@"));
    if (!packageDirectory) throw new Error("Playwright is required to inspect Basil's social capture.");
    return require(join(pnpmDirectory, packageDirectory, "node_modules", "playwright"));
  }
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("The Basil development server stopped before inspection.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Timed out waiting for Basil's social capture route.");
}

const server = spawn(
  process.execPath,
  [resolve(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", "3011"],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
let browser;
try {
  await waitForServer(baseUrl, server);
  browser = await loadPlaywright().chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('[data-capture-ready="true"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__BASIL_SOCIAL_CAPTURE__), undefined, { timeout: 30_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const navigationLeaks = await page.evaluate(() => Array.from(document.querySelectorAll("body *"))
    .filter((element) => element.children.length === 0 && element.textContent?.trim() === "N")
    .filter((element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
    })
    .map((element) => ({ tag: element.tagName, className: element.className, html: element.outerHTML })));
  const pointStack = await page.evaluate(() => document.elementsFromPoint(38, 920).map((element) => ({
    tag: element.tagName,
    className: element.className,
    html: element.outerHTML.slice(0, 300),
  })));
  mkdirSync(resolve(root, "artifacts", "basil-social-studio"), { recursive: true });
  await page.screenshot({ path: output });
  console.log(JSON.stringify({ output, navigationLeaks, pointStack }, null, 2));
  if (navigationLeaks.length > 0) throw new Error("The clean social capture contains a visible north marker.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
