"use client";

import { useEffect } from "react";
import { trackMetaEvent } from "@/lib/analytics/metaPixel";

type MetaPurchaseTrackerProps = {
  sessionId: string;
  value: number;
  currency: string;
  artworkSlugs: string[];
  optionId: string;
};

export function MetaPurchaseTracker({
  sessionId,
  value,
  currency,
  artworkSlugs,
  optionId,
}: MetaPurchaseTrackerProps) {
  useEffect(() => {
    const storageKey = `meta-purchase:${sessionId}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    trackMetaEvent("Purchase", {
      value,
      currency: currency.toUpperCase(),
      content_type: "product_group",
      content_ids: artworkSlugs,
      num_items: artworkSlugs.length,
      print_option: optionId,
    });
    window.sessionStorage.setItem(storageKey, "1");
  }, [artworkSlugs, currency, optionId, sessionId, value]);

  return null;
}

