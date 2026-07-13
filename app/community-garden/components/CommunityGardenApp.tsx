"use client";

import { useCallback, useRef, useState } from "react";
import { FutureAdSlot } from "./FutureAdSlot";
import {
  GardenCanvas,
  type GardenCanvasHandle,
  type GardenUiState,
} from "./GardenCanvas";
import { GardenMenu } from "./GardenMenu";

const INITIAL_UI: GardenUiState = {
  action: null,
  actionLabel: "Choose a spot",
  actionEnabled: false,
  connection: "connecting",
  message: "Connecting to the shared garden...",
  condition: "The garden is waking up.",
  hasMoved: false,
};

export function CommunityGardenApp() {
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const [ui, setUi] = useState(INITIAL_UI);
  const [menuOpen, setMenuOpen] = useState(false);
  const donationUrl = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_DONATION_URL;
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;

  const onStateChange = useCallback((state: GardenUiState) => {
    setUi(state);
  }, []);

  return (
    <main className="cg-root">
      <FutureAdSlot label={adLabel} />

      <div className="cg-shell">
        <header className="cg-titlebar">
          <div className="cg-pixel-rose" aria-hidden="true">
            <span />
          </div>
          <div className="cg-title-copy">
            <h1>Community Garden</h1>
            <p>Water. Care. Grow together.</p>
          </div>
          <button
            className="cg-icon-button"
            type="button"
            aria-label="Open garden menu"
            onClick={() => setMenuOpen(true)}
          >
            <span className="cg-menu-icon" aria-hidden="true" />
          </button>
        </header>

        <section className="cg-game-frame" aria-label="Community Garden game">
          <GardenCanvas ref={canvasRef} onStateChange={onStateChange} />

          <div
            id="community-garden-instructions"
            className={`cg-instructions${ui.hasMoved ? " cg-instructions-muted" : ""}`}
          >
            <span className="cg-spark" aria-hidden="true">+</span>
            <p><strong>Tap anywhere</strong> to walk</p>
            <p><strong>Tap a rose</strong> to care for it</p>
          </div>

          <button
            className="cg-action-button"
            type="button"
            disabled={!ui.actionEnabled}
            onClick={() => void canvasRef.current?.performAction()}
          >
            <span className={ui.action === "water" ? "cg-water-icon" : "cg-action-rose"} aria-hidden="true" />
            <span>{ui.actionLabel}</span>
          </button>
        </section>

        <div className="cg-condition-row">
          <span className={`cg-status-dot cg-status-${ui.connection}`} aria-hidden="true" />
          <p>{ui.condition}</p>
          <button type="button" onClick={() => setMenuOpen(true)}>Support</button>
        </div>

        <p className="cg-live-status" aria-live="polite">{ui.message}</p>
      </div>

      <GardenMenu
        open={menuOpen}
        donationUrl={donationUrl}
        onClose={() => setMenuOpen(false)}
      />
    </main>
  );
}

