import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../app/art/page.tsx", import.meta.url), "utf8");
const carousel = readFileSync(
  new URL("../app/art/ArtHeroCarousel.tsx", import.meta.url),
  "utf8",
);
const selectedWork = readFileSync(
  new URL("../app/art/_components/SelectedArtChapters.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/art/page.module.css", import.meta.url),
  "utf8",
);
const nextConfig = readFileSync(
  new URL("../next.config.ts", import.meta.url),
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
  assert.match(carousel, /max-width: 820px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.carouselPause,[\s\S]*\.carouselProgress \{[\s\S]*display: none;/);
});

test("selected work distinguishes bodies of work from individual artworks", () => {
  assert.match(page, /<SelectedArtChapters \/>/);
  assert.match(selectedWork, /Body of work \/ 01/);
  assert.match(selectedWork, /Individual work \/ 02/);
  assert.match(selectedWork, /Ongoing series \/ 03/);
  assert.match(selectedWork, /getMediaForTarget/);
  assert.doesNotMatch(selectedWork, /\$[0-9]/);
});

test("art imagery and controls remain bounded on smaller screens", () => {
  assert.match(styles, /\.studioHeroImage img \{[\s\S]*?height: auto;/);
  assert.match(styles, /\.explorersSection figure img \{[\s\S]*?height: auto;/);
  assert.match(styles, /\.portraitFrame \{[\s\S]*?height: clamp\(320px, 56svh, 500px\);/);
  assert.match(styles, /\.carousel \{[\s\S]*?height: clamp\(360px, 62svh, 560px\);/);
  assert.match(styles, /\.carouselControls button \{[\s\S]*?height: 44px;/);
  assert.match(styles, /\.carouselImage \{[\s\S]*?object-fit: contain;/);
  assert.match(styles, /\.workWide \.workImageFrame \{[\s\S]*?aspect-ratio: 1\.18;/);
});

test("production serves responsive image derivatives while static export stays compatible", () => {
  assert.match(nextConfig, /images: \{ unoptimized: isGitHubPagesBuild \}/);
});
