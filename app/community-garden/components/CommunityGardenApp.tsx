"use client";

import { useCallback, useRef, useState } from "react";
import { FutureAdSlot } from "./FutureAdSlot";
import {
  GardenCanvas,
  type GardenCanvasHandle,
  type GardenUiState,
} from "./GardenCanvas";
import { GardenMapKey } from "./GardenMapKey";
import { GardenMenu } from "./GardenMenu";

const INITIAL_UI: GardenUiState = {
  action: null,
  actionLabel: "Choose a spot",
  actionEnabled: false,
  connection: "connecting",
  message: "Connecting to the shared garden...",
  mapX: 60.38,
  mapY: 60.38,
  roseMapPoints: [],
};

export function CommunityGardenApp() {
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const [ui, setUi] = useState(INITIAL_UI);
  const [menuOpen, setMenuOpen] = useState(false);
  const donationUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_DONATION_URL ??
    "https://donate.stripe.com/9B614n2dH1Ui6VVdlWgw00F";
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;

  const onStateChange = useCallback((state: GardenUiState) => {
    setUi(state);
  }, []);

  return (
    <main className="cg-root">
      <section className="cg-game-frame" aria-label="Community Garden game">
        <GardenCanvas ref={canvasRef} onStateChange={onStateChange} />

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

        <GardenMapKey
          ui={ui}
          onNavigate={(mapX, mapY) => canvasRef.current?.goToMapPosition(mapX, mapY)}
        />

        <button
          className="cg-compact-support"
          type="button"
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true">+</span>
          Support
        </button>

        <button
          className="cg-action-button"
          type="button"
          disabled={!ui.actionEnabled}
          onClick={() => void canvasRef.current?.performAction()}
        >
          <span className={ui.action === "water" ? "cg-water-icon" : "cg-action-rose"} aria-hidden="true" />
          <span>{ui.actionLabel}</span>
        </button>

        <p className="cg-sr-status" aria-live="polite">{ui.message}</p>
      </section>

      <FutureAdSlot label={adLabel} />

      <GardenMenu
        open={menuOpen}
        donationUrl={donationUrl}
        onClose={() => setMenuOpen(false)}
      />
    </main>
  );
}

