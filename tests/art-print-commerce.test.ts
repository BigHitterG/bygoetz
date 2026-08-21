import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const checkout = readFileSync(
  new URL("../app/api/stripe/art-print/checkout/route.ts", import.meta.url),
  "utf8",
);
const verification = readFileSync(
  new URL("../app/api/stripe/art-print/session/route.ts", import.meta.url),
  "utf8",
);
const checkoutStatus = readFileSync(
  new URL("../app/art/prints/[slug]/CheckoutStatus.tsx", import.meta.url),
  "utf8",
);
const fulfillment = readFileSync(
  new URL("../lib/art/physicalOrders.ts", import.meta.url),
  "utf8",
);
const orderTypes = readFileSync(
  new URL("../lib/art/orderTypes.ts", import.meta.url),
  "utf8",
);
const webhook = readFileSync(
  new URL("../app/api/stripe/webhook/route.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260821005801_create_art_print_orders.sql",
    import.meta.url,
  ),
  "utf8",
);

test("art-print checkout uses a server allowlist and one fixed catalog price", () => {
  assert.match(checkout, /getArtPrint\(payload\.slug\)/);
  assert.match(checkout, /payload\.quantity !== 1/);
  assert.match(checkout, /print\.availability !== "available"/);
  assert.match(checkout, /unit_amount: print\.unitAmount/);
  assert.match(checkout, /quantity: 1/);
  assert.doesNotMatch(checkout, /payload\.(unitAmount|price|currency)/);
});

test("hosted Checkout collects US shipping with dynamic payment methods", () => {
  assert.match(checkout, /checkout\.sessions\.create/);
  assert.match(checkout, /shipping_address_collection: \{ allowed_countries: \["US"\] \}/);
  assert.match(checkout, /ART_PRINT_SHIPPING_RATE_ID/);
  assert.match(checkout, /ART_PRINT_SHIPPING_CENTS/);
  assert.match(checkout, /DEFAULT_SHIPPING_CENTS = 800/);
  assert.doesNotMatch(checkout, /payment_method_types/);
  assert.match(checkout, /integration_identifier: ART_PRINT_INTEGRATION_IDENTIFIER/);
  assert.match(checkout, /art_print_checkout_[a-z]{8}/);
});

test("automatic tax is enabled after the active US/Iowa registration was verified", () => {
  assert.match(checkout, /verified active US\/Iowa tax registration/);
  assert.match(checkout, /automatic_tax: \{ enabled: true \}/);
  assert.match(checkout, /tax_code: "txcd_99999999"/);
  assert.doesNotMatch(checkout, /tax_rates|default_tax_rates/);
});

test("webhook fulfillment shares the art-print order type and is idempotent", () => {
  assert.match(orderTypes, /ART_PRINT_ORDER_TYPE = "art_print_physical"/);
  assert.match(webhook, /session\.metadata\?\.order_type === ART_PRINT_ORDER_TYPE/);
  assert.match(webhook, /processArtPrintOrder\(session\)/);
  assert.match(fulfillment, /session\.payment_status !== "paid"/);
  assert.match(fulfillment, /session\.amount_subtotal !== expectedSubtotal/);
  assert.match(fulfillment, /\.insert\(\{/);
  assert.match(fulfillment, /insertError\?\.code === "23505"/);
  assert.match(fulfillment, /\.eq\("stripe_session_id", session\.id\)/);
  assert.doesNotMatch(fulfillment, /\.upsert\(/);
  assert.match(fulfillment, /art-print-customer-\$\{session\.id\}/);
  assert.match(fulfillment, /art-print-owner-\$\{session\.id\}/);
});

test("webhook replays cannot reset an order that has progressed past paid", () => {
  const insertAt = fulfillment.indexOf('.insert({');
  const duplicateAt = fulfillment.indexOf('insertError?.code === "23505"');
  const existingReadAt = fulfillment.indexOf('.eq("stripe_session_id", session.id)');

  assert.ok(insertAt >= 0 && duplicateAt > insertAt && existingReadAt > duplicateAt);
  assert.equal(
    fulfillment.slice(duplicateAt, existingReadAt).includes("fulfillment_status"),
    false,
  );
});

test("private order ledger exposes no customer rows and keeps one row per session", () => {
  assert.match(migration, /stripe_session_id text not null unique/);
  assert.match(migration, /alter table public\.art_print_orders enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.art_print_orders from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.art_print_orders to service_role/,
  );
  assert.doesNotMatch(migration, /create policy/i);
});

test("success verification returns payment state without buyer details", () => {
  assert.match(verification, /checkout\.sessions\.retrieve\(sessionId\)/);
  assert.match(verification, /session\.payment_status === "paid"/);
  assert.match(verification, /private, no-store/);
  assert.doesNotMatch(verification, /customer_(details|email)|shipping/);
});

test("the product page verifies Stripe success before showing confirmation", () => {
  assert.match(checkoutStatus, /checkout !== "success"/);
  assert.match(checkoutStatus, /\/api\/stripe\/art-print\/session\?session_id=/);
  assert.match(checkoutStatus, /result\.slug !== slug/);
  assert.match(checkoutStatus, /Order received\. Your payment is confirmed/);
  assert.match(checkoutStatus, /Checkout canceled\. Nothing was charged/);
  assert.doesNotMatch(checkoutStatus, /customer_(details|email)|shipping/);
});

test("the GitHub Pages copy sends buyers to the canonical Vercel commerce host", () => {
  const checkoutButton = readFileSync(
    new URL("../app/art/prints/[slug]/CheckoutButton.tsx", import.meta.url),
    "utf8",
  );

  assert.match(checkoutButton, /process\.env\.NEXT_PUBLIC_BASE_PATH/);
  assert.match(checkoutButton, /https:\/\/www\.bygoetz\.com\/art\/prints\//);
});

test("email outages cannot erase or fail a recorded paid order", () => {
  const recordAt = fulfillment.indexOf('.from("art_print_orders")');
  const notifyAt = fulfillment.indexOf("sendNotification({");
  assert.ok(recordAt >= 0 && notifyAt > recordAt);
  assert.match(fulfillment, /notification bookkeeping[\s\S]*must not make Stripe retry/);
  assert.match(fulfillment, /notificationUpdateError[\s\S]*console\.error/);
});
