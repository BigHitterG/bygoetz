import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../app/art/page.tsx", import.meta.url), "utf8");
const carousel = readFileSync(
  new URL("../app/art/ArtHeroCarousel.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/art/page.module.css", import.meta.url),
  "utf8",
);

test("art landing has a focused identity, portrait, and art-first arrival", () => {
  assert.match(page, /alternates: \{ canonical: "\/art" \}/);
  assert.match(page, /Thomas Raymond Goetz/);
  assert.match(page, /Structure, instinct, and the worlds between\./);
  assert.match(page, /src=\{portrait\}/);
  assert.match(page, /<ArtHeroCarousel \/>/);
});

test("art landing exposes every professional destination without a role gate", () => {
  for (const anchor of ["works", "studio", "available", "portfolio", "about", "contact"]) {
    assert.match(page, new RegExp(`href="#${anchor}"`));
  }
  assert.match(page, /Request current availability/);
  assert.match(page, /Request gallery materials/);
  assert.doesNotMatch(page, /Are you a (visitor|collector|gallery)/i);
});

test("carousel is controllable and respects reduced motion and mobile", () => {
  assert.match(carousel, /Show previous studio image/);
  assert.match(carousel, /Show next studio image/);
  assert.match(carousel, /prefers-reduced-motion: reduce/);
  assert.match(carousel, /max-width: 760px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.carouselPause,[\s\S]*\.carouselProgress \{[\s\S]*display: none;/);
});

test("placeholder content is honest while the catalog is being assembled", () => {
  assert.match(page, /Individual records are being photographed and assembled\./);
  assert.match(page, /Catalog details forthcoming/);
  assert.doesNotMatch(page, /\$[0-9]/);
});
