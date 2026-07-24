import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  hashGardenPromoCode,
  normalizeGardenPromoCode,
} from "../lib/communityGarden/promoCode.ts";

const root = process.cwd();
const route = readFileSync(
  join(root, "app/api/community-garden/promo/route.ts"),
  "utf8",
);
const promoServer = readFileSync(
  join(root, "lib/communityGarden/promos.ts"),
  "utf8",
);
const offer = readFileSync(
  join(root, "app/community-garden/components/GardenMembershipOffer.tsx"),
  "utf8",
);

test("promo codes normalize without preserving display casing", () => {
  assert.equal(normalizeGardenPromoCode("  FriendGift  "), "friendgift");
  assert.equal(normalizeGardenPromoCode("friend gift"), null);
  assert.equal(normalizeGardenPromoCode("!gift!"), null);
  assert.equal(normalizeGardenPromoCode("abc"), null);
});

test("promo hashes are deterministic and one-way shaped", () => {
  const first = hashGardenPromoCode("friendgift");
  const second = hashGardenPromoCode("friendgift");
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, "friendgift");
});

test("database entitlement uniqueness is the durable one-use lock", () => {
  assert.match(promoServer, /provider_purchase_id: GIFT_PROVIDER_PURCHASE_ID/);
  assert.match(promoServer, /provider: "promo"/);
  assert.match(promoServer, /entitlementError\.code !== "23505"/);
  assert.match(promoServer, /claimGardenAccountEmailRequest/);
  assert.match(promoServer, /timingSafeEqual/);
  assert.match(promoServer, /importMyGardenPreview/);
});

test("gift access bypasses Stripe without manufacturing a purchase", () => {
  assert.doesNotMatch(
    route,
    /from ["']stripe["']|getStripe|trackBasilMeta|purchase_completed/,
  );
  assert.match(route, /createComplimentaryBasilAccount/);
  assert.match(route, /redeemGardenPromo/);
  assert.match(route, /account_exists/);
  assert.match(offer, /Have a gift code\?/);
  assert.match(offer, /A valid gift code skips checkout\./);
});

test("the raw private code is absent from application source", () => {
  assert.doesNotMatch(promoServer, /southpaw/i);
  assert.doesNotMatch(route, /southpaw/i);
  assert.doesNotMatch(offer, /southpaw/i);
});
