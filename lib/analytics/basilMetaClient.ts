"use client";

import { getBasilLaunchSessionId } from "@/app/community-garden/lib/launchFunnel";
import { GARDEN_MEMBERSHIP_PRICE_USD } from "@/lib/communityGarden/membershipConfig";
import { trackMetaCustomEvent, trackMetaEvent } from "./metaPixel";

export type BasilMetaMilestone =
  | "page_view"
  | "view_content"
  | "complete_registration"
  | "first_plant"
  | "community_tutorial_completed"
  | "my_garden_entered"
  | "paywall_viewed";

const PURCHASE_EVENT_ID_PATTERN = /^basil_purchase_[0-9a-f]{32}$/;

export function getBasilMetaEventId(milestone: BasilMetaMilestone) {
  return `basil_${milestone}_${getBasilLaunchSessionId().replaceAll("-", "")}`;
}

export function trackBasilMetaStandardEvent(
  eventName: "PageView" | "ViewContent" | "CompleteRegistration",
  milestone: BasilMetaMilestone,
  parameters?: Record<string, unknown>,
) {
  trackMetaEvent(eventName, parameters, getBasilMetaEventId(milestone));
}

export function trackBasilMetaCustomMilestone(
  eventName:
    | "BasilFirstPlant"
    | "BasilCommunityTutorialCompleted"
    | "BasilMyGardenEntered"
    | "BasilPaywallViewed",
  milestone: BasilMetaMilestone,
) {
  trackMetaCustomEvent(eventName, undefined, getBasilMetaEventId(milestone));
}

export function trackBasilMetaCheckout(eventId: string) {
  if (!/^basil_checkout_[0-9a-f]{32}$/.test(eventId)) return;
  trackMetaEvent(
    "InitiateCheckout",
    {
      value: GARDEN_MEMBERSHIP_PRICE_USD,
      currency: "USD",
      content_name: "Basil Garden Membership",
    },
    eventId,
  );
}

export function trackBasilMetaPurchase(eventId: string) {
  if (!PURCHASE_EVENT_ID_PATTERN.test(eventId)) return false;
  trackMetaEvent(
    "Purchase",
    {
      value: GARDEN_MEMBERSHIP_PRICE_USD,
      currency: "USD",
      content_name: "Basil Garden Membership",
    },
    eventId,
  );
  return true;
}
