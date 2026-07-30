import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the honeycomb exposes a duck bubble linked to the pond app", () => {
  const honeycomb = read("components/HoneycombHome.tsx");

  assert.match(honeycomb, /const DUCK_POND_BUBBLE = \{ q: 0, r: 1 \}/);
  assert.match(honeycomb, /\[DUCK_POND_LINK_ID\]: "\/duck-pond"/);
  assert.match(honeycomb, /aria-label="Open the Duck Pond"/);
});

test("the pond reacts to pointer movement and returns to the grid", () => {
  const pond = read("app/duck-pond/DuckPond.tsx");

  assert.match(pond, /distance < radius/);
  assert.match(pond, /onPointerMove/);
  assert.match(pond, /withSiteBasePath\("\/"\)/);
});
