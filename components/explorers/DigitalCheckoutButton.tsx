≠rá^—f•ñÿ¶{çly 'v√Æ∂õ≠"use client";

import { useState } from "react";
import {
  trackExplorersMetaCustomEvent,
  trackExplorersMetaEvent,
} from "@/lib/analytics/explorersMetaPixel";
import { EXPLORERS_DIGITAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";

type DigitalCheckoutButtonProps = {
  productKey: string;
  productTitle: string;
  value: number;
  className: string;
  children: React.ReactNode;
};

export function DigitalCheckoutButton({
  productKey,
  productTitle,
  value,
  className,
  children,
}: DigitalCheckoutButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function beginCheckout() {
    if (busy) return;
    setBusy(true);
    setError("");
    trackExplorersMetaCustomEvent("DigitalCheckoutRequested", {
      content_ids: [productKey],
      content_name: productTitle,
      content_category: "Explorers digital download",
      content_type: "product",
      currency: "USD",
      value,
    });

    try {
      const response = await fetch("/api/stripe/explorers-digital/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      const body = (await response.json()) as {
        url?: string;
        metaEventId?: string;
        error?: string;
      };
      if (!response.ok || !body.url || !body.metaEventId) {
        throw new Error(body.error ?? "Digital checkout could not be started.");
      }

      trackExplorersMetaEvent(
        "InitiateCheckout",
        {
          value,
          currency: "USD",
          content_name: productTitle,
          content_category: "Explorers digital download",
          content_type: "product",
          content_ids: [productKey],
          contents: [{ id: productKey, quantity: 1 }],
          num_items: 1,
          order_type: EXPLORERS_DIGITAL_ORDER_TYPE,
        },
        body.metaEventId,
      );
      window.location.assign(body.url);
    } catch (checkoutError) {
      const message =
        checkoutError instanceof Error
          ? checkoutError.message
          : "Digital checkout could not be started.";
      setError(message);
      setBusy(false);
      trackExplorersMetaCustomEvent("DigitalCheckoutError", {
        content_ids: [productKey],
        error_message: message.slice(0, 160),
      });
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={beginCheckout} disabled={busy}>
        {busy ? "Opening secure checkout‚Ä¶" : children}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
