import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const app = await readFile(
  new URL("../app/community-garden/components/CommunityGardenApp.tsx", import.meta.url),
  "utf8",
);
const dock = await readFile(
  new URL("../app/community-garden/components/GardenControlsDock.tsx", import.meta.url),
  "utf8",
);
const inventory = await readFile(
  new URL("../app/community-garden/components/GardenInventory.tsx", import.meta.url),
  "utf8",
);
const map = await readFile(
  new URL("../app/community-garden/components/GardenMapKey.tsx", import.meta.url),
  "utf8",
);

test("the primary dock keeps Map, Inventory, garden switch, and action in order", () => {
  const mapIndex = dock.indexOf('className="cg-dock-button is-map"');
  const inventoryIndex = dock.indexOf("is-inventory");
  const gardenIndex = dock.indexOf("is-garden");
  const actionIndex = dock.indexOf("cg-action-button");
  assert.ok(mapIndex >= 0);
  assert.ok(mapIndex < inventoryIndex);
  assert.ok(inventoryIndex < gardenIndex);
  assert.ok(gardenIndex < actionIndex);
});

test("legacy floating controls are replaced while their panels stay reusable", () => {
  assert.doesNotMatch(app, /className="cg-zoom-control"/);
  assert.match(app, /showToggle={false}/);
  assert.match(inventory, /showToggle \? \(/);
  assert.match(app, /showExpandButton={false}/);
  assert.match(map, /onExpandedChange/);
});

test("secondary Tasks, Share, and Bug controls share the top utility strip", () => {
  assert.match(app, /className="cg-garden-utilities"/);
  assert.match(app, /<GardenShare/);
  assert.match(app, /<GardenBugReporter/);
  assert.match(app, /className="cg-garden-tasks-button"/);
});
