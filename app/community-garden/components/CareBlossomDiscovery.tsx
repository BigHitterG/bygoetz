"use client";

import { useEffect, useRef } from "react";
import { SPECIAL_WATERING_FLOWER_NAME } from "../lib/roseLifecycle";

type CareBlossomDiscoveryProps = {
  open: boolean;
  onClose: () => void;
};

export function CareBlossomDiscovery({
  open,
  onClose,
}: CareBlossomDiscoveryProps) {
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
        className="cg-unlock-card is-care-blossom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-care-blossom-title"
        aria-describedby="cg-care-blossom-description"
      >
        <button
          ref={closeButtonRef}
          className="cg-unlock-close"
          type="button"
          aria-label={`Close ${SPECIAL_WATERING_FLOWER_NAME} message`}
          onClick={onClose}
        >
          X
        </button>
        <p className="cg-kicker">Rare garden find</p>
        <div className="cg-unlock-emblem is-care-blossom" aria-hidden="true">
          <span className="cg-care-blossom-glyph">
            <i />
          </span>
        </div>
        <h2 id="cg-care-blossom-title">
          You found a {SPECIAL_WATERING_FLOWER_NAME}
        </h2>
        <p id="cg-care-blossom-description">
          This tiny white bloom appears beside a Care-ready flower from time to
          time. Watering it is worth 3 Care: the usual 1, plus 2 bonus Care.
        </p>
        <small>Look for white petals with a red center</small>
        <div className="cg-unlock-actions is-single">
          <button type="button" onClick={onClose}>
            Keep tending
          </button>
        </div>
      </section>
    </div>
  );
}
