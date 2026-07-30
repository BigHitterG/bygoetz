"use client";

import { useEffect, useRef } from "react";
import type { MyGardenParcel } from "@/lib/communityGarden/myGarden";

type GardenClearingReturnConfirmationProps = {
  careRefund: number;
  parcel: MyGardenParcel | null;
  contents: { plants: number; paths: number; items: number; total: number } | null;
  error: string;
  busy: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GardenClearingReturnConfirmation({
  careRefund,
  parcel,
  contents,
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
  const occupied = (contents?.total ?? 0) > 0;

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
          Selected {parcel?.width ?? 4} × {parcel?.height ?? 4} clearing
          {parcel ? ` at tiles ${parcel.minX}, ${parcel.minY}` : ""}. Your
          original clearing can never be returned, and the remaining garden
          must stay connected.
        </p>
        {contents ? (
          <div className={`cg-return-clearing-contents${occupied ? " is-occupied" : ""}`}>
            <strong>{occupied ? `Clear ${contents.total} things first` : "This clearing is empty"}</strong>
            <span>{contents.plants} flowers · {contents.paths} paths · {contents.items} items</span>
          </div>
        ) : null}
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
          <button type="button" disabled={busy || occupied} onClick={onConfirm}>
            {busy ? "Returning..." : "Yes, return it"}
          </button>
        </div>
      </section>
    </div>
  );
}
