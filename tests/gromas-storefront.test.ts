import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  gromasBook,
  gromasPaperbackBook,
  gromasPaperbackPurchase,
  gromasPurchase,
} from "../lib/gromas/storefront.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Lazy Grid exposes a Gromas bubble linked to the book page", () => {
  const honeycomb = read("components/HoneycombHome.tsx");

  assert.match(honeycomb, /const GROMAS_BUBBLE = \{ q: 0, r: -1 \}/);
  assert.match(honeycomb, /\[GROMAS_LINK_ID\]: "\/gromas"/);
  assert.match(honeycomb, /<a[\s\S]*href=\{withSiteBasePath\("\/gromas"\)\}/);
  assert.match(honeycomb, /aria-label="Open Gromas and the Gobbledygooks"/);
  assert.match(
    honeycomb,
    /useState\(\s*baseBubbleSize \?\? DEFAULT_CONFIG\.baseBubbleSize/,
  );
});

test("the storefront uses the locked v3 publication details", () => {
  assert.equal(gromasBook.title, "Gromas and the Gobbledygooks");
  assert.deepEqual(gromasBook.authors, [
    "Thomas Raymond Goetz",
    "William James Pahos",
  ]);
  assert.equal(gromasBook.pageCount, 32);
  assert.equal(gromasBook.trimSize, "6 × 9 inches");
  assert.equal(gromasBook.format, "Hardcover casewrap");
});

test("the storefront exposes the verified Lulu Bookstore purchase", () => {
  const page = read("app/gromas/page.tsx");

  assert.equal(gromasPurchase.status, "available");
  assert.equal(gromasPurchase.channel, "Lulu Bookstore");
  assert.equal(gromasPurchase.displayPrice, "$34.99");
  assert.equal(
    gromasPurchase.url,
    "https://www.lulu.com/shop/thomas-raymond-goetz-and-william-james-pahos/gromas-and-the-gobbledygooks/hardcover/product-w4gmred.html",
  );
  assert.match(page, /Secure checkout and print-on-demand fulfillment through Lulu/);
  assert.match(page, /ISBN \{gromasBook\.isbn\}/);
  assert.match(page, /rel="noopener noreferrer"/);
});

test("the storefront exposes the premium paperback Lulu purchase", () => {
  const page = read("app/gromas/page.tsx");

  assert.equal(gromasPaperbackPurchase.status, "available");
  assert.equal(gromasPaperbackPurchase.channel, "Lulu Bookstore");
  assert.equal(gromasPaperbackPurchase.displayPrice, "$16.99");
  assert.equal(
    gromasPaperbackPurchase.url,
    "https://www.lulu.com/shop/thomas-raymond-goetz-and-william-james-pahos/gromas-and-the-gobbledygooks/paperback/product-7kzp65m.html",
  );
  assert.equal(gromasPaperbackBook.isbn, "978-0-557-96628-8");
  assert.equal(gromasPaperbackBook.format, "Paperback perfect bound");
  assert.match(page, /Choose a book format/);
  assert.match(page, /Buy \{label\}/);
});

