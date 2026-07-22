import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBasilPurchaseConversion,
  getBasilCheckoutMetaEventId,
  getBasilPurchaseMetaEventId,
  isBasilMetaPurchaseEligible,
} from "../lib/analytics/basilMetaConversion.ts";

test("Basil checkout and purchase IDs are deterministic and purpose-specific", () => {
  const sessionId = "cs_test_basil_123";
  const checkoutId = getBasilCheckoutMetaEventId(sessionId);
  const purchaseId = getBasilPurchaseMetaEventId(sessionId);
  assert.match(checkoutId, /^basil_checkout_[0-9a-f]{32}$/);
  assert.match(purchaseId, /^basil_purchase_[0-9a-f]{32}$/);
  assert.equal(getBasilPurchaseMetaEventId(sessionId), purchaseId);
  assert.notEqual(checkoutId, purchaseId);
});

test("only an authoritative paid $6.99 Basil checkout is Purchase-eligible", () => {
  const valid = {
    orderType: "basil_founding_gardener",
    paymentStatus: "paid",
    amountTotal: 699,
    currency: "usd",
  };
  assert.equal(isBasilMetaPurchaseEligible(valid), true);
  assert.equal(isBasilMetaPurchaseEligible({ ...valid, paymentStatus: "unpaid" }), false);
  assert.equal(isBasilMetaPurchaseEligible({ ...valid, amountTotal: 0 }), false);
  assert.equal(isBasilMetaPurchaseEligible({ ...valid, currency: "eur" }), false);
  assert.equal(isBasilMetaPurchaseEligible({ ...valid, orderType: "explorers" }), false);
});

test("Purchase payload has exact value, shared ID, and no raw email", () => {
  const eventId = getBasilPurchaseMetaEventId("cs_test_basil_456");
  const payload = buildBasilPurchaseConversion({
    eventId,
    eventTime: 1_790_000_000,
    email: " Test@Example.com ",
    launchSessionId: "01234567-89ab-4def-8123-456789abcdef",
    attribution: {
      first_arrival_at: "2026-07-21T12:00:00.000Z",
      meta_click_id: "safe-click-id",
    },
    sourceUrl: "https://www.bygoetz.com/community-garden",
  });
  assert.equal(payload.event_name, "Purchase");
  assert.equal(payload.event_id, eventId);
  assert.deepEqual(payload.custom_data, {
    value: 6.99,
    currency: "USD",
    content_name: "Basil Garden Membership",
  });
  assert.equal(JSON.stringify(payload).includes("Test@Example.com"), false);
  assert.match(payload.user_data.em[0], /^[0-9a-f]{64}$/);
  assert.equal(payload.user_data.fbc, "fb.1.1784635200.safe-click-id");
});

test("invalid browser/server Purchase event IDs are rejected", () => {
  assert.throws(() =>
    buildBasilPurchaseConversion({
      eventId: "purchase-from-return-url",
      eventTime: 1,
      email: "test@example.com",
      sourceUrl: "https://www.bygoetz.com/community-garden",
    }),
  );
});
