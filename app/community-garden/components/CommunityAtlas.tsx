"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  fetchGardenRegionWindow,
  type GardenRegionWindow,
} from "../lib/supabaseGarden";
import type { GardenUiState } from "./GardenCanvas";

export type CommunityAtlasTarget = {
  gridX: number;
  gridY: number;
  label: string;
  requestId: number;
};

type CommunityAtlasProps = {
  open: boolean;
  ui: GardenUiState;
  focusTarget?: CommunityAtlasTarget | null;
  onClose: () => void;
  onNavigateMap: (mapX: number, mapY: number) => void;
  onNavigateGrid: (gridX: number, gridY: number) => void;
};

type AtlasPoint = {
  mapX: number;
  mapY: number;
  gridX?: number;
  gridY?: number;
  label?: string;
};

const ATLAS_SIZE = 720;
const ATLAS_ZOOMS = [1, 2, 4] as const;
const PLANT_COLORS = {
  rose: "#c52f45",
  sunflower: "#e0a91f",
  lavender: "#736fd0",
  daisy: "#fff4df",
  tulip: "#e75066",
  wildflowers: "#9066bc",
  peony: "#ef8faa",
  bee_balm: "#d13f76",
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
const ZONE_COLORS = {
  heart: "#789267",
  "growth-ring": "#c7b661",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function gridToMap(
  grid: number,
  bounds: GardenUiState["mapBounds"],
  axis: "x" | "y",
) {
  const minimum = axis === "x" ? bounds.minX : bounds.minY;
  const maximum = axis === "x" ? bounds.maxX : bounds.maxY;
  return ((grid - minimum) / Math.max(1, maximum - minimum + 1)) * 100;
}

function isLockedRegion(region: GardenUiState["regionMapCells"][number]) {
  return !region.isOpen && region.stage !== "wild";
}

function regionTitle(region: GardenUiState["regionMapCells"][number] | null) {
  if (!region) return "Unmapped garden";
  if (region.guidanceZone === "heart") return "Garden Heart";
  if (region.guidanceZone === "growth-ring") return "Growth Ring";
  if (region.stage === "growing" || region.stage === "ready") {
    return "Growing Edge";
  }
  if (region.stage === "resting") return "Resting garden";
  if (region.stage === "new") return "Newly opened garden";
  return region.isOpen ? "Community Garden" : "Locked land";
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
  ctx.fillStyle = "rgba(255, 244, 223, 0.9)";
  ctx.fillRect(centerX - 4 * unit, centerY - 5 * unit, 8 * unit, 9 * unit);
  ctx.fillStyle = "#5b3b2d";
  ctx.fillRect(centerX - 3 * unit, centerY - unit, 6 * unit, 5 * unit);
  ctx.fillRect(centerX - 2 * unit, centerY - 4 * unit, unit, 3 * unit);
  ctx.fillRect(centerX + unit, centerY - 4 * unit, unit, 3 * unit);
  ctx.fillRect(centerX - unit, centerY - 5 * unit, 2 * unit, unit);
  ctx.fillStyle = "#f3d88d";
  ctx.fillRect(centerX, centerY + unit, unit, 2 * unit);
}

export function CommunityAtlas({
  open,
  ui,
  focusTarget,
  onClose,
  onNavigateMap,
  onNavigateGrid,
}: CommunityAtlasProps) {
  const initialPoint = focusTarget
    ? {
        mapX: gridToMap(focusTarget.gridX, ui.mapBounds, "x"),
        mapY: gridToMap(focusTarget.gridY, ui.mapBounds, "y"),
        gridX: focusTarget.gridX,
        gridY: focusTarget.gridY,
        label: focusTarget.label,
      }
    : null;
  const initialRegionKey = focusTarget
    ? (ui.regionMapCells.find(
        (candidate) =>
          focusTarget.gridX >= candidate.minX &&
          focusTarget.gridX <= candidate.maxX &&
          focusTarget.gridY >= candidate.minY &&
          focusTarget.gridY <= candidate.maxY,
      )?.key ?? null)
    : null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState<(typeof ATLAS_ZOOMS)[number]>(
    focusTarget ? 4 : 1,
  );
  const [center, setCenter] = useState(
    initialPoint
      ? { x: initialPoint.mapX, y: initialPoint.mapY }
      : { x: 50, y: 50 },
  );
  const [selectedPoint, setSelectedPoint] = useState<AtlasPoint | null>(
    initialPoint,
  );
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(
    initialRegionKey,
  );
  const [detail, setDetail] = useState<GardenRegionWindow | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">(
    focusTarget ? "loading" : "idle",
  );

  const selectedRegion =
    ui.regionMapCells.find((region) => region.key === selectedRegionKey) ?? null;
  const viewSize = 100 / zoom;
  const view = useMemo(() => {
    const half = viewSize / 2;
    const centerX = clamp(center.x, half, 100 - half);
    const centerY = clamp(center.y, half, 100 - half);
    return {
      minX: centerX - half,
      minY: centerY - half,
      size: viewSize,
    };
  }, [center.x, center.y, viewSize]);

  useEffect(() => {
    if (!open) return;
    surfaceRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !selectedRegion || !selectedRegion.isOpen || ui.snapshotVersion <= 0) return;
    let active = true;
    void fetchGardenRegionWindow(
      selectedRegion.regionX,
      selectedRegion.regionY,
      ui.snapshotVersion,
      0,
    )
      .then((window) => {
        if (!active) return;
        setDetail(window);
        setDetailStatus("idle");
      })
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setDetailStatus("error");
      });
    return () => {
      active = false;
    };
  }, [open, selectedRegion, ui.snapshotVersion]);

  const visiblePlants = useMemo(() => {
    const plants = new Map<
      string,
      { mapX: number; mapY: number; plantType: string; heritage: boolean }
    >();
    for (const plant of ui.plantMapPoints) {
      plants.set(`${plant.gridX}:${plant.gridY}`, {
        mapX: plant.x,
        mapY: plant.y,
        plantType: plant.plantType,
        heritage: plant.heritage,
      });
    }
    for (const plant of detail?.plants ?? []) {
      plants.set(`${plant.grid_x}:${plant.grid_y}`, {
        mapX: gridToMap(plant.grid_x, ui.mapBounds, "x"),
        mapY: gridToMap(plant.grid_y, ui.mapBounds, "y"),
        plantType: plant.plant_type,
        heritage: Boolean(plant.heritage_at),
      });
    }
    return Array.from(plants.values());
  }, [detail?.plants, ui.mapBounds, ui.plantMapPoints]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const projectX = (value: number) => ((value - view.minX) / view.size) * ATLAS_SIZE;
    const projectY = (value: number) => ((value - view.minY) / view.size) * ATLAS_SIZE;
    const projectSize = (value: number) => (value / view.size) * ATLAS_SIZE;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    ctx.fillStyle = "#eef1e4";
    ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    for (const region of ui.regionMapCells) {
      const x = projectX(region.x);
      const y = projectY(region.y);
      const width = Math.max(2, projectSize(region.width));
      const height = Math.max(2, projectSize(region.height));
      if (x + width < 0 || y + height < 0 || x > ATLAS_SIZE || y > ATLAS_SIZE) continue;
      ctx.globalAlpha = region.isOpen ? 1 : region.stage === "wild" ? 0.2 : 0.72;
      ctx.fillStyle = REGION_COLORS[region.stage];
      ctx.fillRect(x, y, width, height);
      if (region.isOpen && region.plantCount > 0) {
        ctx.globalAlpha = 0.12 + (region.occupancyPercent / 100) * 0.48;
        ctx.fillStyle = "#597747";
        ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2));
      }
      if (region.guidanceZone === "heart" || region.guidanceZone === "growth-ring") {
        ctx.globalAlpha = region.guidanceZone === "heart" ? 0.34 : 0.28;
        ctx.fillStyle = ZONE_COLORS[region.guidanceZone];
        ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2));
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle =
        region.key === selectedRegionKey
          ? "#b62f3d"
          : region.stage === "growing" || region.stage === "ready"
            ? "#b77d1d"
            : "rgba(76, 74, 55, 0.3)";
      ctx.lineWidth = region.key === selectedRegionKey ? 4 : region.stage === "ready" ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
      if (region.heritagePlantCount > 0 && zoom <= 2) {
        const markerX = x + width / 2;
        const markerY = y + height / 2;
        ctx.fillStyle = "#fff4df";
        ctx.fillRect(markerX - 5, markerY - 1, 10, 2);
        ctx.fillRect(markerX - 1, markerY - 5, 2, 10);
        ctx.fillStyle = "#b67b1d";
        ctx.fillRect(markerX - 2, markerY - 2, 4, 4);
      }
      if (isLockedRegion(region)) drawRegionLock(ctx, x, y, width, height);
    }

    if (zoom >= 2) {
      const dot = zoom === 4 ? 7 : 4;
      for (const plant of visiblePlants) {
        const x = projectX(plant.mapX);
        const y = projectY(plant.mapY);
        if (x < -dot || y < -dot || x > ATLAS_SIZE + dot || y > ATLAS_SIZE + dot) continue;
        ctx.fillStyle =
          PLANT_COLORS[plant.plantType as keyof typeof PLANT_COLORS] ?? "#c52f45";
        ctx.fillRect(Math.round(x - dot / 2), Math.round(y - dot / 2), dot, dot);
        if (plant.heritage) {
          ctx.strokeStyle = "#b67b1d";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            Math.round(x - dot / 2) - 2,
            Math.round(y - dot / 2) - 2,
            dot + 4,
            dot + 4,
          );
        }
      }
      if (zoom === 4) {
        for (const weed of detail?.weeds ?? []) {
          const x = projectX(gridToMap(weed.grid_x, ui.mapBounds, "x"));
          const y = projectY(gridToMap(weed.grid_y, ui.mapBounds, "y"));
          ctx.fillStyle = "#52633f";
          ctx.fillRect(x - 4, y - 1, 8, 3);
          ctx.fillRect(x - 1, y - 4, 3, 8);
        }
      }
    }

    if (selectedPoint) {
      const x = projectX(selectedPoint.mapX);
      const y = projectY(selectedPoint.mapY);
      ctx.strokeStyle = "#b62f3d";
      ctx.lineWidth = 4;
      ctx.strokeRect(x - 10, y - 10, 20, 20);
      ctx.fillStyle = "#fff4df";
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }

    const playerX = projectX(ui.mapX);
    const playerY = projectY(ui.mapY);
    ctx.fillStyle = "#fff4df";
    ctx.fillRect(playerX - 7, playerY - 7, 14, 14);
    ctx.fillStyle = "#1f6e8c";
    ctx.fillRect(playerX - 4, playerY - 4, 8, 8);
    ctx.globalAlpha = 1;
  }, [detail?.weeds, open, selectedPoint, selectedRegionKey, ui.mapBounds, ui.mapX, ui.mapY, ui.regionMapCells, view, visiblePlants, zoom]);

  function selectPoint(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const mapX = clamp(
      view.minX + ((event.clientX - bounds.left) / bounds.width) * view.size,
      0,
      100,
    );
    const mapY = clamp(
      view.minY + ((event.clientY - bounds.top) / bounds.height) * view.size,
      0,
      100,
    );
    const region = ui.regionMapCells.find(
      (candidate) =>
        mapX >= candidate.x &&
        mapX <= candidate.x + candidate.width &&
        mapY >= candidate.y &&
        mapY <= candidate.y + candidate.height,
    );
    setSelectedPoint({ mapX, mapY });
    setSelectedRegionKey(region?.key ?? null);
    setDetail(null);
    setDetailStatus(region?.isOpen ? "loading" : "idle");
    if (zoom > 1) setCenter({ x: mapX, y: mapY });
  }

  function changeZoom(nextZoom: (typeof ATLAS_ZOOMS)[number]) {
    const anchor = selectedPoint ?? { mapX: ui.mapX, mapY: ui.mapY };
    setCenter({ x: anchor.mapX, y: anchor.mapY });
    setZoom(nextZoom);
  }

  function travel() {
    if (!selectedPoint || !selectedRegion?.isOpen) return;
    if (
      typeof selectedPoint.gridX === "number" &&
      typeof selectedPoint.gridY === "number"
    ) {
      onNavigateGrid(selectedPoint.gridX, selectedPoint.gridY);
    } else {
      onNavigateMap(selectedPoint.mapX, selectedPoint.mapY);
    }
    onClose();
  }

  if (!open) return null;
  const zoomIndex = ATLAS_ZOOMS.indexOf(zoom);
  const selectedTitle = selectedPoint?.label ?? regionTitle(selectedRegion);

  return (
    <div className="cg-expanded-map-backdrop" role="presentation">
      <section
        className="cg-expanded-map-dialog is-atlas"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-expanded-map-title"
      >
        <header>
          <div>
            <p>Garden Membership map</p>
            <h2 id="cg-expanded-map-title">Community Atlas</h2>
          </div>
          <button
            className="cg-expanded-map-close"
            type="button"
            aria-label="Close Community Atlas"
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>
        <p className="cg-expanded-map-help">
          Select a region to inspect it. Zoom closer to see individual flowers,
          then choose Go here when you are ready to travel.
        </p>
        <div className="cg-atlas-toolbar" role="group" aria-label="Atlas zoom controls">
          <button
            type="button"
            disabled={zoomIndex === 0}
            onClick={() => changeZoom(ATLAS_ZOOMS[Math.max(0, zoomIndex - 1)])}
          >
            -
          </button>
          <output>{zoom}x</output>
          <button
            type="button"
            disabled={zoomIndex === ATLAS_ZOOMS.length - 1}
            onClick={() =>
              changeZoom(ATLAS_ZOOMS[Math.min(ATLAS_ZOOMS.length - 1, zoomIndex + 1)])
            }
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPoint({ mapX: ui.mapX, mapY: ui.mapY, label: "You are here" });
              setCenter({ x: ui.mapX, y: ui.mapY });
            }}
          >
            Center me
          </button>
        </div>
        <button
          ref={surfaceRef}
          className="cg-expanded-map-surface"
          type="button"
          onClick={selectPoint}
          aria-label="Community Atlas. Select a region to inspect it."
        >
          <canvas ref={canvasRef} width={ATLAS_SIZE} height={ATLAS_SIZE} aria-hidden="true" />
          <span className="cg-expanded-map-north" aria-hidden="true">N</span>
        </button>
        <div className="cg-atlas-selection" aria-live="polite">
          <div>
            <small>{selectedRegion ? `Region ${selectedRegion.regionX}, ${selectedRegion.regionY}` : "Choose a region"}</small>
            <strong>{selectedTitle}</strong>
            {selectedRegion ? (
              <span>
                {selectedRegion.plantCount} flowers &middot;{" "}
                {selectedRegion.heritagePlantCount} Heritage &middot;{" "}
                {selectedRegion.weedCount} weeds
              </span>
            ) : (
              <span>Tap the map to inspect an area.</span>
            )}
            {detailStatus === "loading" ? <span>Loading nearby flowers...</span> : null}
            {detailStatus === "error" ? <span>Flower detail is temporarily unavailable.</span> : null}
          </div>
          <button type="button" disabled={!selectedPoint || !selectedRegion?.isOpen} onClick={travel}>
            {selectedPoint?.label ? `Go to ${selectedPoint.label}` : "Go here"}
          </button>
        </div>
        <footer className="cg-expanded-map-legend" aria-label="Map legend">
          <span className="is-player">You</span>
          <span className="is-garden-heart">Garden Heart</span>
          <span className="is-growth-ring">Growth Ring</span>
          <span className="is-growing-edge">Locked growing edge</span>
          <span className="is-heritage">Heritage</span>
          <span className="is-rose">Rose</span>
          <span className="is-sunflower">Sunflower</span>
          <span className="is-lavender">Lavender</span>
        </footer>
      </section>
    </div>
  );
}
