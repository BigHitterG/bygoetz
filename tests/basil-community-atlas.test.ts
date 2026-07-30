import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const atlas = readFileSync(
  new URL(
    "../app/community-garden/components/CommunityAtlas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const app = readFileSync(
  new URL(
    "../app/community-garden/components/CommunityGardenApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const map = readFileSync(
  new URL(
    "../app/community-garden/components/GardenMapKey.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("the Community Atlas supports regional inspection without loading the world", () => {
  assert.match(atlas, /Community Atlas/);
  assert.match(atlas, /ATLAS_ZOOMS = \[1, 2, 4\]/);
  assert.match(atlas, /useState<\(typeof ATLAS_ZOOMS\)\[number\]>\(1\)/);
  assert.match(atlas, /ATLAS_WINDOW_RADIUS = 3/);
  assert.match(atlas, /fetchGardenRegionWindow\([\s\S]+ui\.snapshotVersion,[\s\S]+ATLAS_WINDOW_RADIUS,/);
  assert.match(atlas, /Flowers load automatically at every zoom/);
  assert.match(atlas, /Promise\.allSettled\(/);
  assert.match(atlas, /const dot = zoom === 4 \? 7 : zoom === 2 \? 5 : 3/);
  assert.match(atlas, /Go here/);
});

test("account Heritage navigation opens and focuses the Atlas", () => {
  assert.match(app, /label: "your Heritage Flower"/);
  assert.match(app, /kind: "heritage"/);
  assert.match(app, /setAtlasTarget\(/);
  assert.match(atlas, /focusTarget\?\.kind === "heritage"/);
  assert.match(atlas, /const beaconSize = zoom === 4 \? 22 : zoom === 2 \? 18 : 14/);
  assert.match(map, /focusTarget/);
  assert.match(map, /requestId/);
  assert.match(map, /onNavigateGrid/);
});

test("weed actions use the actual weed glyph", () => {
  assert.match(app, /ui\.action === "weed"[\s\S]+cg-plant-glyph is-weed/);
});
