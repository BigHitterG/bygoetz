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
      ["cottage", 2_000],
      ["pollinator", 15_000],
      ["water", 50_000],
    ],
  );
  assert.deepEqual(
    MY_GARDEN_COLLECTIONS.map((collection) => [
      collection.key,
      collection.completionLifetimeCareRequired,
    ]),
    [
      ["starter", 2_000],
      ["cottage", 15_000],
      ["pollinator", 50_000],
      ["water", 200_000],
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

test("progressive migration contains every client catalog threshold", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260724013000_uncapped_care_and_heritage_flowers.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const plant of MY_GARDEN_PLANTS) {
    assert.ok(
      migration.includes(
        `when '${plant.type}' then ${plant.lifetimeCareRequired}`,
      ),
      `missing progressive database threshold for ${plant.type}`,
    );
  }

  for (const element of MY_GARDEN_ELEMENTS) {
    assert.ok(
      migration.includes(
        `when '${element.type}' then ${element.lifetimeCareRequired}`,
      ),
      `missing progressive database threshold for ${element.type}`,
    );
  }
});

test("unlock notices group collection moments with the first item in the next collection", () => {
  const notices = getMyGardenUnlockNotices(1_999, 2_000);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.completedCollection?.key, "starter");
  assert.equal(notices[0]?.openedCollection?.key, "cottage");
  assert.deepEqual(notices[0]?.items.map((item) => item.name), ["Peony"]);
});

test("unread unlock count advances by milestones rather than every catalog row", () => {
  assert.equal(getMyGardenUnreadUnlockCount(0, 99), 0);
  assert.equal(getMyGardenUnreadUnlockCount(0, 100), 1);
  assert.equal(getMyGardenUnreadUnlockCount(100, 1_600), 6);
  assert.equal(getMyGardenUnreadUnlockCount(13_000, 15_000), 1);
});
