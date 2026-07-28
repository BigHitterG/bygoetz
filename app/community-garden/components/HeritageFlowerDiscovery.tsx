"use client";

import { useEffect, useRef } from "react";
import type { HeritageFlowerEncounter } from "../lib/heritageDiscovery";
import { getPlantDefinition } from "../lib/roseLifecycle";
import { GardenCatalogSprite } from "./GardenCatalogSprite";

type HeritageFlowerDiscoveryProps = {
  encounter: HeritageFlowerEncounter | null;
  onClose: () => void;
  onOpenGuide: () => void;
};

export function HeritageFlowerDiscovery({
  encounter,
  onClose,
  onOpenGuide,
}: HeritageFlowerDiscoveryProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!encounter) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [encounter, onClose]);

  if (!encounter) return null;
  const flower = getPlantDefinition(encounter.plantType);

  return (
    <div className="cg-unlock-backdrop" role="presentation">
      <section
        className="cg-unlock-card is-heritage-flower is-discovery"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-heritage-discovery-title"
        aria-describedby="cg-heritage-discovery-description"
      >
        <button
          ref={closeButtonRef}
          className="cg-unlock-close"
          type="button"
          aria-label="Close Heritage Flower explanation"
          onClick={onClose}
        >
          X
        </button>
        <p className="cg-kicker">A lasting part of the shared garden</p>
        <div className="cg-unlock-emblem is-heritage-flower" aria-hidden="true">
          <GardenCatalogSprite
            kind="plant"
            type={encounter.plantType}
            heritage
          />
          <span className="cg-heritage-celebration-star">*</span>
        </div>
        <h2 id="cg-heritage-discovery-title">You found a Heritage {flower.name}</h2>
        <p id="cg-heritage-discovery-description">
          Its golden stem marks a flower the community kept alive together. It
          became Heritage after growing for at least five days and receiving
          care on three different days from three different gardeners in a
          thriving patch.
        </p>
        <small>
          Heritage Flowers remain as lasting landmarks in Basil&apos;s shared
          landscape.
        </small>
        <div className="cg-unlock-actions">
          <button type="button" onClick={onOpenGuide}>
            Read Field Guide
          </button>
          <button type="button" onClick={onClose}>
            Keep exploring
          </button>
        </div>
      </section>
    </div>
  );
}
