import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildCommunityGardenRegionManifest,
  buildCommunityGardenRegionSnapshot,
  getCommunityGardenRegionBounds,
  getCommunityGardenRegionGridBounds,
  isFoundingGardenRegion,
} from "../lib/communityGarden/regionDelivery.ts";

function snapshot(version: number) {
  return {
    version,
    generatedAt: "2026-07-25T18:00:00.000Z",
    nextRefreshAt: "2026-07-25T18:10:00.000Z",
    plants: [
      {
        id: "founding-northwest",
        grid_x: -96,
        grid_y: -96,
        plant_type: "rose",
        planted_at: "2026-07-20T18:00:00.000Z",
        last_watered_at: "2026-07-25T17:00:00.000Z",
        heritage_at: "2026-07-25T17:30:00.000Z",
      },
      {
        id: "origin",
        grid_x: 0,
        grid_y: 0,
        plant_type: "lavender",
        planted_at: "2026-07-25T17:00:00.000Z",
        last_watered_at: "2026-07-25T17:00:00.000Z",
        contributor_key: "must-not-leave-the-server",
      },
      {
        id: "founding-southeast",
        grid_x: 63,
        grid_y: 63,
        plant_type: "sunflower",
        planted_at: "2026-07-25T17:00:00.000Z",
        last_watered_at: "2026-07-25T17:00:00.000Z",
      },
    ],
    weeds: [
      {
        id: "weed-origin",
        grid_x: 1,
        grid_y: 1,
        spawned_at: "2026-07-25T17:00:00.000Z",
      },
    ],
    spawnPoints: [{ gridX: 2, gridY: 3 }],
  };
}

test("the fixed founding garden exposes a ten by ten regional manifest", () => {
  assert.deepEqual(getCommunityGardenRegionGridBounds(), {
    minX: -6,
    maxX: 3,
    minY: -6,
    maxY: 3,
  });
  assert.deepEqual(getCommunityGardenRegionBounds(-6, -6), {
    minX: -96,
    maxX: -81,
    minY: -96,
    maxY: -81,
  });

  const manifest = buildCommunityGardenRegionManifest(snapshot(2_975_001));
  assert.equal(manifest.deliveryMode, "compatibility-shadow");
  assert.equal(manifest.regions.length, 100);
  assert.equal(
    manifest.regions.reduce((sum, region) => sum + region.plantCount, 0),
    3,
  );
  assert.deepEqual(manifest.spawnPoints, [{ gridX: 2, gridY: 3 }]);
});

test("regional snapshots contain only their own plants and weeds", () => {
  const source = snapshot(2_975_002);
  const origin = buildCommunityGardenRegionSnapshot(source, 0, 0);
  assert.ok(origin);
  assert.equal(origin.regionKey, "0:0");
  assert.equal(origin.plantCount, 1);
  assert.equal(origin.weedCount, 1);
  assert.deepEqual(origin.plants.map((plant) => plant.id), ["origin"]);
  assert.deepEqual(origin.weeds.map((weed) => weed.id), ["weed-origin"]);
  assert.equal("contributor_key" in origin.plants[0], false);

  const northwest = buildCommunityGardenRegionSnapshot(source, -6, -6);
  assert.ok(northwest);
  assert.equal(northwest.heritagePlantCount, 1);
  assert.deepEqual(northwest.plants.map((plant) => plant.id), [
    "founding-northwest",
  ]);
});

test("unopened coordinates are rejected by the regional delivery foundation", () => {
  assert.equal(isFoundingGardenRegion(-6, 3), true);
  assert.equal(isFoundingGardenRegion(-7, 3), false);
  assert.equal(isFoundingGardenRegion(4, 3), false);
  assert.equal(buildCommunityGardenRegionSnapshot(snapshot(2_975_003), 4, 0), null);
});

test("the compatibility foundation does not switch the existing client endpoint", () => {
  const client = readFileSync(
    new URL("../app/community-garden/lib/supabaseGarden.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /\/api\/community-garden\/snapshot\?version=/);
  assert.doesNotMatch(client, /regions\/manifest/);
});
