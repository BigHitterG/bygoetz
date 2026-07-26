"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { getPlantDefinition } from "../lib/roseLifecycle";
import type { HeritageMoment } from "../lib/heritageNotifications";
import { GardenCatalogSprite } from "./GardenCatalogSprite";

type HeritageFlowerCelebrationProps = {
  moment: HeritageMoment | null;
  onClose: () => void;
  onVisit: () => void;
};

const CONFETTI_PIECES = [
  ["one", "8%", "-0.1s", "#ba383d"],
  ["two", "17%", "0.14s", "#e5b44f"],
  ["three", "29%", "0.02s", "#778f58"],
  ["four", "41%", "0.25s", "#fff4df"],
  ["five", "54%", "0.07s", "#ba383d"],
  ["six", "66%", "0.2s", "#e5b44f"],
  ["seven", "78%", "-0.03s", "#778f58"],
  ["eight", "91%", "0.28s", "#fff4df"],
] as const;

export function HeritageFlowerCelebration({
  moment,
  onClose,
  onVisit,
}: HeritageFlowerCelebrationProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moment) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moment, onClose]);

  if (!moment) return null;

  const flower = getPlantDefinition(moment.plantType);
  const planterMoment = moment.role === "planter";

  return (
    <div className="cg-unlock-backdrop" role="presentation">
      <div className="cg-unlock-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map(([id, left, delay, color]) => (
          <i
            key={id}
            style={{
              "--confetti-left": left,
              "--confetti-delay": delay,
              "--confetti-color": color,
            } as CSSProperties}
          />
        ))}
      </div>
      <section
        className="cg-unlock-card is-heritage-flower"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-heritage-flower-title"
        aria-describedby="cg-heritage-flower-description"
      >
        <button
          ref={closeButtonRef}
          className="cg-unlock-close"
          type="button"
          aria-label="Close Heritage Flower celebration"
          onClick={onClose}
        >
          X
        </button>
        <p className="cg-kicker">
          {planterMoment ? "Your garden legacy" : "Community care"}
        </p>
        <div className="cg-unlock-emblem is-heritage-flower" aria-hidden="true">
          <GardenCatalogSprite kind="plant" type={moment.plantType} />
          <span className="cg-heritage-celebration-star">*</span>
        </div>
        <h2 id="cg-heritage-flower-title">
          {planterMoment
            ? `Your ${flower.name} became Heritage`
            : `You helped a ${flower.name} become Heritage`}
        </h2>
        <p id="cg-heritage-flower-description">
          {planterMoment
            ? "Gardeners kept returning to care for this flower. It has taken root as a lasting landmark in Basil's shared garden."
            : "Your watering completed years of garden time in miniature: this flower has taken root as part of Basil's shared heritage."}
        </p>
        <small>
          {planterMoment
            ? "Planted by you · sustained by the community"
            : "Your care helped the shared garden endure"}
        </small>
        <div className="cg-unlock-actions">
          <button type="button" onClick={onVisit}>
            Visit flower
          </button>
          <button type="button" onClick={onClose}>
            Keep tending
          </button>
        </div>
      </section>
    </div>
  );
}
