import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app = await readFile(
  new URL("../app/community-garden/components/CommunityGardenApp.tsx", import.meta.url),
  "utf8",
);
const hud = await readFile(
  new URL("../app/community-garden/components/GardenCareHud.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../app/community-garden/community-garden.css", import.meta.url),
  "utf8",
);

test("the main play screen always shows the current Care balance", () => {
  assert.match(app, /<GardenCareHud/);
  assert.match(app, /balance={myGarden\.careBalance}/);
  assert.match(app, /ready={accountChecked && guestPreviewReady}/);
  assert.match(app, /temporary={!memberGarden}/);
  assert.doesNotMatch(app, /accountChecked && guestPreviewReady \? \(\s*<GardenCareHud/);
});

test("the Care wallet turns positive balance changes into an earned receipt", () => {
  assert.match(hud, /previousBalanceRef/);
  assert.match(hud, /if \(!ready\)/);
  assert.match(hud, /if \(!readyRef\.current\)/);
  assert.match(hud, /if \(balance <= previousBalance\) return/);
  assert.match(hud, /amount: balance - previousBalance/);
  assert.match(hud, /\+{reward\.amount\.toLocaleString\(\)}/);
  assert.match(hud, /world === "community" \? "earned" : "returned"/);
  assert.match(hud, /role="status" aria-live="polite"/);
});

test("Care sits above the upper-right utilities without moving the minimap", () => {
  assert.match(css, /\.cg-care-hud {[\s\S]*top: max\(82px[\s\S]*right: max\(12px/);
  assert.match(css, /\.cg-care-hud {[\s\S]*pointer-events: none/);
  assert.match(css, /\.cg-care-hud\.is-rewarding/);
  assert.match(css, /@keyframes cg-care-wallet-pulse/);
  assert.match(css, /\.cg-garden-utilities {[\s\S]*top: max\(160px/);
  assert.doesNotMatch(css, /\.cg-map-key\s*{\s*top: max\(136px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cg-care-hud\.is-rewarding/);
});

test("the garden switcher does not repeat the Care balance", () => {
  assert.doesNotMatch(app, /gardenDetail={`Care \$\{myGarden\.careBalance\}`}/);
  assert.doesNotMatch(app, /Go to My Garden\. \$\{myGarden\.careBalance\} Care/);
  assert.doesNotMatch(app, /Go to Community Garden\. \$\{myGarden\.careBalance\} Care/);
});
