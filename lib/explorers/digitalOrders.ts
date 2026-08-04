­r‡^Ñf¥–Ø¦{ìyÊ'vÃ®¶›­import "server-only";

import type Stripe from "stripe";
import { isExplorersDigitalPurchaseEligible } from "@/lib/analytics/explorersMetaConversion";
import { sendExplorersDigitalPurchaseConversion } from "@/lib/analytics/explorersMetaServer";
import { fulfillDigitalDownloadCheckout } from "./fulfillDigitalDownload";

function getCustomerEmail(session: Stripe.Checkout.Session) {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

function getProductKeys(session: Stripe.Checkout.Session) {
  return (session.metadata?.digital_product_keys ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export async function processExplorerDigitalOrder(session: Stripe.Checkout.Session) {
  if (
    !isExplorersDigitalPurchaseEligible({
      orderType: session.metadata?.order_type,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    })
  ) {
    return {
      status: "skipped" as const,
      reason: "Checkout session is not an eligible paid USD Explorer digital order.",
    };
  }

  const productKeys = getProductKeys(session);
  if (productKeys.length === 0) {
    return { status: "skipped" as const, reason: "Digital product metadata is missing." };
  }

  const fulfillment = await fulfillDigitalDownloadCheckout(session);
  const sourceUrl =
    session.metadata?.meta_source_url ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bygoetz.com"}/explorers/digital-downloads`;
  const conversion = await sendExplorersDigitalPurchaseConversion({
    stripeSessionId: session.id,
    sourceUrl,
    value: (session.amount_total ?? 0) / 100,
    currency: session.currency ?? "usd",
    productKeys,
    email: getCustomerEmail(session),
    fbp: session.metadata?.meta_fbp,
    fbc: session.metadata?.meta_fbc,
  });

  return { status: "processed" as const, fulfillment, conversion };
}
