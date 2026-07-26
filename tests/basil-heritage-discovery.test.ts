import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  findNearbyHeritageFlower,
  HERITAGE_DISCOVERY_STORAGE_KEY,
  HERITAGE_GOLD_DARK,
  HERITAGE_GOLD_LIGHT,
} from "../app/community-garden/lib/heritageDiscovery.ts";
import type { PlantRecord } from "../app/community-garden/lib/roseLifecycle.ts";

function plant(
  id: string,
  gridX: number,
  gridY: number,
  heritageAt: string | null,
): PlantRecord {
  return {
    id,
    grid_x: gridX,
    grid_y: gridY,
    plant_type: "rose",
    planted_at: "2026-07-01T00:00:00.000Z",
    last_watered_at: "2026-07-25T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    heritage_at: heritageAt,
  };
}

test("a player encounters only the nearest Heritage Flower within walking range", () => {
  const nearby = plant(
    "22222222-2222-4222-8222-222222222222",
    3,
    2,
    "2026-07-25T12:00:00.000Z",
  );
  const encounter = findNearbyHeritageFlower(
    [
      plant("ordinary", 1, 1, null),
      plant("distant", 12, 12, "2026-07-25T12:00:00.000Z"),
      nearby,
    ],
    0,
    0,
  );

  assert.deepEqual(encounter, {
    plantId: nearby.id,
    plantType: "rose",
    gridX: 3,
    gridY: 2,
    becameHeritageAt: nearby.heritage_at,
  });
  assert.equal(findNearbyHeritageFlower([nearby], 20, 20), null);
});

test("Heritage discovery is one-time education backed by the canonical flag", () => {
  const app = readFileSync(
    new URL(
      "../app/community-garden/components/CommunityGardenApp.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const canvas = readFileSync(
    new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
    "utf8",
  );
  const discovery = readFileSync(
    new URL(
      "../app/community-garden/components/HeritageFlowerDiscovery.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const renderer = readFileSync(
    new URL("../app/community-garden/game/gardenRenderer.ts", import.meta.url),
    "utf8",
  );

  assert.equal(HERITAGE_DISCOVERY_STORAGE_KEY, "basil-heritage-flower-discovery-v1");
  assert.match(app, /claimFirstHeritageFlowerDiscovery/);
  assert.match(app, /heritageEncountersEnabled/);
  assert.match(canvas, /findNearbyHeritageFlower/);
  assert.match(discovery, /at least five days/);
  assert.match(discovery, /three different days from three different gardeners/);
  assert.match(renderer, /Boolean\(plant\.heritage_at\)/);
  assert.match(renderer, /HERITAGE_GOLD_DARK/);
  assert.match(renderer, /HERITAGE_GOLD_LIGHT/);
  assert.match(HERITAGE_GOLD_DARK, /^#[0-9a-f]{6}$/i);
  assert.match(HERITAGE_GOLD_LIGHT, /^#[0-9a-f]{6}$/i);
});
