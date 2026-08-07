"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  renderGarden,
  worldToScreen,
  type WorldPoint,
} from "../game/gardenRenderer";
import { GARDEN_CONFIG } from "../lib/gardenConfig";
import {
  fetchGardenRegionManifest,
  fetchGardenSnapshot,
  type GardenRegionManifest,
  type GardenSnapshot,
} from "../lib/supabaseGarden";

type PresentationData = {
  manifest: GardenRegionManifest;
  snapshot: GardenSnapshot;
};

type CommunityGardenPresentationProps = {
  open: boolean;
  onClose: () => void;
};

function getPresentationCamera(
  bounds: GardenRegionManifest["mapBounds"],
  viewport: { width: number; height: number },
  zoom: number,
): WorldPoint {
  const centerX =
    ((bounds.minX + bounds.maxX + 1) / 2) * GARDEN_CONFIG.tileSize;
  const centerY =
    ((bounds.minY + bounds.maxY + 1) / 2) * GARDEN_CONFIG.tileSize;
  const yScale =
    GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  return {
    x: centerX,
    y:
      centerY +
      ((GARDEN_CONFIG.maryScreenYRatio - 0.5) * viewport.height) /
        (yScale * zoom),
  };
}

function maskOutsideMap(
  context: CanvasRenderingContext2D,
  bounds: GardenRegionManifest["mapBounds"],
  camera: WorldPoint,
  viewport: { width: number; height: number },
  zoom: number,
) {
  const topLeft = worldToScreen(
    {
      x: bounds.minX * GARDEN_CONFIG.tileSize,
      y: bounds.minY * GARDEN_CONFIG.tileSize,
    },
    camera,
    viewport,
    zoom,
  );
  const bottomRight = worldToScreen(
    {
      x: (bounds.maxX + 1) * GARDEN_CONFIG.tileSize,
      y: (bounds.maxY + 1) * GARDEN_CONFIG.tileSize,
    },
    camera,
    viewport,
    zoom,
  );
  const left = Math.floor(topLeft.x);
  const top = Math.floor(topLeft.y);
  const right = Math.ceil(bottomRight.x);
  const bottom = Math.ceil(bottomRight.y);

  context.fillStyle = "#17251d";
  context.fillRect(0, 0, viewport.width, Math.max(0, top));
  context.fillRect(0, bottom, viewport.width, Math.max(0, viewport.height - bottom));
  context.fillRect(0, top, Math.max(0, left), Math.max(0, bottom - top));
  context.fillRect(right, top, Math.max(0, viewport.width - right), Math.max(0, bottom - top));
}

export function CommunityGardenPresentation({
  open,
  onClose,
}: CommunityGardenPresentationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadSequenceRef = useRef(0);
  const [data, setData] = useState<PresentationData | null>(null);
  const [error, setError] = useState("");

  const loadGarden = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setError("");
    try {
      const [manifest, snapshot] = await Promise.all([
        fetchGardenRegionManifest(),
        fetchGardenSnapshot(),
      ]);
      if (loadSequenceRef.current === sequence) {
        setData({ manifest, snapshot });
      }
    } catch (loadError) {
      if (loadSequenceRef.current !== sequence) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The full garden view could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    if (!open) {
      loadSequenceRef.current += 1;
      setData(null);
      setError("");
      return;
    }
    void loadGarden();
  }, [loadGarden, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const renderPresentation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * pixelRatio));
    const height = Math.max(1, Math.round(rect.height * pixelRatio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const viewport = { width, height };
    const bounds = data.manifest.mapBounds;
    const gridWidth = bounds.maxX - bounds.minX + 1;
    const gridHeight = bounds.maxY - bounds.minY + 1;
    const inset = Math.max(8, Math.round(12 * pixelRatio));
    const zoom = Math.max(
      0.08,
      Math.min(
        1.5,
        (viewport.width - inset * 2) /
          (gridWidth * GARDEN_CONFIG.tileSize),
        (viewport.height - inset * 2) /
          (gridHeight * GARDEN_CONFIG.tileScreenHeight),
      ),
    );
    const camera = getPresentationCamera(bounds, viewport, zoom);
    const offscreenCharacter = { x: 1_000_000, y: 1_000_000 };

    renderGarden(context, {
      viewport,
      camera,
      zoom,
      mary: offscreenCharacter,
      duck: offscreenCharacter,
      plants: data.snapshot.plants,
      weeds: data.snapshot.weeds,
      selected: null,
      wateringTargets: [],
      wateringCareReadyPlantIds: new Set(),
      wateringCareStatusLoaded: true,
      suggestedPlantingCell: null,
      suggestedWateringCell: null,
      gardenWorms: [],
      tutorialDimmed: false,
      effects: [],
      moving: false,
      reducedMotion: true,
      now: Date.now(),
      mode: "community",
      communityRegions: data.manifest.regions.map((region) => ({
        regionX: region.regionX,
        regionY: region.regionY,
        isOpen: region.isOpen,
        publicStage: region.publicStage,
        guidanceZone: region.guidanceZone,
      })),
    });
    maskOutsideMap(context, bounds, camera, viewport, zoom);
  }, [data]);

  useEffect(() => {
    if (!open || !data) return;
    renderPresentation();
    const canvas = canvasRef.current;
    const observer =
      canvas && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(renderPresentation)
        : null;
    if (canvas) observer?.observe(canvas);
    window.addEventListener("resize", renderPresentation);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", renderPresentation);
    };
  }, [data, open, renderPresentation]);

  if (!open) return null;

  return (
    <section
      className="cg-community-presentation"
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen Community Garden"
    >
      <canvas
        ref={canvasRef}
        className="cg-community-presentation-canvas"
        aria-label="The entire live Basil Community Garden"
      />
      <div className="cg-community-presentation-label" aria-live="polite">
        <strong>Basil</strong>
        <span>
          {data
            ? `Live Community Garden · ${data.snapshot.plantCount.toLocaleString()} plants`
            : error || "Loading the entire Community Garden…"}
        </span>
      </div>
      {error ? (
        <button
          className="cg-community-presentation-retry"
          type="button"
          onClick={() => void loadGarden()}
        >
          Try again
        </button>
      ) : null}
      <button
        className="cg-community-presentation-close"
        type="button"
        aria-label="Close full-screen Community Garden"
        onClick={onClose}
      >
        Exit full screen
      </button>
    </section>
  );
}
