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
const atlas = await readFile(
  new URL("../app/community-garden/components/CommunityAtlas.tsx", import.meta.url),
  "utf8",
);
const css = await readFile(
  new URL("../app/community-garden/community-garden.css", import.meta.url),
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

test("garden detail is optional so the persistent Care wallet is not repeated", () => {
  assert.match(dock, /gardenDetail\?: string/);
  assert.match(dock, /gardenDetail \? <small>{gardenDetail}<\/small> : null/);
});

test("My Garden owns its mini map and detailed map without changing worlds", () => {
  assert.match(app, /<GardenMapKey[\s\S]*ui={ui}/);
  assert.doesNotMatch(app, /onMap={[\s\S]{0,180}setWorld\("community"\)/);
  assert.match(map, /ui\.mode === "personal"[\s\S]*ui\.pathMapPoints\.map/);
  assert.match(map, /ui\.personalMapParcels\.map/);
  assert.match(atlas, /for \(const parcel of ui\.personalMapParcels\)/);
  assert.match(css, /\.cg-map-property-parcel\.has-fence-top/);
  assert.match(css, /\.cg-map-key\.is-personal \.cg-map-plant/);
  assert.match(atlas, /personalMap \? "My Garden Map" : "Community Atlas"/);
  assert.match(atlas, /!selectedPoint \|\| \(!personalMap && !selectedRegion\?\.isOpen\)/);
});

test("non-members always have a dock-aligned upgrade route in both gardens", () => {
  assert.match(app, /const showMembershipShortcut =\s*accountChecked &&\s*!memberGarden/);
  assert.match(app, /upgradeVisible={showMembershipShortcut}/);
  assert.match(dock, /className="cg-dock-upgrade"/);
  assert.match(dock, /Save My Garden/);
  assert.match(css, /\.cg-dock-upgrade {[\s\S]*right: 0;[\s\S]*bottom: calc\(100% \+ 7px\)/);
});

test("dock cards have equal fixed geometry and no backing rectangle", () => {
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.cg-controls-dock {[\s\S]*background: transparent;[\s\S]*pointer-events: none;/);
  assert.match(css, /\.cg-dock-button,[\s\S]*height: 74px;[\s\S]*border-radius: 11px;/);
  assert.match(dock, /className="cg-dock-icon-slot"/);
  assert.match(dock, /className="cg-dock-label"/);
});
