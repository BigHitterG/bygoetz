import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type {
  GardenRegionManifest,
  GardenRegionSummary,
} from "../app/community-garden/lib/supabaseGarden.ts";
import {
  getCommunityRegionKeyForCell,
  isTutorialPlantingRegionAvailable,
} from "../app/community-garden/lib/tutorialPlanting.ts";

const openSquareMigration = await readFile(
  new URL(
    "../supabase/migrations/20260803200751_allow_planting_in_open_crowded_regions.sql",
    import.meta.url,
  ),
  "utf8",
);

function region(
  overrides: Partial<GardenRegionSummary> = {},
): GardenRegionSummary {
  return {
    regionKey: "0:0",
    regionX: 0,
    regionY: 0,
    bounds: { minX: 0, maxX: 15, minY: 0, maxY: 15 },
    publicStage: "garden",
    pressureState: "healthy",
    supportLevel: 0,
    isOpen: true,
    newlyOpened: false,
    plantCount: 40,
    plantCapacity: 180,
    heritagePlantCount: 0,
    weedCount: 0,
    occupancyPercent: 22.2,
    guidanceZone: "garden",
    ...overrides,
  };
}

function manifest(candidate: GardenRegionSummary): GardenRegionManifest {
  return {
    snapshotVersion: 1,
    generatedAt: "2026-08-03T19:00:00.000Z",
    nextRefreshAt: "2026-08-03T19:10:00.000Z",
    regionSize: 16,
    worldBounds: { minX: -96, maxX: 63, minY: -96, maxY: 63 },
    mapBounds: { minX: -112, maxX: 79, minY: -112, maxY: 79 },
    regions: [candidate],
    zonePlan: null,
    spawnPoints: [{ gridX: 8, gridY: 8 }],
  };
}

test("tutorial planting accepts an open healthy region with capacity headroom", () => {
  assert.equal(
    isTutorialPlantingRegionAvailable(manifest(region()), new Set(), 8, 8),
    true,
  );
});

test("tutorial planting rejects busy, resting, closed, and locally blocked regions", () => {
  assert.equal(
    isTutorialPlantingRegionAvailable(
      manifest(region({ pressureState: "busy", plantCount: 140 })),
      new Set(),
      8,
      8,
    ),
    false,
  );
  assert.equal(
    isTutorialPlantingRegionAvailable(
      manifest(region({ pressureState: "resting", plantCount: 180 })),
      new Set(),
      8,
      8,
    ),
    false,
  );
  assert.equal(
    isTutorialPlantingRegionAvailable(
      manifest(region({ isOpen: false })),
      new Set(),
      8,
      8,
    ),
    false,
  );
  assert.equal(
    isTutorialPlantingRegionAvailable(
      manifest(region()),
      new Set(["0:0"]),
      8,
      8,
    ),
    false,
  );
});

test("negative coordinates map to the same floor-based regions as the server", () => {
  assert.equal(getCommunityRegionKeyForCell(-1, -1, 16), "-1:-1");
  assert.equal(getCommunityRegionKeyForCell(-16, -16, 16), "-1:-1");
  assert.equal(getCommunityRegionKeyForCell(-17, -17, 16), "-2:-2");
});

test("the database accepts empty tiles in crowded open regions", () => {
  assert.match(
    openSquareMigration,
    /create or replace function public\.enforce_community_garden_plant_insert_v1/,
  );
  assert.doesNotMatch(openSquareMigration, /existing_plant_count|region_capacity/);
  assert.doesNotMatch(openSquareMigration, /This patch is resting/);
  assert.match(openSquareMigration, /target_land_state = 'fallow'/);
  assert.match(openSquareMigration, /Pull this weed before planting here/);
});
