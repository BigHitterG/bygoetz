"use client";

import { useEffect, useRef } from "react";
import {
  getLivingGardenDefinition,
  type LivingGardenDiscovery,
} from "../lib/livingGarden";

type LivingGardenDiscoveryProps = {
  discovery: LivingGardenDiscovery | null;
  onClose: () => void;
  onWatch: () => void;
  onOpenGuide: () => void;
};

export function LivingGardenDiscoveryModal({
  discovery,
  onClose,
  onWatch,
  onOpenGuide,
}: LivingGardenDiscoveryProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!discovery) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [discovery, onClose]);

  if (!discovery) return null;
  const definition = getLivingGardenDefinition(discovery.habitatKey);

  return (
    <div className="cg-living-discovery-backdrop" role="presentation">
      <section
        className="cg-living-discovery-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="living-garden-discovery-title"
      >
        <button
          ref={closeRef}
          className="cg-living-discovery-close"
          type="button"
          aria-label="Close habitat discovery"
          onClick={onClose}
        >
          X
        </button>
        <p className="cg-kicker">Living Garden discovery</p>
        <div className={`cg-living-glyph is-${definition.visitorKind}`} aria-hidden="true">
          {definition.glyph}
        </div>
        <h2 id="living-garden-discovery-title">{definition.discoveryTitle}</h2>
        <h3>{definition.name}</h3>
        <p>{definition.discoveryCopy}</p>
        <small>{definition.recipe}</small>
        <div className="cg-living-discovery-actions">
          <button type="button" onClick={onWatch}>Watch habitat</button>
          <button type="button" onClick={onOpenGuide}>Open Field Guide</button>
          <button type="button" onClick={onClose}>Keep gardening</button>
        </div>
      </section>
    </div>
  );
}
