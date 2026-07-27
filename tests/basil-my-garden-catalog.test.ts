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

test("the complete collection ladder matches the approved progression", () => {
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
      ["woodland", 50_000],
      ["working", 125_000],
      ["heritage", 300_000],
      ["botanical", 625_000],
      ["basil", 1_000_000],
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
      ["woodland", 125_000],
      ["working", 300_000],
      ["heritage", 625_000],
      ["botanical", 1_000_000],
      ["basil", 1_000_000],
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
      woodland_shrub: 3,
      log_bench: 5,
      pine_tree: 13,
      maple_tree: 18,
      flowering_tree: 23,
      bonsai_tree: 30,
      grand_oak: 75,
      compost_bin: 5,
      potting_table: 12,
      raised_bed: 20,
      cold_frame: 30,
      garden_shed: 75,
      small_greenhouse: 150,
      topiary_arch: 60,
      pergola: 100,
      greenhouse_extension: 90,
      mosaic_fountain: 125,
      formal_pond: 165,
      conservatory: 375,
      grand_rose_pergola: 300,
      glass_pavilion: 625,
      botanical_glasshouse: 1_000,
      great_basil_topiary: 1,
    },
  );
});

test("database migrations contain every live client catalog threshold", () => {
  const quarterScaleMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260725012615_quarter_scale_care_progression.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const completeLadderMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260725040805_complete_basil_collection_ladder.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const heritageAuraMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260727194822_heritage_aura_and_basil_mastery.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const plantCostStart = quarterScaleMigration.indexOf(
    "care_cost = case plant_type",
  );
  const elementCostStart = quarterScaleMigration.indexOf(
    "care_cost = case element_type",
  );
  const plantCostSection = quarterScaleMigration.slice(
    plantCostStart,
    quarterScaleMigration.indexOf("updated_at = now()", plantCostStart),
  );
  const elementCostSection = quarterScaleMigration.slice(
    elementCostStart,
    quarterScaleMigration.indexOf("updated_at = now()", elementCostStart),
  );

  for (const plant of MY_GARDEN_PLANTS) {
    assert.ok(
      quarterScaleMigration.includes(
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
    if (element.lifetimeCareRequired < 50_000) {
      assert.ok(
        quarterScaleMigration.includes(
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
    } else {
      if (element.type === "great_basil_topiary") {
        assert.ok(
          completeLadderMigration.includes(
            `('${element.type}', 'Great Basil topiary', '${element.collection}'`,
          ),
          `missing original complete-ladder database row for ${element.type}`,
        );
        assert.match(heritageAuraMigration, /display_name = 'Basil Heritage Plant'/);
        assert.match(heritageAuraMigration, /care_cost = 1/);
        continue;
      }
      assert.ok(
        completeLadderMigration.includes(
          `('${element.type}', '${element.name}', '${element.collection}'`,
        ),
        `missing complete-ladder database row for ${element.type}`,
      );
      assert.ok(
        completeLadderMigration.includes(
          `${element.lifetimeCareRequired}, ${element.careCost}, ${element.footprintWidth}, ${element.footprintHeight}`,
        ),
        `missing complete-ladder values for ${element.type}`,
      );
    }
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

test("late collection moments remain visible through Basil I", () => {
  const woodland = getMyGardenUnlockNotices(49_999, 50_000);
  assert.equal(woodland[0]?.completedCollection?.key, "water");
  assert.equal(woodland[0]?.openedCollection?.key, "woodland");
  assert.deepEqual(woodland[0]?.items.map((item) => item.name), [
    "Woodland shrub",
  ]);

  const basil = getMyGardenUnlockNotices(999_999, 1_000_000);
  assert.equal(basil[0]?.completedCollection?.key, "botanical");
  assert.equal(basil[0]?.openedCollection?.key, "basil");
  assert.deepEqual(basil[0]?.items.map((item) => item.name), [
    "Basil Heritage Plant",
  ]);
});

test("owner progression preview is private and cannot place future items", () => {
  const inventorySource = readFileSync(
    new URL(
      "../app/community-garden/components/GardenInventory.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const accountRoute = readFileSync(
    new URL(
      "../app/api/community-garden/account/route.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(accountRoute, /isGardenAdmin\(user\)/);
  assert.match(inventorySource, /Owner progression preview/);
  assert.match(
    inventorySource,
    /Preview only\. Your Care, unlocks and saved garden never change\./,
  );
  assert.match(inventorySource, /if \(placeable\) onSelectElement/);
});
