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
    /<Image[\s\S]*className=\{styles\.gardenPreview\}[\s\S]*src=\{basilIcon\}[\s\S]*alt="Basil Community Garden seedling"/,
  );
});

test("LazyGrid previews appear quickly for every featured bubble", () => {
  assert.match(honeycomb, /const FOCUS_OVERLAY_DELAY = 350;/);
  assert.match(honeycomb, /\[EXPLORERS_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[COMMUNITY_GARDEN_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[GROMAS_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[ART_BUBBLE_ID\]:/);
  assert.match(honeycomb, /\[ABOUT_BUBBLE_ID\]:/);
  assert.match(honeycomb, /kicker: "The Explorers Series"/);
  assert.match(honeycomb, /kicker: "Basil Community Garden"/);
  assert.match(honeycomb, /kicker: "Gromas and the Gobbledygooks"/);
  assert.match(honeycomb, /kicker: "Original Artwork"/);
  assert.match(honeycomb, /kicker: "About Thomas Raymond Goetz"/);
});

test("the focused preview content is selected without changing tile routes", () => {
  assert.match(
    honeycomb,
    /setFocusOverlayBubbleId\(canShowOverlay \? targetBubbleId : null\)/,
  );
  assert.match(honeycomb, /\[EXPLORERS_LINK_ID\]: "\/explorers"/);
  assert.match(honeycomb, /\[COMMUNITY_GARDEN_LINK_ID\]: getBasilOrigin\(\)/);
  assert.match(honeycomb, /\[GROMAS_LINK_ID\]: "\/gromas"/);
  assert.match(honeycomb, /\[ART_LINK_ID\]: "\/art"/);
  assert.match(honeycomb, /\[ABOUT_LINK_ID\]: "\/about"/);
});

test("Original Artwork has its own first-ring doorway and visual preview", () => {
  assert.match(honeycomb, /const ART_BUBBLE = \{ q: 1, r: -1 \}/);
  assert.match(
    honeycomb,
    /import artStudioScale from "\.\.\/public\/art\/studio-scale\.jpg";/,
  );
  assert.match(honeycomb, /className=\{styles\.artLink\}/);
  assert.match(honeycomb, /href=\{withSiteBasePath\("\/art"\)\}/);
  assert.match(honeycomb, /src=\{artStudioScale\}/);
});
