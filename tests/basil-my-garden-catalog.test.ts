import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MY_GARDEN_COLLECTIONS,
  MY_GARDEN_ELEMENTS,
  MY_GARDEN_PLANTS,
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
      ["cottage", 250],
      ["pollinator", 750],
      ["water", 1_500],
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

test("database seed contains every client catalog key and threshold", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260722234500_release_one_my_garden_catalog.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const plant of MY_GARDEN_PLANTS) {
    assert.ok(
      migration.includes(
        `('${plant.type}', '${plant.name}', '${plant.collection}', ${plant.lifetimeCareRequired}, ${plant.careCost},`,
      ),
      `missing exact database seed for ${plant.type}`,
    );
  }

  for (const element of MY_GARDEN_ELEMENTS) {
    assert.ok(
      migration.includes(
        `('${element.type}', '${element.name}', '${element.collection}', '${element.category}', ${element.lifetimeCareRequired}, ${element.careCost}, ${element.footprintWidth}, ${element.footprintHeight},`,
      ),
      `missing exact database seed for ${element.type}`,
    );
  }
});
