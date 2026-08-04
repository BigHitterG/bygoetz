import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildExplorersDigitalInitiateCheckoutConversion,
  buildExplorersDigitalPurchaseConversion,
  buildExplorersInitiateCheckoutConversion,
  buildExplorersPurchaseConversion,
  getExplorersDigitalCheckoutMetaEventId,
  getExplorersDigitalPurchaseMetaEventId,
  getExplorersCheckoutMetaEventId,
  getExplorersPurchaseMetaEventId,
  isExplorersDigitalPurchaseEligible,
  isExplorersPhysicalPurchaseEligible,
} from "../lib/analytics/explorersMetaConversion.ts";
import {
  EXPLORERS_DIGITAL_ORDER_TYPE,
  EXPLORERS_PHYSICAL_ORDER_TYPE,
} from "../lib/explorers/orderTypes.ts";

const order = {
  sourceUrl: "https://www.bygoetz.com/explorers/build-a-set?artwork=monkey",
  stripeSessionId: "cs_test_explorers_123",
  value: 91,
  currency: "usd",
  artworkSlugs: ["monkey"],
  optionId: "8x10-framed-mat",
  frameColor: "natural",
};

test("Explorer checkout and purchase IDs are isolated and deterministic", () => {
  const checkoutId = getExplorersCheckoutMetaEventId(order.stripeSessionId);
  const purchaseId = getExplorersPurchaseMetaEventId(order.stripeSessionId);
  assert.match(checkoutId, /^explorers_checkout_[0-9a-f]{32}$/);
  assert.match(purchaseId, /^explorers_purchase_[0-9a-f]{32}$/);
  assert.notEqual(checkoutId, purchaseId);
  assert.equal(getExplorersPurchaseMetaEventId(order.stripeSessionId), purchaseId);
  assert.equal(checkoutId.startsWith("basil_"), false);
  assert.equal(purchaseId.startsWith("basil_"), false);
});

test("only a paid physical Explorer order is Purchase-eligible", () => {
  const valid = {
    orderType: EXPLORERS_PHYSICAL_ORDER_TYPE,
    paymentStatus: "paid",
    amountTotal: 9100,
    currency: "usd",
  };
  assert.equal(isExplorersPhysicalPurchaseEligible(valid), true);
  assert.equal(isExplorersPhysicalPurchaseEligible({ ...valid, paymentStatus: "unpaid" }), false);
  assert.equal(isExplorersPhysicalPurchaseEligible({ ...valid, amountTotal: 0 }), false);
  assert.equal(isExplorersPhysicalPurchaseEligible({ ...valid, currency: "eur" }), false);
  assert.equal(
    isExplorersPhysicalPurchaseEligible({ ...valid, orderType: "basil_founding_gardener" }),
    false,
  );
});

test("digital checkout and purchase use dedicated IDs and eligibility", () => {
  const checkoutId = getExplorersDigitalCheckoutMetaEventId(order.stripeSessionId);
  const purchaseId = getExplorersDigitalPurchaseMetaEventId(order.stripeSessionId);
  assert.match(checkoutId, /^explorers_digital_checkout_[0-9a-f]{32}$/);
  assert.match(purchaseId, /^explorers_digital_purchase_[0-9a-f]{32}$/);
  assert.notEqual(checkoutId, purchaseId);
  assert.equal(
    isExplorersDigitalPurchaseEligible({
      orderType: EXPLORERS_DIGITAL_ORDER_TYPE,
      paymentStatus: "paid",
      amountTotal: 999,
      currency: "usd",
    }),
    true,
  );
  assert.equal(
    isExplorersDigitalPurchaseEligible({
      orderType: EXPLORERS_PHYSICAL_ORDER_TYPE,
      paymentStatus: "paid",
      amountTotal: 999,
      currency: "usd",
    }),
    false,
  );
});

test("Explorer CAPI payloads share order data without exposing raw email", () => {
  const checkout = buildExplorersInitiateCheckoutConversion({
    ...order,
    eventId: getExplorersCheckoutMetaEventId(order.stripeSessionId),
    eventTime: 1_790_000_000,
    fbp: "fb.1.1790000000.browser",
    clientIpAddress: "203.0.113.10",
    clientUserAgent: "test-agent",
  });
  const purchase = buildExplorersPurchaseConversion({
    ...order,
    eventId: getExplorersPurchaseMetaEventId(order.stripeSessionId),
    eventTime: 1_790_000_100,
    email: " Buyer@Example.com ",
    fbp: "fb.1.1790000000.browser",
  });
  assert.equal(checkout.event_name, "InitiateCheckout");
  assert.equal(purchase.event_name, "Purchase");
  assert.equal(purchase.custom_data.order_type, EXPLORERS_PHYSICAL_ORDER_TYPE);
  assert.deepEqual(purchase.custom_data.content_ids, ["monkey"]);
  assert.equal(purchase.custom_data.value, 91);
  assert.equal(JSON.stringify(purchase).includes("Buyer@Example.com"), false);
  assert.match(purchase.user_data.em![0], /^[0-9a-f]{64}$/);
});

