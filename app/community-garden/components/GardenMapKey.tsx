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
  daisy: "#f5ead2",
  tulip: "#d95b6a",
  wildflowers: "#8d79a9",
  peony: "#e998aa",
  bee_balm: "#c44e78",
} as const;

const REGION_COLORS = {
  garden: "#c9d8ad",
  edge: "#e5d9b2",
  growing: "#d8bd68",
  ready: "#e6b94e",
  new: "#b8d38e",
  resting: "#c9c0ac",
  wild: "#e8e4da",
} as const;

function isLockedRegion(region: GardenUiState["regionMapCells"][number]) {
  return !region.isOpen && region.stage !== "wild";
}

function drawRegionLock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const unit = Math.max(1, Math.min(3, Math.floor(Math.min(width, height) / 8)));
  const centerX = Math.round(x + width / 2);
  const centerY = Math.round(y + height / 2);
  const bodyWidth = 6 * unit;
  const bodyHeight = 5 * unit;
  const bodyX = Math.round(centerX - bodyWidth / 2);
  const bodyY = Math.round(centerY - unit);

  ctx.fillStyle = "rgba(255, 244, 223, 0.9)";
  ctx.fillRect(bodyX - unit, bodyY - 4 * unit, bodyWidth + 2 * unit, bodyHeight + 5 * unit);
  ctx.fillStyle = "#5b3b2d";
  ctx.fillRect(bodyX + unit, bodyY - 3 * unit, unit, 3 * unit);
  ctx.fillRect(bodyX + 4 * unit, bodyY - 3 * unit, unit, 3 * unit);
  ctx.fillRect(bodyX + 2 * unit, bodyY - 4 * unit, 2 * unit, unit);
  ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
  ctx.fillStyle = "#f3d88d";
  ctx.fillRect(centerX - Math.ceil(unit / 2), bodyY + 2 * unit, unit, 2 * unit);
}

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

    if (ui.regionMapCells.length > 0) {
      for (const region of ui.regionMapCells) {
        const x = Math.round((region.x / 100) * EXPANDED_MAP_SIZE);
        const y = Math.round((region.y / 100) * EXPANDED_MAP_SIZE);
        const width = Math.max(
          2,
          Math.ceil((region.width / 100) * EXPANDED_MAP_SIZE),
        );
        const height = Math.max(
          2,
          Math.ceil((region.height / 100) * EXPANDED_MAP_SIZE),
        );
        ctx.globalAlpha = region.isOpen ? 1 : region.stage === "wild" ? 0.22 : 0.7;
        ctx.fillStyle = REGION_COLORS[region.stage];
        ctx.fillRect(x, y, width, height);
        if (region.isOpen && region.plantCount > 0) {
          ctx.globalAlpha = 0.12 + (region.occupancyPercent / 100) * 0.46;
          ctx.fillStyle = "#657c52";
          ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2));
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle =
          region.stage === "growing" || region.stage === "ready"
            ? "#c18c22"
            : "rgba(76, 74, 55, 0.24)";
        ctx.lineWidth = region.stage === "ready" ? 3 : 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
        if (region.heritagePlantCount > 0) {
          const centerX = x + width / 2;
          const centerY = y + height / 2;
          ctx.fillStyle = "#fff4df";
          ctx.fillRect(centerX - 4, centerY - 1, 8, 2);
          ctx.fillRect(centerX - 1, centerY - 4, 2, 8);
          ctx.fillStyle = "#b67b1d";
          ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
        }
        if (isLockedRegion(region)) {
          drawRegionLock(ctx, x, y, width, height);
        }
      }
    } else {
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
        ctx.fillStyle = PLANT_COLORS[plant.plantType] ?? "#c75f78";
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }

    const playerX = Math.round((ui.mapX / 100) * EXPANDED_MAP_SIZE);
    const playerY = Math.round((ui.mapY / 100) * EXPANDED_MAP_SIZE);
    ctx.fillStyle = "#fff4df";
    ctx.fillRect(playerX - 6, playerY - 6, 12, 12);
    ctx.fillStyle = "#1f6e8c";
    ctx.fillRect(playerX - 4, playerY - 4, 8, 8);
  }, [
    mapExpanded,
    ui.mapX,
    ui.mapY,
    ui.pathMapPoints,
    ui.plantMapPoints,
    ui.regionMapCells,
  ]);

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
            : "Community Garden overview. Select open land to travel there. Green is open garden and gold padlocks mark future Growing Edge land."
        }
      >
        <span className="cg-map-north" aria-hidden="true">N</span>
        {ui.mode === "personal" ? (
          <>
            <span className="cg-map-property-boundary" aria-hidden="true" />
            <span className="cg-map-home" aria-hidden="true" />
          </>
        ) : null}
        {ui.mode === "community" && ui.regionMapCells.length > 0
          ? ui.regionMapCells.map((region) => (
              <span
                className={`cg-map-region is-${region.stage}${region.isOpen ? " is-open" : ""}${isLockedRegion(region) ? " is-locked" : ""}`}
                key={region.key}
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  "--cg-region-density": String(
                    Math.min(0.64, 0.08 + region.occupancyPercent / 170),
                  ),
                } as CSSProperties}
                aria-hidden="true"
              >
                {isLockedRegion(region) ? (
                  <span className="cg-map-region-lock" />
                ) : null}
              </span>
            ))
          : ui.plantMapPoints.map((plant) => (
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
              Choose open garden land to travel there. Golden padlocks mark future Growing Edge land that is still locked.
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
              {ui.regionMapCells.length > 0 ? (
                <>
                  <span className="is-growing-edge">Locked growing edge</span>
                  <span className="is-heritage">Heritage</span>
                  <span className="is-resting">Resting</span>
                </>
              ) : ui.pathMapPoints.length > 0 ? (
                <span className="is-path">Path</span>
              ) : null}
              {ui.regionMapCells.length === 0 ? (
                <>
                  <span className="is-rose">Rose</span>
                  <span className="is-sunflower">Sunflower</span>
                  <span className="is-lavender">Lavender</span>
                </>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
