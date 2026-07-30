"use client";

import { useEffect, useRef } from "react";

type GardenClearingReturnConfirmationProps = {
  careRefund: number;
  error: string;
  busy: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GardenClearingReturnConfirmation({
  careRefund,
  error,
  busy,
  open,
  onCancel,
  onConfirm,
}: GardenClearingReturnConfirmationProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="cg-unlock-backdrop"
      role="presentation"
      onPointerDown={() => {
        if (!busy) onCancel();
      }}
    >
      <section
        className="cg-unlock-card cg-expansion-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cg-return-clearing-title"
        aria-describedby="cg-return-clearing-description"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="cg-kicker">Reshape My Garden</p>
        <span className="cg-return-clearing-icon" aria-hidden="true" />
        <h2 id="cg-return-clearing-title">Return this clearing to the forest?</h2>
        <p id="cg-return-clearing-description">
          The land must be empty and your remaining garden must stay connected.
          Your original clearing can never be returned.
        </p>
        <p>
          {careRefund > 0
            ? `${careRefund.toLocaleString()} Care will be returned to you.`
            : "Previously opened land does not include a Care refund."}
        </p>
        {error ? <p className="cg-return-clearing-error" role="alert">{error}</p> : null}
        <div className="cg-unlock-actions">
          <button ref={cancelButtonRef} type="button" disabled={busy} onClick={onCancel}>
            Keep it
          </button>
          <button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "Returning..." : "Yes, return it"}
          </button>
        </div>
      </section>
    </div>
  );
}
