import assert from "node:assert/strict";
import test from "node:test";
import {
  getBasilGameUrlForOrigin,
  getBasilOrigin,
  getBasilUrl,
  isAllowedBasilOrigin,
  isBasilHostname,
} from "../lib/communityGarden/urls.ts";

test("Basil has a dedicated canonical origin without changing ByGoetz", () => {
  assert.equal(getBasilOrigin(), "https://basilcommunitygarden.com");
  assert.equal(getBasilUrl("/community-garden/privacy"), "https://basilcommunitygarden.com/community-garden/privacy");
  assert.equal(getBasilGameUrlForOrigin("https://basilcommunitygarden.com"), "https://basilcommunitygarden.com/");
  assert.equal(getBasilGameUrlForOrigin("https://www.bygoetz.com"), "https://www.bygoetz.com/community-garden");
});

test("only Basil hostnames receive the root game rewrite", () => {
  assert.equal(isBasilHostname("basilcommunitygarden.com"), true);
  assert.equal(isBasilHostname("www.basilcommunitygarden.com"), true);
  assert.equal(isBasilHostname("www.bygoetz.com"), false);
  assert.equal(isBasilHostname("basilcommunitygarden.com.evil.example"), false);
});

test("production mutation origins are exact and reject open-redirect lookalikes", () => {
  assert.equal(isAllowedBasilOrigin("https://basilcommunitygarden.com"), true);
  assert.equal(isAllowedBasilOrigin("https://www.basilcommunitygarden.com"), true);
  assert.equal(isAllowedBasilOrigin("https://www.bygoetz.com"), true);
  assert.equal(isAllowedBasilOrigin("https://bygoetz.com"), true);
  assert.equal(isAllowedBasilOrigin("https://evil.example"), false);
  assert.equal(isAllowedBasilOrigin("https://basilcommunitygarden.com.evil.example"), false);
  assert.equal(isAllowedBasilOrigin("https://www.bygoetz.com@evil.example"), false);
  assert.equal(isAllowedBasilOrigin("javascript:alert(1)"), false);
});
