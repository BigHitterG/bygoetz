import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateLivingGardenHabitats,
  LIVING_GARDEN_DEFINITIONS,
  type LivingGardenElement,
  type LivingGardenPlant,
} from "../app/community-garden/lib/livingGarden.ts";

const plant = (
  plantType: LivingGardenPlant["plantType"],
  gridX: number,
  gridY: number,
): LivingGardenPlant => ({ plantType, gridX, gridY, id: `${plantType}-${gridX}-${gridY}` });
const element = (
  elementType: LivingGardenElement["elementType"],
  gridX: number,
  gridY: number,
): LivingGardenElement => ({ elementType, gridX, gridY, id: `${elementType}-${gridX}-${gridY}` });

test("all Living Garden discoveries have distinct collectible definitions", () => {
  assert.equal(LIVING_GARDEN_DEFINITIONS.length, 14);
  assert.equal(
    new Set(LIVING_GARDEN_DEFINITIONS.map((definition) => definition.key)).size,
    LIVING_GARDEN_DEFINITIONS.length,
  );
  for (const definition of LIVING_GARDEN_DEFINITIONS) {
    assert.ok(definition.clue.length > 20);
    assert.equal(definition.hints.length, 3);
    assert.ok(definition.recipe.length > 15);
    assert.equal(definition.sprite.pixels.length, 9);
    assert.ok(definition.sprite.pixels.every((row) => row.length === 11));
    assert.ok(
      definition.sprite.pixels.some((row) =>
        Array.from(row).some((colorKey) => Boolean(definition.sprite.palette[colorKey])),
      ),
    );
  }
  assert.equal(
    new Set(
      LIVING_GARDEN_DEFINITIONS.map((definition) =>
        JSON.stringify([definition.sprite.pixels, definition.sprite.palette]),
      ),
    ).size,
    LIVING_GARDEN_DEFINITIONS.length,
  );
});

test("starter birdhouse habitat activates and becomes dormant when flowers move away", () => {
  const birdhouse = [element("birdhouse", 4, 4)];
  const active = evaluateLivingGardenHabitats(
    [plant("rose", 4, 5), plant("sunflower", 5, 4), plant("lavender", 5, 5)],
    birdhouse,
  );
  assert.ok(active.some((habitat) => habitat.key === "garden_sparrow"));
  assert.equal(
    evaluateLivingGardenHabitats(
      [plant("rose", 20, 20), plant("sunflower", 21, 20), plant("lavender", 22, 20)],
      birdhouse,
    ).length,
    0,
  );
});

test("pollinator arrangements distinguish monarchs, honeybees, and bumblebees", () => {
  const habitats = evaluateLivingGardenHabitats(
    [
      plant("bee_balm", 2, 2),
      plant("lavender", 3, 2),
      plant("sunflower", 2, 3),
      plant("wildflowers", 3, 3),
    ],
    [
      element("beehive", 1, 1),
      element("butterfly_house", 5, 5),
      element("butterfly_bush", 6, 5),
    ],
  );
  const keys = new Set(habitats.map((habitat) => habitat.key));
  assert.ok(keys.has("honeybee"));
  assert.ok(keys.has("bumblebee"));
  assert.ok(keys.has("monarch_butterfly"));
});

test("a developed water corner supports both dragonfly and frog discoveries", () => {
  const habitats = evaluateLivingGardenHabitats([], [
    element("small_pond", 10, 10),
    element("reeds", 8, 10),
    element("reeds", 12, 10),
    element("lily_pads", 10, 8),
    element("lily_pads", 10, 12),
  ]);
  const keys = new Set(habitats.map((habitat) => habitat.key));
  assert.ok(keys.has("dragonfly"));
  assert.ok(keys.has("garden_frog"));
});

test("discovery persistence is private and service-mediated", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260730152006_add_living_garden_discoveries.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all.*authenticated/i);
  assert.match(migration, /grant all.*service_role/i);
  assert.match(migration, /primary key \(steward_id, habitat_key\)/i);
  assert.match(migration, /on delete cascade/i);
});

test("the house opens a separate Garden Journal while Inventory remains placeable items", () => {
  const canvas = readFileSync(
    new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
    "utf8",
  );
  const guide = readFileSync(
    new URL("../app/community-garden/components/GardenFieldGuide.tsx", import.meta.url),
    "utf8",
  );
  const creature = readFileSync(
    new URL("../app/community-garden/components/LivingGardenCreature.tsx", import.meta.url),
    "utf8",
  );
  assert.match(canvas, /onOpenGardenJournal/);
  assert.match(canvas, /Opening your Garden Journal/);
  assert.match(guide, /Habitats & Visitors/);
  assert.match(guide, /Habitat currently dormant/);
  assert.match(guide, /Currently visiting/);
  assert.match(guide, /LivingGardenCreature/);
  assert.match(creature, /definition\.sprite\.pixels/);
  assert.match(creature, /shapeRendering="crispEdges"/);
});
