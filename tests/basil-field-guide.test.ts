import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const menuSource = await readFile(
  new URL("../app/community-garden/components/GardenMenu.tsx", import.meta.url),
  "utf8",
);
const guideSource = await readFile(
  new URL("../app/community-garden/components/GardenFieldGuide.tsx", import.meta.url),
  "utf8",
);
const playSource = await readFile(
  new URL("../app/community-garden/components/GardenGuide.tsx", import.meta.url),
  "utf8",
);
const plantSource = await readFile(
  new URL("../app/community-garden/components/PlantGlossary.tsx", import.meta.url),
  "utf8",
);

test("the Garden Library has four stable top-level destinations", () => {
  assert.match(menuSource, /"play" \| "guide" \| "account" \| "about"/);
  assert.match(menuSource, /label: "Field Guide"/);
  assert.doesNotMatch(menuSource, /label: "Elements"/);
  assert.doesNotMatch(menuSource, /label: "Plants"/);
});

test("sound controls live in a separate Settings surface", () => {
  assert.match(menuSource, /settingsOpen/);
  assert.match(menuSource, /Sound settings/);
  assert.match(menuSource, /cg-audio-settings is-standalone/);
});

test("Play is contextual and links into the complete reference", () => {
  assert.match(playSource, /COMMUNITY_ACTIONS/);
  assert.match(playSource, /PERSONAL_ACTIONS/);
  assert.match(playSource, /Open the complete Field Guide/);
  assert.match(playSource, /Builder Mode/);
  assert.match(playSource, /Share My Garden/);
});

test("the Field Guide covers every required shelf and is searchable", () => {
  for (const label of [
    "How to Play",
    "Community Garden",
    "My Garden",
    "Plant Encyclopedia",
    "Garden Catalog",
    "Progress & Collections",
  ]) {
    assert.match(guideSource, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.match(guideSource, /type="search"/);
  assert.match(guideSource, /useDeferredValue/);
  assert.match(guideSource, /MY_GARDEN_ELEMENTS/);
  assert.match(guideSource, /MY_GARDEN_COLLECTIONS/);
});

test("Heritage protection and all My Garden plants are represented", () => {
  assert.match(guideSource, /Rose<\/strong><span role="cell">14 days<\/span><span role="cell">28 days<\/span><span role="cell">56 days/);
  assert.match(guideSource, /Sunflower<\/strong><span role="cell">7 days<\/span><span role="cell">14 days<\/span><span role="cell">28 days/);
  assert.match(guideSource, /Lavender<\/strong><span role="cell">21 days<\/span><span role="cell">42 days<\/span><span role="cell">84 days/);
  assert.match(plantSource, /MY_GARDEN_PLANTS\.filter/);
  assert.match(plantSource, /Community Garden/);
  assert.match(plantSource, /Permanent · no maintenance/);
});
