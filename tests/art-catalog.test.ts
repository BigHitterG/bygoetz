import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const catalog = readFileSync(new URL("../lib/art/catalog.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/art/types.ts", import.meta.url), "utf8");
const seriesRoute = readFileSync(
  new URL("../app/art/series/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const workRoute = readFileSync(
  new URL("../app/art/works/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

const publicDerivatives = [
  "../public/art/series/rebar-hands/overview.jpg",
  "../public/art/series/rebar-hands/form-detail.jpg",
  "../public/art/series/rebar-hands/weld-detail.jpg",
  "../public/art/series/rebar-hands/joint-detail.jpg",
  "../public/art/series/rebar-hands/cut-detail.jpg",
  "../public/art/series/process-sketches/horizontal-study.jpg",
  "../public/art/series/process-sketches/vertical-study.jpg",
  "../public/art/works/smiling-shell/context.jpg",
];

test("catalog separates media, series, individual artworks, and landing placement", () => {
  assert.match(types, /export type PublicArtMedia/);
  assert.match(types, /kind: "series"/);
  assert.match(types, /kind: "artwork"/);
  assert.match(catalog, /title: "Rebar Hands"/);
  assert.match(catalog, /title: "Process Sketches"/);
  assert.match(catalog, /title: "Smiling Shell"/);
  assert.match(catalog, /layout: "lead"/);
  assert.match(catalog, /layout: "single"/);
  assert.match(catalog, /layout: "pair"/);
});

test("public catalog contains confirmed facts but no private intake data", () => {
  assert.match(catalog, /medium: "Ink on paper"/);
  assert.match(catalog, /width: 8, height: 10/);
  assert.match(catalog, /width: 11, height: 14/);
  assert.doesNotMatch(catalog, /306-9753/);
  assert.doesNotMatch(catalog, /Keosauqua/);
  assert.doesNotMatch(catalog, /needs-signing|unsigned|sourcePath/);
  assert.doesNotMatch(catalog, /\$199|\$525/);
});

test("series and work routes are static-export safe", () => {
  for (const route of [seriesRoute, workRoute]) {
    assert.match(route, /export const dynamicParams = false/);
    assert.match(route, /generateStaticParams/);
    assert.match(route, /generateMetadata/);
    assert.match(route, /await params/);
    assert.match(route, /notFound\(\)/);
  }
  assert.match(sitemap, /artSeries\.map/);
  assert.match(sitemap, /artworks\.map/);
});

test("only lightweight sanitized derivatives enter the public catalog", () => {
  for (const relativePath of publicDerivatives) {
    const file = new URL(relativePath, import.meta.url);
    const stats = statSync(file);
    assert.ok(stats.size > 20_000, `${relativePath} should contain a usable image`);
    assert.ok(stats.size < 500_000, `${relativePath} should stay under 500 KB`);
  }
});

test("raw Artwork Inbox data stays outside the public build", () => {
  assert.match(gitignore, /^\/\.art-inbox\/$/m);
  const scanner = readFileSync(
    new URL("../scripts/art-inbox-scan.mjs", import.meta.url),
    "utf8",
  );
  assert.match(scanner, /\.art-inbox/);
  assert.match(scanner, /sha256/);
  assert.doesNotMatch(scanner, /public\/art/);
});
