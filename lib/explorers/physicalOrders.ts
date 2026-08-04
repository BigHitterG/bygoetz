import "server-only";

import type Stripe from "stripe";
import { isExplorersPhysicalPurchaseEligible } from "@/lib/analytics/explorersMetaConversion";
import { sendExplorersPurchaseConversion } from "@/lib/analytics/explorersMetaServer";
import { EXPLORERS_PHYSICAL_ORDER_TYPE } from "./orderTypes";

function getCustomerEmail(session: Stripe.Checkout.Session) {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

export async function processExplorerPhysicalOrder(session: Stripe.Checkout.Session) {
  if (session.metadata?.order_type !== EXPLORERS_PHYSICAL_ORDER_TYPE) {
    return { status: "skipped" as const, reason: "Not an Explorers physical order." };
  }
  if (
    !isExplorersPhysicalPurchaseEligible({
      orderType: session.metadata.order_type,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    })
  ) {
    return {
      status: "skipped" as const,
      reason: "Checkout session is not an eligible paid USD Explorer order.",
    };
  }

  const artworkSlugs = (session.metadata.selected_slugs ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  const sourceUrl =
    session.metadata.meta_source_url ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bygoetz.com"}/explorers/build-a-set`;
  const conversion = await sendExplorersPurchaseConversion({
    stripeSessionId: session.id,
    sourceUrl,
    value: (session.amount_total ?? 0) / 100,
    currency: session.currency ?? "usd",
    artworkSlugs,
    optionId: session.metadata.print_option ?? "unknown",
    frameColor: session.metadata.frame_color ?? "none",
    email: getCustomerEmail(session),
    fbp: session.metadata.meta_fbp,
    fbc: session.metadata.meta_fbc,
  });
  return { status: "processed" as const, conversion };
}
