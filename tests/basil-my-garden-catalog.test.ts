import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MY_GARDEN_COLLECTIONS,
  MY_GARDEN_ELEMENTS,
  MY_GARDEN_PLANTS,
  getMyGardenUnlockNotices,
  getMyGardenUnreadUnlockCount,
  getMyGardenElement,
  isMyGardenCatalogEntryUnlocked,
} from "../app/community-garden/lib/myGardenCatalog.ts";

test("Release 1 collection thresholds match the approved progression", () => {
  assert.deepEqual(
    MY_GARDEN_COLLECTIONS.map((collection) => [
      collection.key,
      collection.lifetimeCareRequired,
    ]),
    [
      ["starter", 0],
      ["cottage", 500],
      ["pollinator", 3_750],
      ["water", 12_500],
    ],
  );
  assert.deepEqual(
    MY_GARDEN_COLLECTIONS.map((collection) => [
      collection.key,
      collection.completionLifetimeCareRequired,
    ]),
    [
      ["starter", 500],
      ["cottage", 3_750],
      ["pollinator", 12_500],
      ["water", 50_000],
    ],
  );
});

test("catalog keys are unique and every entry has a valid cost and footprint", () => {
  const types = [
    ...MY_GARDEN_PLANTS.map((plant) => plant.type),
    ...MY_GARDEN_ELEMENTS.map((element) => element.type),
  ];
  assert.equal(new Set(types).size, types.length);

  for (const plant of MY_GARDEN_PLANTS) {
    assert.ok(plant.careCost > 0);
    assert.equal(
      isMyGardenCatalogEntryUnlocked(
        plant,
        plant.lifetimeCareRequired,
      ),
      true,
    );
  }

  for (const element of MY_GARDEN_ELEMENTS) {
    assert.ok(element.careCost > 0);
    assert.ok(element.footprintWidth >= 1);
    assert.ok(element.footprintHeight >= 1);
    assert.equal(getMyGardenElement(element.type), element);
  }
});

test("Release 1 includes meaningful multi-tile Water Garden landmarks", () => {
  assert.deepEqual(
    {
      fountain: [
        getMyGardenElement("fountain").footprintWidth,
        getMyGardenElement("fountain").footprintHeight,
      ],
      pond: [
        getMyGardenElement("small_pond").footprintWidth,
        getMyGardenElement("small_pond").footprintHeight,
      ],
    },
    {
      fountain: [2, 2],
      pond: [3, 2],
    },
  );
});

test("placement prices use the approved quarter-scale economy", () => {
  assert.deepEqual(
    Object.fromEntries(
      MY_GARDEN_PLANTS.map((plant) => [plant.type, plant.careCost]),
    ),
    {
      rose: 1,
      sunflower: 1,
      lavender: 1,
      daisy: 1,
      tulip: 1,
      wildflowers: 1,
      peony: 1,
      bee_balm: 1,
    },
  );
  assert.deepEqual(
    Object.fromEntries(
      MY_GARDEN_ELEMENTS.map((element) => [element.type, element.careCost]),
    ),
    {
      stone_paver: 1,
      gravel_tile: 1,
      brick_paver: 1,
      clay_pot: 1,
      hedge: 1,
      birdhouse: 2,
      bench: 3,
      fern: 6,
      hydrangea: 10,
      wheelbarrow: 12,
      wooden_planter: 20,
      bird_feeder: 25,
      rustic_bench: 30,
      trellis: 50,
      butterfly_bush: 15,
      pollinator_sign: 25,
      butterfly_house: 40,
      beehive: 60,
      rose_trellis: 100,
      reeds: 3,
      lily_pads: 4,
      birdbath: 60,
      stone_basin: 125,
      willow_tree: 200,
      fountain: 375,
      small_pond: 625,
    },
  );
});

test("progressive migration contains every client catalog threshold", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260725005701_quarter_scale_care_progression.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const plantCostStart = migration.indexOf("care_cost = case plant_type");
  const elementCostStart = migration.indexOf("care_cost = case element_type");
  const plantCostSection = migration.slice(
    plantCostStart,
    migration.indexOf("updated_at = now()", plantCostStart),
  );
  const elementCostSection = migration.slice(
    elementCostStart,
    migration.indexOf("updated_at = now()", elementCostStart),
  );

  for (const plant of MY_GARDEN_PLANTS) {
    assert.ok(
      migration.includes(
        `when '${plant.type}' then ${plant.lifetimeCareRequired}`,
      ),
      `missing progressive database threshold for ${plant.type}`,
    );
    assert.ok(
      plantCostSection.includes(`when '${plant.type}' then ${plant.careCost}`),
      `missing quarter-scale database cost for ${plant.type}`,
    );
  }

  for (const element of MY_GARDEN_ELEMENTS) {
    assert.ok(
      migration.includes(
        `when '${element.type}' then ${element.lifetimeCareRequired}`,
      ),
      `missing progressive database threshold for ${element.type}`,
    );
    assert.ok(
      elementCostSection.includes(
        `when '${element.type}' then ${element.careCost}`,
      ),
      `missing quarter-scale database cost for ${element.type}`,
    );
  }
});

test("unlock notices group collection moments with the first item in the next collection", () => {
  const notices = getMyGardenUnlockNotices(499, 500);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.completedCollection?.key, "starter");
  assert.equal(notices[0]?.openedCollection?.key, "cottage");
  assert.deepEqual(notices[0]?.items.map((item) => item.name), ["Peony"]);
});

test("unread unlock count advances by milestones rather than every catalog row", () => {
  assert.equal(getMyGardenUnreadUnlockCount(0, 24), 0);
  assert.equal(getMyGardenUnreadUnlockCount(0, 25), 1);
  assert.equal(getMyGardenUnreadUnlockCount(25, 400), 6);
  assert.equal(getMyGardenUnreadUnlockCount(3_250, 3_750), 1);
});
