import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMyGardenElementGlyphClass } from "../app/community-garden/lib/myGardenCatalog.ts";

test("hedge, fern and log bench keep item-specific UI portraits", () => {
  assert.equal(
    getMyGardenElementGlyphClass("hedge"),
    "is-shrub is-item-hedge",
  );
  assert.equal(
    getMyGardenElementGlyphClass("fern"),
    "is-shrub is-item-fern",
  );
  assert.equal(
    getMyGardenElementGlyphClass("log_bench"),
    "is-bench is-item-log_bench",
  );

  const css = readFileSync(
    new URL("../app/community-garden/community-garden.css", import.meta.url),
    "utf8",
  );
  for (const type of ["hedge", "fern", "log_bench"]) {
    assert.match(css, new RegExp(`\\.cg-item-glyph\\.is-item-${type}::before`));
    assert.match(css, new RegExp(`\\.cg-item-glyph\\.is-item-${type}::after`));
  }
});

test("placed previews give hedge, fern and log bench distinct silhouettes", () => {
  const renderer = readFileSync(
    new URL(
      "../app/community-garden/game/gardenRenderer.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    renderer,
    /element\.elementType === "hedge"[\s\S]*?#3f5c3c[\s\S]*?fillRect\(-10, -12, 20, 14\)/,
  );
  assert.match(
    renderer,
    /element\.elementType === "fern"[\s\S]*?#405d42[\s\S]*?fillRect\(-1, -17, 2, 19\)/,
  );
  assert.match(
    renderer,
    /element\.elementType === "log_bench"[\s\S]*?#4f392d[\s\S]*?fillRect\(-19, -9, 38, 9\)/,
  );
  assert.doesNotMatch(
    renderer,
    /element\.elementType === "hedge" \|\|\s*element\.elementType === "fern"/,
  );
});
