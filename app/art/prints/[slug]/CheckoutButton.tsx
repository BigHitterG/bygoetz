"use client";

import { useId, useState } from "react";
import { withSiteBasePath } from "@/lib/sitePath";
import styles from "./page.module.css";

type CheckoutButtonProps = {
  slug: string;
  label: string;
  available: boolean;
};

export function CheckoutButton({ slug, label, available }: CheckoutButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();

  if (process.env.NEXT_PUBLIC_BASE_PATH && available) {
    return (
      <div>
        <a
          className={styles.commerceLink}
          href={`https://www.bygoetz.com/art/prints/${encodeURIComponent(slug)}`}
        >
          {label}
        </a>
        <p>Continue to the secure By Goetz shop.</p>
      </div>
    );
  }

  async function beginCheckout() {
    if (busy || !available) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        withSiteBasePath("/api/stripe/art-print/checkout"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, quantity: 1 }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Secure checkout could not be opened.");
      }

      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Secure checkout could not be opened.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={beginCheckout}
        disabled={busy || !available}
        aria-describedby={error ? errorId : undefined}
      >
        {available
          ? busy
            ? "Opening secure checkout…"
            : label
          : "Currently unavailable"}
      </button>
      <p aria-live="polite" id={errorId} role={error ? "alert" : undefined}>
        {error}
      </p>
    </div>
  );
}
