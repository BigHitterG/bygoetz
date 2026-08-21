"use client";

import { useEffect, useState } from "react";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "./page.module.css";

type CheckoutState = "idle" | "cancelled" | "verifying" | "paid" | "pending" | "error";

type CheckoutStatusProps = {
  slug: string;
};

type VerificationResponse = {
  status?: "paid" | "pending";
  slug?: string;
};

function clearCheckoutParameters() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("checkout");
  cleanUrl.searchParams.delete("session_id");
  window.history.replaceState(null, "", cleanUrl);
}

export function CheckoutStatus({ slug }: CheckoutStatusProps) {
  const [state, setState] = useState<CheckoutState>("idle");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const checkout = parameters.get("checkout");

    if (checkout === "cancelled") {
      queueMicrotask(() => setState("cancelled"));
      clearCheckoutParameters();
      return;
    }

    if (checkout !== "success") return;

    const sessionId = parameters.get("session_id");
    if (!sessionId) {
      queueMicrotask(() => setState("error"));
      clearCheckoutParameters();
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => setState("verifying"));

    void fetch(
      withSiteBasePath(
        `/api/stripe/art-print/session?session_id=${encodeURIComponent(sessionId)}`,
      ),
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as VerificationResponse;
        if (!response.ok || result.slug !== slug || !result.status) {
          throw new Error("Checkout could not be verified.");
        }
        setState(result.status);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      })
      .finally(() => {
        if (!controller.signal.aborted) clearCheckoutParameters();
      });

    return () => controller.abort();
  }, [slug]);

  if (state === "idle") return null;

  const message =
    state === "cancelled"
      ? "Checkout canceled. Nothing was charged."
      : state === "verifying"
        ? "Confirming your Portland Sun order with Stripe…"
        : state === "paid"
          ? "Order received. Your payment is confirmed; Thomas will follow up when the print ships."
          : state === "pending"
            ? "Order received. Stripe is still confirming the payment; a receipt will follow when it clears."
            : "This page could not verify the checkout. Check your Stripe receipt or email info@bygoetz.com.";

  return (
    <aside
      className={styles.checkoutStatus}
      data-state={state}
      aria-live="polite"
      role={state === "error" ? "alert" : "status"}
    >
      <span>{state === "paid" ? "Thank you" : "Checkout"}</span>
      <p>{message}</p>
    </aside>
  );
}
