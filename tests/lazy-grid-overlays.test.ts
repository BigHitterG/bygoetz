import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const honeycomb = readFileSync(
  new URL("../components/HoneycombHome.tsx", import.meta.url),
  "utf8",
);

test("Basil tile reuses the canonical Community Garden plant icon", () => {
  assert.match(
    honeycomb,
    /import basilIcon from "\.\.\/public\/community-garden\/basil-icon-256\.png";/,
  );
  assert.match(
    honeycomb,
    /<Image[\s\S]*className=\{styles\.gardenPreview\}[\s\S]*src=\{basilIcon\}[\s\S]*alt=""/,
  );
});

test("LazyGrid previews appear quickly for every featured bubble", () => {
  assert.match(honeycomb, /const FOCUS_OVERLAY_DELAY = 350;/);
  assert.match(honeycomb, /\[EXPLORERS_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[COMMUNITY_GARDEN_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[GROMAS_BUBBLE_ID\]:/);
  assert.match(honeycomb, /kicker: "The Explorers Series"/);
  assert.match(honeycomb, /kicker: "Basil Community Garden"/);
  assert.match(honeycomb, /kicker: "Gromas and the Gobbledygooks"/);
});

test("the focused preview content is selected without changing tile routes", () => {
  assert.match(
    honeycomb,
    /setFocusOverlayBubbleId\(canShowOverlay \? targetBubbleId : null\)/,
  );
  assert.match(honeycomb, /\[EXPLORERS_LINK_ID\]: "\/explorers"/);
  assert.match(honeycomb, /\[COMMUNITY_GARDEN_LINK_ID\]: getBasilOrigin\(\)/);
  assert.match(honeycomb, /\[GROMAS_LINK_ID\]: "\/gromas"/);
});
