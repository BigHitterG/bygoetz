import { createHash } from "node:crypto";
import { EXPLORERS_PHYSICAL_ORDER_TYPE } from "../explorers/orderTypes.ts";

const CHECKOUT_EVENT_ID_PATTERN = /^explorers_checkout_[0-9a-f]{32}$/;
const PURCHASE_EVENT_ID_PATTERN = /^explorers_purchase_[0-9a-f]{32}$/;

type ExplorersMetaUserData = {
  em?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

type ExplorersOrderConversionInput = {
  eventId: string;
  eventTime: number;
  sourceUrl: string;
  stripeSessionId: string;
  value: number;
  currency: string;
  artworkSlugs: string[];
  optionId: string;
  frameColor: string;
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export function getExplorersCheckoutMetaEventId(stripeSessionId: string) {
  return `explorers_checkout_${createHash("sha256").update(stripeSessionId).digest("hex").slice(0, 32)}`;
}

export function getExplorersPurchaseMetaEventId(stripeSessionId: string) {
  return `explorers_purchase_${createHash("sha256").update(stripeSessionId).digest("hex").slice(0, 32)}`;
}

export function isExplorersPhysicalPurchaseEligible(input: {
  orderType?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}) {
  return (
    input.orderType === EXPLORERS_PHYSICAL_ORDER_TYPE &&
    input.paymentStatus === "paid" &&
    typeof input.amountTotal === "number" &&
    input.amountTotal > 0 &&
    input.currency === "usd"
  );
}

export function buildExplorersMetaUserData(input: {
  email?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}): ExplorersMetaUserData {
  const userData: ExplorersMetaUserData = {};
  const normalizedEmail = input.email?.trim().toLowerCase();
  if (normalizedEmail) {
    userData.em = [createHash("sha256").update(normalizedEmail).digest("hex")];
  }
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  return userData;
}

function buildCustomData(input: ExplorersOrderConversionInput) {
  return {
    value: input.value,
    currency: input.currency.toUpperCase(),
    content_name: "The Explorers Series physical artwork",
    content_category: "Explorers physical artwork",
    content_type: "product_group",
    content_ids: input.artworkSlugs,
    contents: input.artworkSlugs.map((id) => ({ id, quantity: 1 })),
    num_items: input.artworkSlugs.length,
    print_option: input.optionId,
    frame_color: input.frameColor,
    order_type: EXPLORERS_PHYSICAL_ORDER_TYPE,
    order_id: input.stripeSessionId,
  };
}

export function buildExplorersInitiateCheckoutConversion(
  input: ExplorersOrderConversionInput,
) {
  if (!CHECKOUT_EVENT_ID_PATTERN.test(input.eventId)) {
    throw new Error("Invalid Explorers InitiateCheckout event ID.");
  }
  return {
    event_name: "InitiateCheckout",
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.sourceUrl,
    user_data: buildExplorersMetaUserData(input),
    custom_data: buildCustomData(input),
  };
}

export function buildExplorersPurchaseConversion(input: ExplorersOrderConversionInput) {
  if (!PURCHASE_EVENT_ID_PATTERN.test(input.eventId)) {
    throw new Error("Invalid Explorers Purchase event ID.");
  }
  return {
    event_name: "Purchase",
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.sourceUrl,
    user_data: buildExplorersMetaUserData(input),
    custom_data: buildCustomData(input),
  };
}
