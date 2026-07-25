"use client";

import { useEffect, useRef } from "react";

type GardenExpansionConfirmationProps = {
  careCost: number;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function GardenExpansionConfirmation({
  careCost,
  open,
  onCancel,
  onConfirm,
}: GardenExpansionConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="cg-unlock-backdrop" role="presentation" onPointerDown={onCancel}>
      <section
        className="cg-unlock-card cg-expansion-confirmation"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cg-expansion-confirmation-title"
        aria-describedby="cg-expansion-confirmation-description"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="cg-kicker">My Garden expansion</p>
        <span className="cg-expansion-confirmation-lock" aria-hidden="true" />
        <h2 id="cg-expansion-confirmation-title">Unlock this parcel?</h2>
        <p id="cg-expansion-confirmation-description">
          This will use <strong>{careCost.toLocaleString()} Care</strong> and
          permanently add this land to My Garden.
        </p>
        <div className="cg-unlock-actions">
          <button type="button" onClick={onCancel}>
            Not yet
          </button>
          <button ref={confirmButtonRef} type="button" onClick={onConfirm}>
            Yes, unlock it
          </button>
        </div>
      </section>
    </div>
  );
}
