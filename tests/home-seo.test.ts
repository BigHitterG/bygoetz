import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const honeycomb = readFileSync(
  new URL("../components/HoneycombHome.tsx", import.meta.url),
  "utf8",
);
const robots = readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

test("homepage metadata represents By Goetz and Thomas Raymond Goetz", () => {
  assert.doesNotMatch(layout, /Honeycomb Home|Apple Watch-style/);
  assert.match(layout, /applicationName: "By Goetz"/);
  assert.match(layout, /Art, Stories & Creative Worlds/);
  assert.match(layout, /Thomas Raymond Goetz/);
  assert.match(page, /alternates: \{ canonical: "\/" \}/);
  assert.match(page, /siteName: "By Goetz"/);
});

test("homepage exposes identity, crawlable project links, and structured data", () => {
  assert.match(honeycomb, /<h1 className=\{styles\.visuallyHidden\}>/);
  assert.match(honeycomb, /className=\{styles\.aboutLink\}/);
  assert.match(honeycomb, /src=\{thomasPortrait\}/);
  assert.match(honeycomb, /href=\{withSiteBasePath\("\/about"\)\}/);
  assert.match(honeycomb, /href=\{withSiteBasePath\("\/art"\)\}/);
  assert.match(honeycomb, /href=\{withSiteBasePath\("\/explorers"\)\}/);
  assert.match(honeycomb, /href=\{withSiteBasePath\("\/gromas"\)\}/);
  assert.match(honeycomb, /href=\{getBasilOrigin\(\)\}/);
  assert.match(page, /"@type": "WebSite"/);
  assert.match(page, /"@type": "Person"/);
  assert.match(page, /primaryImageOfPage/);
});

test("homepage keeps navigation inside the bubble system", () => {
  assert.doesNotMatch(honeycomb, /<summary>Explore<\/summary>|siteHeader|exploreMenu/);
  assert.match(honeycomb, /const ABOUT_BUBBLE = \{ q: 0, r: 1 \}/);
  assert.match(honeycomb, /const ART_BUBBLE = \{ q: 1, r: -1 \}/);
  assert.match(honeycomb, /\[ART_LINK_ID\]: "\/art"/);
  assert.match(honeycomb, /\[ABOUT_LINK_ID\]: "\/about"/);
});

test("search discovery endpoints include the public By Goetz pages", () => {
  assert.match(robots, /https:\/\/www\.bygoetz\.com\/sitemap\.xml/);
  assert.match(sitemap, /`\$\{siteUrl\}\/about`/);
  assert.match(sitemap, /`\$\{siteUrl\}\/art`/);
  assert.match(sitemap, /`\$\{siteUrl\}\/explorers`/);
  assert.match(sitemap, /`\$\{siteUrl\}\/gromas`/);
});
