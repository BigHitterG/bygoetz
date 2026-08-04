"use client";

import { useEffect } from "react";
import { trackExplorersMetaEvent } from "@/lib/analytics/explorersMetaPixel";
import { EXPLORERS_DIGITAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";

type ExplorersDigitalMetaPurchaseTrackerProps = {
  eventId: string;
  sessionId: string;
  value: number;
  currency: string;
  productKeys: string[];
};

export function ExplorersDigitalMetaPurchaseTracker({
  eventId,
  sessionId,
  value,
  currency,
  productKeys,
}: ExplorersDigitalMetaPurchaseTrackerProps) {
  useEffect(() => {
    const storageKey = `explorers-meta-digital-purchase:${sessionId}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    const accepted = trackExplorersMetaEvent(
      "Purchase",
      {
        value,
        currency: currency.toUpperCase(),
        content_name: "The Explorers Series digital download",
        content_category: "Explorers digital download",
        content_type: productKeys.length > 1 ? "product_group" : "product",
        content_ids: productKeys,
        contents: productKeys.map((id) => ({ id, quantity: 1 })),
        num_items: productKeys.length,
        order_type: EXPLORERS_DIGITAL_ORDER_TYPE,
      },
      eventId,
    );
    if (accepted) window.sessionStorage.setItem(storageKey, "1");
  }, [currency, eventId, productKeys, sessionId, value]);

  return null;
}