test("digital CAPI payloads use digital product data without exposing raw email", () => {
  const digitalOrder = {
    sourceUrl: "https://www.bygoetz.com/explorers/digital-downloads",
    stripeSessionId: "cs_test_explorers_digital_123",
    value: 9.99,
    currency: "usd",
    productKeys: ["explorers-complete-bundle"],
  };
  const checkout = buildExplorersDigitalInitiateCheckoutConversion({
    ...digitalOrder,
    eventId: getExplorersDigitalCheckoutMetaEventId(digitalOrder.stripeSessionId),
    eventTime: 1_790_000_000,
  });
  const purchase = buildExplorersDigitalPurchaseConversion({
    ...digitalOrder,
    eventId: getExplorersDigitalPurchaseMetaEventId(digitalOrder.stripeSessionId),
    eventTime: 1_790_000_100,
    email: " DigitalBuyer@Example.com ",
  });
  assert.equal(checkout.event_name, "InitiateCheckout");
  assert.equal(purchase.event_name, "Purchase");
  assert.equal(purchase.custom_data.order_type, EXPLORERS_DIGITAL_ORDER_TYPE);
  assert.equal(purchase.custom_data.content_category, "Explorers digital download");
  assert.deepEqual(purchase.custom_data.content_ids, ["explorers-complete-bundle"]);
  assert.equal(JSON.stringify(purchase).includes("DigitalBuyer@Example.com"), false);
  assert.match(purchase.user_data.em![0], /^[0-9a-f]{64}$/);
});

test("Explorer routes use dedicated tracking while Basil files remain separately wired", () => {
  const explorerLayout = readFileSync(
    new URL("../app/explorers/layout.tsx", import.meta.url),
    "utf8",
  );
  const explorerPixel = readFileSync(
    new URL("../components/analytics/ExplorersMetaPixel.tsx", import.meta.url),
    "utf8",
  );
  const basilPixel = readFileSync(
    new URL("../components/analytics/MetaPixel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(explorerLayout, /ExplorersMetaPixel/);
  assert.match(explorerPixel, /NEXT_PUBLIC_EXPLORERS_META_PIXEL_ID/);
  assert.match(explorerPixel, /explorers-meta-pixel/);
  assert.doesNotMatch(explorerPixel, /trackBasilMeta/);
  assert.match(basilPixel, /NEXT_PUBLIC_META_PIXEL_ID/);
  assert.match(basilPixel, /isBasilGame/);
  assert.doesNotMatch(basilPixel, /EXPLORERS_META/);
});

test("physical checkout, success verification, and webhook share one Explorer order type", () => {
  const checkoutRoute = readFileSync(
    new URL("../app/api/stripe/explorers-set/checkout/route.ts", import.meta.url),
    "utf8",
  );
  const successPage = readFileSync(
    new URL("../app/explorers/build-a-set/success/page.tsx", import.meta.url),
    "utf8",
  );
  const webhookRoute = readFileSync(
    new URL("../app/api/stripe/webhook/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(checkoutRoute, /order_type: EXPLORERS_PHYSICAL_ORDER_TYPE/);
  assert.match(checkoutRoute, /sendExplorersInitiateCheckoutConversion/);
  assert.match(successPage, /order_type === EXPLORERS_PHYSICAL_ORDER_TYPE/);
  assert.match(webhookRoute, /processExplorerPhysicalOrder/);
  assert.match(webhookRoute, /session\.metadata\?\.order_type === GARDEN_STEWARD_ORDER_TYPE/);
});

test("digital checkout, fulfillment, success, and webhook share one Explorer order type", () => {
  const checkoutRoute = readFileSync(
    new URL("../app/api/stripe/explorers-digital/checkout/route.ts", import.meta.url),
    "utf8",
  );
  const successPage = readFileSync(
    new URL("../app/explorers/digital-downloads/success/page.tsx", import.meta.url),
    "utf8",
  );
  const fulfillment = readFileSync(
    new URL("../lib/explorers/fulfillDigitalDownload.ts", import.meta.url),
    "utf8",
  );
  const webhookRoute = readFileSync(
    new URL("../app/api/stripe/webhook/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(checkoutRoute, /order_type: EXPLORERS_DIGITAL_ORDER_TYPE/);
  assert.match(checkoutRoute, /sendExplorersDigitalInitiateCheckoutConversion/);
  assert.match(successPage, /ExplorersDigitalMetaPurchaseTracker/);
  assert.match(fulfillment, /session\.metadata\?\.digital_product_keys/);
  assert.match(webhookRoute, /processExplorerDigitalOrder/);
});

