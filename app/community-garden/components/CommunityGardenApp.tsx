"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FutureAdSlot } from "./FutureAdSlot";
import {
  GardenCanvas,
  type GardenCanvasHandle,
  type GardenUiState,
} from "./GardenCanvas";
import { getGardenAccountClient } from "../lib/supabaseAccount";
import type { GardenContribution } from "../lib/supabaseGarden";
import { GardenMapKey } from "./GardenMapKey";
import { GardenMenu, type LibrarySection } from "./GardenMenu";
import {
  getPlantDefinition,
  PLANT_TYPES,
} from "../lib/roseLifecycle";

const INITIAL_UI: GardenUiState = {
  action: null,
  actionLabel: "Choose a spot",
  actionEnabled: false,
  connection: "connecting",
  message: "Connecting to the shared garden...",
  mapX: 60.38,
  mapY: 60.38,
  zoom: 1,
  canZoomIn: true,
  canZoomOut: false,
  selectedPlantType: "rose",
  plantMapPoints: [],
};

type CareBurst = {
  id: number;
  value: number;
  detail: string;
};

export function CommunityGardenApp() {
  const canvasRef = useRef<GardenCanvasHandle>(null);
  const [ui, setUi] = useState(INITIAL_UI);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSection, setMenuSection] = useState<LibrarySection>("play");
  const [careBurst, setCareBurst] = useState<CareBurst | null>(null);
  const adLabel = process.env.NEXT_PUBLIC_COMMUNITY_GARDEN_AD_PLACEHOLDER;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("steward") || params.has("checkout")) {
      queueMicrotask(() => {
        setMenuSection("steward");
        setMenuOpen(true);
      });
    }
  }, []);

  const onStateChange = useCallback((state: GardenUiState) => {
    setUi(state);
  }, []);

  const claimCommunityContribution = useCallback(
    async (contribution: GardenContribution) => {
      const burstId = Date.now();
      setCareBurst({
        id: burstId,
        value: contribution.careValue,
        detail: "Helping the Community Garden",
      });

      const updateBurst = (detail: string) => {
        setCareBurst((current) =>
          current?.id === burstId ? { ...current, detail } : current,
        );
      };

      const client = getGardenAccountClient();
      if (!client) {
        updateBurst("Garden Membership banks Care");
        return;
      }
      const { data } = await client.auth.getSession();
      if (!data.session) {
        updateBurst("Garden Membership banks Care");
        return;
      }

      try {
        const response = await fetch("/api/community-garden/care", {
          method: "POST",
          headers: {
            authorization: `Bearer ${data.session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ receiptToken: contribution.receiptToken }),
        });
        if (response.status === 401 || response.status === 403) {
          updateBurst("Garden Membership banks Care");
          return;
        }
        if (!response.ok) {
          updateBurst("Care was earned but could not be banked");
          return;
        }
        const award = (await response.json()) as {
          awardedCare: number;
          careBalance: number;
        };
        updateBurst(
          award.awardedCare > 0
            ? `Saved · ${award.careBalance} Care in My Garden`
            : "Daily basket full · thank you for helping",
        );
      } catch {
        updateBurst("Care was earned but could not be banked");
      }
    },
    [],
  );

  useEffect(() => {
    if (!careBurst) return;
    const timeout = window.setTimeout(() => setCareBurst(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [careBurst]);

  return (
    <main className="cg-root">
      <section className="cg-game-frame" aria-label="Basil Community Garden game">
        <GardenCanvas
          ref={canvasRef}
          onStateChange={onStateChange}
          onCommunityContribution={claimCommunityContribution}
        />

        <header className="cg-titlebar">
          <div className="cg-pixel-rose" aria-hidden="true">
            <span />
          </div>
          <div className="cg-title-copy">
            <h1>Basil</h1>
            <p>Community Garden</p>
          </div>
          <button
            className="cg-icon-button"
            type="button"
            aria-label="Open garden menu"
            onClick={() => {
              setMenuSection("play");
              setMenuOpen(true);
            }}
          >
            <span className="cg-menu-icon" aria-hidden="true" />
          </button>
        </header>

        <GardenMapKey
          ui={ui}
          onNavigate={(mapX, mapY) => canvasRef.current?.goToMapPosition(mapX, mapY)}
        />

        <div className="cg-zoom-control" role="group" aria-label="Garden zoom">
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out to see more of the garden"
            disabled={!ui.canZoomOut}
            onClick={() => canvasRef.current?.zoomOut()}
          >
            -
          </button>
          <output aria-label={`Current zoom ${ui.zoom} times`}>{ui.zoom}x</output>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in for a closer garden view"
            disabled={!ui.canZoomIn}
            onClick={() => canvasRef.current?.zoomIn()}
          >
            +
          </button>
        </div>

        <button
          className="cg-compact-support"
          type="button"
          aria-label="Open My Garden"
          onClick={() => {
            setMenuSection("steward");
            setMenuOpen(true);
          }}
        >
          <span className="cg-home-mark" aria-hidden="true" />
          My Garden
        </button>

        {careBurst ? (
          <div key={careBurst.id} className="cg-care-toast" aria-live="polite">
            <strong>+{careBurst.value} Care</strong>
            <span>{careBurst.detail}</span>
          </div>
        ) : null}

        <div className="cg-plant-picker" role="group" aria-label="Choose what to plant">
          {PLANT_TYPES.map((plantType) => {
            const plant = getPlantDefinition(plantType);
            return (
              <button
                key={plantType}
                type="button"
                aria-label={`Select ${plant.name} seeds`}
                aria-pressed={ui.selectedPlantType === plantType}
                title={plant.name}
                onClick={() => canvasRef.current?.selectPlant(plantType)}
              >
                <span className={`cg-plant-glyph is-${plantType}`} aria-hidden="true" />
                <span>{plant.name}</span>
              </button>
            );
          })}
        </div>

        <button
          className="cg-action-button"
          type="button"
          disabled={!ui.actionEnabled}
          onClick={() => void canvasRef.current?.performAction()}
        >
          <span
            className={
              ui.action === "water"
                ? "cg-water-icon"
                : `cg-plant-glyph is-${ui.selectedPlantType}`
            }
            aria-hidden="true"
          />
          <span>{ui.actionLabel}</span>
        </button>

        <p className="cg-sr-status" aria-live="polite">{ui.message}</p>
      </section>

      <FutureAdSlot label={adLabel} />

      <GardenMenu
        open={menuOpen}
        section={menuSection}
        onClose={() => setMenuOpen(false)}
        onSectionChange={setMenuSection}
      />
    </main>
  );
}

