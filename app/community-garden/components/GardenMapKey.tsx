"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { GardenUiState } from "./GardenCanvas";

type GardenMapKeyProps = {
  ui: GardenUiState;
  canExpand: boolean;
  disabled?: boolean;
  onNavigate: (mapX: number, mapY: number) => void;
};

type MapStyle = CSSProperties & {
  "--cg-map-x": string;
  "--cg-map-y": string;
  "--cg-map-width": string;
  "--cg-map-height": string;
};

const EXPANDED_MAP_SIZE = 600;
const PLANT_COLORS = {
  rose: "#b62f3d",
  sunflower: "#d7a52f",
  lavender: "#7876a8",
} as const;

export function GardenMapKey({
  ui,
  canExpand,
  disabled = false,
  onNavigate,
}: GardenMapKeyProps) {
  const [expanded, setExpanded] = useState(false);
  const expandedCanvasRef = useRef<HTMLCanvasElement>(null);
  const expandedMapRef = useRef<HTMLButtonElement>(null);
  const mapExpanded = expanded && !disabled;
  const mapStyle: MapStyle = {
    "--cg-map-x": `${ui.mapX}%`,
    "--cg-map-y": `${ui.mapY}%`,
    "--cg-map-width": `${ui.mapWidthPercentage}%`,
    "--cg-map-height": `${ui.mapHeightPercentage}%`,
  };

  useEffect(() => {
    if (!mapExpanded) return;
    expandedMapRef.current?.focus({ preventScroll: true });

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapExpanded]);

  useEffect(() => {
    if (!mapExpanded) return;
    const canvas = expandedCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, EXPANDED_MAP_SIZE, EXPANDED_MAP_SIZE);
    ctx.fillStyle = "#eef1e4";
    ctx.fillRect(0, 0, EXPANDED_MAP_SIZE, EXPANDED_MAP_SIZE);

    ctx.strokeStyle = "rgba(101, 112, 74, 0.16)";
    ctx.lineWidth = 1;
    for (let index = 1; index < 20; index += 1) {
      const coordinate = Math.round((index / 20) * EXPANDED_MAP_SIZE) + 0.5;
      ctx.beginPath();
      ctx.moveTo(coordinate, 0);
      ctx.lineTo(coordinate, EXPANDED_MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, coordinate);
      ctx.lineTo(EXPANDED_MAP_SIZE, coordinate);
      ctx.stroke();
    }

    for (const path of ui.pathMapPoints) {
      const x = Math.round((path.x / 100) * EXPANDED_MAP_SIZE);
      const y = Math.round((path.y / 100) * EXPANDED_MAP_SIZE);
      ctx.fillStyle = "#c7aa7c";
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }

    for (const plant of ui.plantMapPoints) {
      const x = Math.round((plant.x / 100) * EXPANDED_MAP_SIZE);
      const y = Math.round((plant.y / 100) * EXPANDED_MAP_SIZE);
      ctx.fillStyle = PLANT_COLORS[plant.plantType];
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }

    const playerX = Math.round((ui.mapX / 100) * EXPANDED_MAP_SIZE);
    const playerY = Math.round((ui.mapY / 100) * EXPANDED_MAP_SIZE);
    ctx.fillStyle = "#fff4df";
    ctx.fillRect(playerX - 6, playerY - 6, 12, 12);
    ctx.fillStyle = "#1f6e8c";
    ctx.fillRect(playerX - 4, playerY - 4, 8, 8);
  }, [mapExpanded, ui.mapX, ui.mapY, ui.pathMapPoints, ui.plantMapPoints]);

  function getMapPosition(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      mapX: ((event.clientX - bounds.left) / bounds.width) * 100,
      mapY: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  }

  function navigate(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) return;
    const { mapX, mapY } = getMapPosition(event);
    onNavigate(mapX, mapY);
  }

  function navigateFromExpandedMap(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) return;
    const { mapX, mapY } = getMapPosition(event);
    onNavigate(mapX, mapY);
    setExpanded(false);
  }

  return (
    <aside
      className={`cg-map-key is-${ui.mode}${mapExpanded ? " is-expanded" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <button
        className="cg-mini-map"
        type="button"
        disabled={disabled}
        style={mapStyle}
        onClick={navigate}
        aria-label={
          disabled
            ? "Garden overview. Finish this tutorial step before using map travel."
            : ui.mode === "personal"
            ? "My Garden overview. Select a point to walk there. Colored marks show your flowers."
            : "Community Garden overview. Select a point to travel there. Colored marks show planted flowers."
        }
      >
        <span className="cg-map-north" aria-hidden="true">N</span>
        {ui.mode === "personal" ? (
          <>
            <span className="cg-map-property-boundary" aria-hidden="true" />
            <span className="cg-map-home" aria-hidden="true" />
          </>
        ) : null}
        {ui.plantMapPoints.map((plant) => (
          <span
            className={`cg-map-plant is-${plant.plantType}`}
            key={`${plant.x}-${plant.y}`}
            style={{ left: `${plant.x}%`, top: `${plant.y}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="cg-map-player" title="You are here" aria-hidden="true" />
      </button>

      {canExpand ? (
        <button
          className="cg-map-expand"
          type="button"
          disabled={disabled}
          aria-label="Expand the full Community Garden map"
          aria-expanded={mapExpanded}
          onClick={() => setExpanded(true)}
        >
          Expand
        </button>
      ) : null}

      {canExpand && mapExpanded ? (
        <div className="cg-expanded-map-backdrop" role="presentation">
          <section
            className="cg-expanded-map-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-expanded-map-title"
          >
            <header>
              <div>
                <p>Garden Membership map</p>
                <h2 id="cg-expanded-map-title">
                  {ui.mode === "personal" ? "My Garden" : "Community Garden"}
                </h2>
              </div>
              <button
                className="cg-expanded-map-close"
                type="button"
                aria-label="Close full garden map"
                onClick={() => setExpanded(false)}
              >
                ×
              </button>
            </header>
            <p className="cg-expanded-map-help">
              Choose any part of the map to travel there.
            </p>
            <button
              ref={expandedMapRef}
              className="cg-expanded-map-surface"
              type="button"
              onClick={navigateFromExpandedMap}
              aria-label="Full Community Garden map. Tap a location to travel there."
            >
              <canvas
                ref={expandedCanvasRef}
                width={EXPANDED_MAP_SIZE}
                height={EXPANDED_MAP_SIZE}
                aria-hidden="true"
              />
              <span className="cg-expanded-map-north" aria-hidden="true">N</span>
            </button>
            <footer className="cg-expanded-map-legend" aria-label="Map legend">
              <span className="is-player">You</span>
              {ui.pathMapPoints.length > 0 ? (
                <span className="is-path">Path</span>
              ) : null}
              <span className="is-rose">Rose</span>
              <span className="is-sunflower">Sunflower</span>
              <span className="is-lavender">Lavender</span>
            </footer>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
