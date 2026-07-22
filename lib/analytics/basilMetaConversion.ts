import { createHash } from "node:crypto";
import {
  GARDEN_MEMBERSHIP_CURRENCY,
  GARDEN_MEMBERSHIP_PRICE_CENTS,
  GARDEN_MEMBERSHIP_PRICE_USD,
} from "../communityGarden/membershipConfig.ts";

const META_EVENT_ID_PATTERN = /^basil_purchase_[0-9a-f]{32}$/;

export type BasilLaunchAttribution = {
  first_arrival_at: string;
  meta_click_id: string | null;
};

type MetaUserData = {
  em: string[];
  external_id?: string[];
  fbc?: string;
};

export function isBasilMetaPurchaseEligible(input: {
  orderType?: string | null;
  paymentStatus?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}) {
  return (
    input.orderType === "basil_founding_gardener" &&
    input.paymentStatus === "paid" &&
    input.amountTotal === GARDEN_MEMBERSHIP_PRICE_CENTS &&
    input.currency === GARDEN_MEMBERSHIP_CURRENCY
  );
}

export function getBasilCheckoutMetaEventId(stripeSessionId: string) {
  return `basil_checkout_${createHash("sha256").update(stripeSessionId).digest("hex").slice(0, 32)}`;
}

export function getBasilPurchaseMetaEventId(stripeSessionId: string) {
  return `basil_purchase_${createHash("sha256").update(stripeSessionId).digest("hex").slice(0, 32)}`;
}

export function buildBasilMetaUserData(input: {
  email: string;
  launchSessionId?: string | null;
  attribution?: BasilLaunchAttribution | null;
}): MetaUserData {
  const normalizedEmail = input.email.trim().toLowerCase();
  const userData: MetaUserData = {
    em: [createHash("sha256").update(normalizedEmail).digest("hex")],
  };
  if (input.launchSessionId) {
    userData.external_id = [
      createHash("sha256").update(input.launchSessionId).digest("hex"),
    ];
  }
  if (input.attribution?.meta_click_id) {
    const arrival = Math.floor(Date.parse(input.attribution.first_arrival_at) / 1000);
    if (Number.isFinite(arrival)) {
      userData.fbc = `fb.1.${arrival}.${input.attribution.meta_click_id}`;
    }
  }
  return userData;
}

export function buildBasilPurchaseConversion(input: {
  eventId: string;
  eventTime: number;
  email: string;
  launchSessionId?: string | null;
  attribution?: BasilLaunchAttribution | null;
  sourceUrl: string;
}) {
  if (!META_EVENT_ID_PATTERN.test(input.eventId)) {
    throw new Error("Invalid Basil Meta Purchase event ID.");
  }
  return {
    event_name: "Purchase",
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.sourceUrl,
    user_data: buildBasilMetaUserData(input),
    custom_data: {
      value: GARDEN_MEMBERSHIP_PRICE_USD,
      currency: "USD",
      content_name: "Basil Garden Membership",
    },
  };
}
