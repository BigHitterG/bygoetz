"use client";

import { useEffect, useRef } from "react";

type GardenWormDiscoveryProps = {
  open: boolean;
  onClose: () => void;
};

export function GardenWormDiscovery({
  open,
  onClose,
}: GardenWormDiscoveryProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="cg-unlock-backdrop" role="presentation">
      <section
        className="cg-unlock-card is-garden-worm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-garden-worm-title"
        aria-describedby="cg-garden-worm-description"
      >
        <button
          ref={closeButtonRef}
          className="cg-unlock-close"
          type="button"
          aria-label="Close Garden Worm message"
          onClick={onClose}
        >
          X
        </button>
        <p className="cg-kicker">Rare planting find</p>
        <div className="cg-unlock-emblem is-garden-worm" aria-hidden="true">
          <span className="cg-garden-worm-glyph" />
        </div>
        <h2 id="cg-garden-worm-title">You found a Garden Worm</h2>
        <p id="cg-garden-worm-description">
          A helpful earthworm surfaced while you planted. This rare find adds 2
          bonus Care to the Care you normally earn from planting.
        </p>
        <small>Rare planting bonus · about 1 in 64 plantings</small>
        <div className="cg-unlock-actions is-single">
          <button type="button" onClick={onClose}>
            Keep growing
          </button>
        </div>
      </section>
    </div>
  );
}
