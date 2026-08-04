"use client";

import { useEffect } from "react";
import { trackExplorersMetaEvent } from "@/lib/analytics/explorersMetaPixel";
import { EXPLORERS_PHYSICAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";

type ExplorersMetaPurchaseTrackerProps = {
  eventId: string;
  sessionId: string;
  value: number;
  currency: string;
  artworkSlugs: string[];
  optionId: string;
};

export function ExplorersMetaPurchaseTracker({
  eventId,
  sessionId,
  value,
  currency,
  artworkSlugs,
  optionId,
}: ExplorersMetaPurchaseTrackerProps) {
  useEffect(() => {
    const storageKey = `explorers-meta-purchase:${sessionId}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    const accepted = trackExplorersMetaEvent(
      "Purchase",
      {
        value,
        currency: currency.toUpperCase(),
        content_type: "product_group",
        content_category: "Explorers physical artwork",
        content_ids: artworkSlugs,
        contents: artworkSlugs.map((id) => ({ id, quantity: 1 })),
        num_items: artworkSlugs.length,
        print_option: optionId,
        order_type: EXPLORERS_PHYSICAL_ORDER_TYPE,
      },
      eventId,
    );
    if (accepted) window.sessionStorage.setItem(storageKey, "1");
  }, [artworkSlugs, currency, eventId, optionId, sessionId, value]);

  return null;
}
