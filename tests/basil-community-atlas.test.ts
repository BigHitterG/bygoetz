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
  assert.match(atlas, /fetchGardenRegionWindow\([\s\S]+ui\.snapshotVersion,[\s\S]+0,/);
  assert.match(atlas, /Zoom closer to see individual flowers/);
  assert.match(atlas, /Go here/);
});

test("account Heritage navigation opens and focuses the Atlas", () => {
  assert.match(app, /label: "your Heritage Flower"/);
  assert.match(app, /setAtlasTarget\(/);
  assert.match(map, /focusTarget/);
  assert.match(map, /requestId/);
  assert.match(map, /onNavigateGrid/);
});

test("weed actions use the actual weed glyph", () => {
  assert.match(app, /ui\.action === "weed"[\s\S]+cg-plant-glyph is-weed/);
});
