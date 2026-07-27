import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findHeritageAuraAnchor,
  getHeritageAuraMultiplier,
} from "../app/community-garden/lib/heritageAura.ts";
import type { PlantRecord } from "../app/community-garden/lib/roseLifecycle.ts";

function plant(
  id: string,
  gridX: number,
  gridY: number,
  heritageAt: string | null = null,
): PlantRecord {
  return {
    id,
    grid_x: gridX,
    grid_y: gridY,
    plant_type: "rose",
    planted_at: "2026-07-01T00:00:00.000Z",
    last_watered_at: "2026-07-27T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    heritage_at: heritageAt,
  };
}

const heritage = plant(
  "heritage",
  10,
  10,
  "2026-07-27T00:00:00.000Z",
);

test("the nearest Heritage Flower gives one strongest non-stacking aura", () => {
  assert.equal(getHeritageAuraMultiplier([heritage], 11, 11), 4);
  assert.equal(getHeritageAuraMultiplier([heritage], 12, 10), 2);
  assert.equal(getHeritageAuraMultiplier([heritage], 13, 10), 1);

  const overlapping = plant(
    "second-heritage",
    14,
    10,
    "2026-07-27T01:00:00.000Z",
  );
  assert.equal(getHeritageAuraMultiplier([heritage, overlapping], 12, 10), 2);
  assert.equal(findHeritageAuraAnchor([heritage, overlapping], 11, 10)?.id, "heritage");
});

test("the release is lifetime-Care based and keeps collapse behavior out of scope", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260727194822_heritage_aura_and_basil_mastery.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const catalog = readFileSync(
    new URL("../app/community-garden/lib/myGardenCatalog.ts", import.meta.url),
    "utf8",
  );

  assert.match(catalog, /BASIL_LIFETIME_CARE_GOAL = 1_000_000/);
  assert.match(catalog, /name: "Basil Heritage Plant"[\s\S]*?careCost: 1/);
  assert.match(migration, /care_cost = 1/);
  assert.match(migration, /heritage_aura_multiplier in \(1, 2, 4\)/);
  assert.match(migration, /perform_idempotent_community_garden_action_v10/);
  assert.doesNotMatch(migration, /population collapse|world contraction|dormant region/i);
});

test("watering preserves canonical Heritage appearance and the forest is lightweight", () => {
  const canvas = readFileSync(
    new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
    "utf8",
  );
  const renderer = readFileSync(
    new URL("../app/community-garden/game/gardenRenderer.ts", import.meta.url),
    "utf8",
  );

  assert.match(canvas, /existing\?\.heritage_at && !candidate\.heritage_at/);
  assert.match(renderer, /function drawHeritageAura/);
  assert.match(renderer, /ctx\.fillStyle = "#234b35"/);
  assert.match(renderer, /x: Math\.round\(viewport\.width/);
});
