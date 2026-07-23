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
      ["cottage", 250],
      ["pollinator", 750],
      ["water", 1_500],
    ],
  );
  assert.deepEqual(
    MY_GARDEN_COLLECTIONS.map((collection) => [
      collection.key,
      collection.completionLifetimeCareRequired,
    ]),
    [
      ["starter", 250],
      ["cottage", 750],
      ["pollinator", 1_500],
      ["water", 3_000],
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
      "../supabase/migrations/20260723143000_progressive_my_garden_unlocks.sql",
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
  const notices = getMyGardenUnlockNotices(249, 250);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.completedCollection?.key, "starter");
  assert.equal(notices[0]?.openedCollection?.key, "cottage");
  assert.deepEqual(notices[0]?.items.map((item) => item.name), ["Peony"]);
});

test("unread unlock count advances by milestones rather than every catalog row", () => {
  assert.equal(getMyGardenUnreadUnlockCount(0, 24), 0);
  assert.equal(getMyGardenUnreadUnlockCount(0, 25), 1);
  assert.equal(getMyGardenUnreadUnlockCount(25, 150), 5);
  assert.equal(getMyGardenUnreadUnlockCount(725, 750), 1);
});
