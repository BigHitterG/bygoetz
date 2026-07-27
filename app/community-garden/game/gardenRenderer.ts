import { GARDEN_CONFIG, isWithinGarden } from "../lib/gardenConfig";
import {
  getMyGardenElement,
  type MyGardenElementType,
} from "../lib/myGardenCatalog";
import {
  canEarnWateringCare,
  getPlantVisual,
  isSpecialWateringFlower,
  type PlantRecord,
} from "../lib/roseLifecycle";
import {
  HERITAGE_GOLD_DARK,
  HERITAGE_GOLD_LIGHT,
} from "../lib/heritageDiscovery";
import { findHeritageAuraAnchor } from "../lib/heritageAura";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";

export type WorldPoint = { x: number; y: number };
export type GardenViewport = { width: number; height: number };
export type GardenWorldMode = "community" | "personal";
export type SelectedCell = {
  gridX: number;
  gridY: number;
  plantId?: string;
  weedId?: string;
} | null;
export type GardenEffect =
  | {
      kind: "plant" | "water" | "uproot" | "path" | "worm";
      gridX: number;
      gridY: number;
      startedAt: number;
    }
  | {
      kind: "care";
      x: number;
      y: number;
      value: number;
      dailyBonus?: boolean;
      startedAt: number;
    }
  | {
      kind: "spray";
      fromX: number;
      fromY: number;
      gridX: number;
      gridY: number;
      startedAt: number;
    };

export type RenderGardenState = {
  viewport: GardenViewport;
  camera: WorldPoint;
  zoom: number;
  mary: WorldPoint;
  duck: WorldPoint;
  plants: PlantRecord[];
  weeds: Array<{ id: string; grid_x: number; grid_y: number; spawned_at: string }>;
  selected: SelectedCell;
  wateringTargets: Array<NonNullable<SelectedCell>>;
  wateringCareReadyPlantIds?: ReadonlySet<string>;
  wateringCareStatusLoaded?: boolean;
  suggestedPlantingCell: SelectedCell;
  suggestedWateringCell: SelectedCell;
  gardenWorms: Array<{ gridX: number; gridY: number; surfacedAt: number }>;
  tutorialDimmed: boolean;
  effects: GardenEffect[];
  moving: boolean;
  now: number;
  mode: GardenWorldMode;
  communityRegions?: Array<{
    regionX: number;
    regionY: number;
    isOpen: boolean;
    publicStage: "garden" | "edge" | "growing" | "ready" | "new" | "resting" | "wild";
    guidanceZone: "garden" | "heart" | "growth-ring" | null;
  }>;
  shareOnly?: boolean;
  personalGarden?: {
    minX: number;
    minY: number;
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
    elements: Array<{
      id: string;
      gridX: number;
      gridY: number;
      elementType: MyGardenElementType;
      careCost: number;
    }>;
    paths: Array<{ gridX: number; gridY: number }>;
    nextExpansion: null | {
      minX: number;
      minY: number;
      width: number;
      height: number;
      careCost: number;
    };
  };
  builderPreview?: {
    mode: "place" | "remove";
    cells: Array<{ gridX: number; gridY: number }>;
    invalidCell: { gridX: number; gridY: number } | null;
  };
};

type TerrainLayer = "base" | "soil" | "green";

let baseLayer: HTMLCanvasElement | null = null;
let soilLayer: HTMLCanvasElement | null = null;
let greenLayer: HTMLCanvasElement | null = null;
let maskLayer: HTMLCanvasElement | null = null;

function terrainCellKey(gridX: number, gridY: number) {
  return `${gridX}:${gridY}`;
}

function ensureLayer(current: HTMLCanvasElement | null, viewport: GardenViewport) {
  const canvas = current ?? document.createElement("canvas");
  if (canvas.width !== viewport.width) canvas.width = viewport.width;
  if (canvas.height !== viewport.height) canvas.height = viewport.height;
  return canvas;
}

export function gridToWorld(gridX: number, gridY: number): WorldPoint {
  return {
    x: (gridX + 0.5) * GARDEN_CONFIG.tileSize,
    y: (gridY + 0.5) * GARDEN_CONFIG.tileSize,
  };
}

function getMaryScreenY(viewport: GardenViewport) {
  return viewport.height * GARDEN_CONFIG.maryScreenYRatio;
}

export function worldToScreen(
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number = GARDEN_CONFIG.defaultCameraZoom,
): WorldPoint {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  return {
    x: Math.round(viewport.width / 2 + (point.x - camera.x) * zoom),
    y: Math.round(
      getMaryScreenY(viewport) + (point.y - camera.y) * yScale * zoom,
    ),
  };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number = GARDEN_CONFIG.defaultCameraZoom,
) {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  const worldX = camera.x + (screenX - viewport.width / 2) / zoom;
  const worldY = camera.y + (screenY - getMaryScreenY(viewport)) / (yScale * zoom);
  return {
    gridX: Math.floor(worldX / GARDEN_CONFIG.tileSize),
    gridY: Math.floor(worldY / GARDEN_CONFIG.tileSize),
  };
}

function getVisibleGridBounds(
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const yScale = tileScreenHeight / tileSize;
  const halfWorldWidth = viewport.width / (2 * zoom);
  const minWorldY = camera.y - getMaryScreenY(viewport) / (yScale * zoom);
  const maxWorldY = camera.y + (viewport.height - getMaryScreenY(viewport)) / (yScale * zoom);
  return {
    minGridX: Math.floor((camera.x - halfWorldWidth) / tileSize) - 2,
    maxGridX: Math.ceil((camera.x + halfWorldWidth) / tileSize) + 2,
    minGridY: Math.floor(minWorldY / tileSize) - 2,
    maxGridY: Math.ceil(maxWorldY / tileSize) + 2,
  };
}

function drawGroundMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 3 * scale, y + 7 * scale, 3 * scale, scale);
  ctx.fillRect(x + 7 * scale, y + 6 * scale, 2 * scale, scale);
  ctx.fillRect(x + 10 * scale, y + 8 * scale, 3 * scale, scale);
}

function drawWeed(
  ctx: CanvasRenderingContext2D,
  weed: { grid_x: number; grid_y: number },
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const point = worldToScreen(
    gridToWorld(weed.grid_x, weed.grid_y),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "#756448";
  ctx.fillRect(-5, 3, 10, 2);
  ctx.fillStyle = "#56734e";
  ctx.fillRect(-1, -5, 2, 9);
  ctx.fillRect(-5, -2, 4, 2);
  ctx.fillRect(1, -1, 5, 2);
  ctx.fillStyle = "#7f9a61";
  ctx.fillRect(-4, -4, 3, 2);
  ctx.fillRect(2, -5, 3, 2);
  ctx.fillStyle = "#eee7cf";
  ctx.fillRect(-1, -7, 2, 2);
  ctx.restore();
}

function drawGardenWorm(
  ctx: CanvasRenderingContext2D,
  worm: { gridX: number; gridY: number; surfacedAt: number },
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  const point = worldToScreen(
    gridToWorld(worm.gridX, worm.gridY),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  const wiggle = Math.sin((now - worm.surfacedAt) / 260) * 1.5;
  ctx.save();
  ctx.translate(Math.round(point.x + wiggle), Math.round(point.y + 2));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#d88a72";
  ctx.fillRect(-6, -2, 4, 3);
  ctx.fillStyle = "#c46f5f";
  ctx.fillRect(-2, -3, 4, 3);
  ctx.fillStyle = "#a9514c";
  ctx.fillRect(2, -2, 5, 3);
  ctx.fillStyle = "#34231f";
  ctx.fillRect(5, -1, 1, 1);
  ctx.fillStyle = "rgba(255, 250, 224, 0.72)";
  ctx.fillRect(-8, 3, 16, 1);
  ctx.restore();
}

function getSuggestedPlantingScreen(
  cell: NonNullable<SelectedCell>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  return worldToScreen(
    gridToWorld(cell.gridX, cell.gridY),
    camera,
    viewport,
    zoom,
  );
}

function drawSuggestedPlantingHighlight(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const pulse = 0.84 + Math.sin(now / 180) * 0.12;
  const width = GARDEN_CONFIG.tileSize * zoom;
  const height = GARDEN_CONFIG.tileScreenHeight * zoom * 1.06;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y));
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(255, 217, 91, 0.42)";
  ctx.strokeStyle = "#b83136";
  ctx.lineWidth = Math.max(3, Math.round(3 * zoom));
  ctx.setLineDash([Math.max(5, 6 * zoom), Math.max(3, 4 * zoom)]);
  ctx.beginPath();
  ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSuggestedWateringHighlight(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const pulse = 0.78 + Math.sin(now / 170) * 0.18;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "rgba(142, 216, 238, 0.32)";
  ctx.strokeStyle = "#8ed8ee";
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 3]);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff4df";
  ctx.fillRect(-2, -18, 4, 7);
  ctx.fillRect(-4, -15, 8, 6);
  ctx.fillStyle = "#5aaac8";
  ctx.fillRect(-1, -17, 2, 5);
  ctx.restore();
}

function drawTutorialDimmer(
  ctx: CanvasRenderingContext2D,
  viewport: GardenViewport,
  mary: WorldPoint,
  camera: WorldPoint,
  zoom: number,
) {
  const maryScreen = worldToScreen(mary, camera, viewport, zoom);
  const innerRadius = Math.max(30, 38 * zoom);
  const outerRadius = Math.max(viewport.width, viewport.height) * 0.82;
  const vignette = ctx.createRadialGradient(
    maryScreen.x,
    maryScreen.y,
    innerRadius,
    maryScreen.x,
    maryScreen.y,
    outerRadius,
  );
  vignette.addColorStop(0, "rgba(52, 35, 31, 0.05)");
  vignette.addColorStop(0.2, "rgba(52, 35, 31, 0.13)");
  vignette.addColorStop(0.56, "rgba(52, 35, 31, 0.36)");
  vignette.addColorStop(1, "rgba(52, 35, 31, 0.5)");
  ctx.save();
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.restore();
}

function rectanglesOverlap(
  first: { left: number; top: number; right: number; bottom: number },
  second: { left: number; top: number; right: number; bottom: number },
) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function drawSuggestedPlantingLabel(
  ctx: CanvasRenderingContext2D,
  cell: SelectedCell,
  mary: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  if (!cell) return;
  const screen = getSuggestedPlantingScreen(cell, camera, viewport, zoom);
  const maryScreen = worldToScreen(mary, camera, viewport, zoom);
  const width = GARDEN_CONFIG.tileSize * zoom;
  const height = GARDEN_CONFIG.tileScreenHeight * zoom * 1.06;
  const labelWidth = Math.max(54, Math.round(62 * zoom));
  const labelHeight = Math.max(18, Math.round(19 * zoom));
  const gap = Math.max(16, Math.round(18 * zoom));
  const candidates = [
    { x: 0, y: -height / 2 - labelHeight - gap },
    { x: width / 2 + labelWidth / 2 + gap, y: -labelHeight / 2 },
    { x: -width / 2 - labelWidth / 2 - gap, y: -labelHeight / 2 },
    { x: 0, y: height / 2 + gap },
  ];
  const playerBounds = {
    left: maryScreen.x - screen.x - Math.max(16, 18 * zoom),
    right: maryScreen.x - screen.x + Math.max(16, 18 * zoom),
    top: maryScreen.y - screen.y - Math.max(34, 42 * zoom),
    bottom: maryScreen.y - screen.y + Math.max(10, 12 * zoom),
  };
  const padding = 8;
  const positionedCandidates = candidates.map((candidate) => ({
    x: Math.min(
      viewport.width - padding - screen.x - labelWidth / 2,
      Math.max(padding - screen.x + labelWidth / 2, candidate.x),
    ),
    y: Math.min(
      viewport.height - padding - screen.y - labelHeight,
      Math.max(padding - screen.y, candidate.y),
    ),
  }));
  const chosen = positionedCandidates.find((candidate) => {
    const bounds = {
      left: candidate.x - labelWidth / 2,
      top: candidate.y,
      right: candidate.x + labelWidth / 2,
      bottom: candidate.y + labelHeight,
    };
    return !rectanglesOverlap(bounds, playerBounds);
  });
  if (!chosen) return;
  const labelX = chosen.x;
  const labelY = chosen.y + Math.sin(now / 210) * 2;

  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y));
  ctx.globalAlpha = 0.96;
  ctx.strokeStyle = "#34231f";
  ctx.lineWidth = Math.max(2, Math.round(2 * zoom));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(
    Math.max(labelX - labelWidth / 2, Math.min(0, labelX + labelWidth / 2)),
    Math.max(labelY, Math.min(0, labelY + labelHeight)),
  );
  ctx.stroke();
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = "#fff4df";
  ctx.strokeStyle = "#34231f";
  ctx.lineWidth = 2;
  ctx.fillRect(labelX - labelWidth / 2, labelY, labelWidth, labelHeight);
  ctx.strokeRect(labelX - labelWidth / 2, labelY, labelWidth, labelHeight);
  ctx.fillStyle = "#b83136";
  ctx.font = `900 ${Math.max(8, Math.round(8 * zoom))}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PLANT HERE", labelX, labelY + labelHeight / 2 + 1);
  ctx.restore();
}

function drawBoundaryTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  gridX: number,
  gridY: number,
) {
  if (terrainNoise(gridX, gridY, 31) < 0.38) return;
  const offset = Math.round(terrainNoise(gridX, gridY, 37) * 5) * scale;
  ctx.fillStyle = "#b6b9b1";
  ctx.fillRect(x + 7 * scale, y + 7 * scale, 2 * scale, 6 * scale);
  ctx.fillStyle = terrainNoise(gridX, gridY, 41) > 0.5 ? "#cbd0c7" : "#c1c6bd";
  ctx.fillRect(x + 3 * scale + offset / 3, y + scale, 10 * scale, 7 * scale);
  ctx.fillRect(x + 5 * scale + offset / 3, y - 2 * scale, 6 * scale, 5 * scale);
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function isGrowingEdgeLockCell(
  gridX: number,
  gridY: number,
  regionX: number,
  regionY: number,
  openRegionKeys: ReadonlySet<string> | null,
) {
  if (!openRegionKeys) return false;
  const localX = positiveModulo(gridX, 16);
  const localY = positiveModulo(gridY, 16);
  const horizontalMarker = localX % 5 === 2;
  const verticalMarker = localY % 5 === 2;
  return (
    (localX === 0 && verticalMarker && openRegionKeys.has(`${regionX - 1}:${regionY}`)) ||
    (localX === 15 && verticalMarker && openRegionKeys.has(`${regionX + 1}:${regionY}`)) ||
    (localY === 0 && horizontalMarker && openRegionKeys.has(`${regionX}:${regionY - 1}`)) ||
    (localY === 15 && horizontalMarker && openRegionKeys.has(`${regionX}:${regionY + 1}`))
  );
}

function drawGrowingEdgeLock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
) {
  const unit = Math.max(0.75, zoom);
  const centerX = x + 8 * zoom;
  const centerY = y + 8 * zoom;
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "#fff4df";
  ctx.fillRect(centerX - 6 * unit, centerY - 7 * unit, 12 * unit, 13 * unit);
  ctx.fillStyle = "#5b3b2d";
  ctx.fillRect(centerX - 3 * unit, centerY - 5 * unit, unit, 4 * unit);
  ctx.fillRect(centerX + 2 * unit, centerY - 5 * unit, unit, 4 * unit);
  ctx.fillRect(centerX - 2 * unit, centerY - 6 * unit, 4 * unit, unit);
  ctx.fillRect(centerX - 4 * unit, centerY - unit, 8 * unit, 6 * unit);
  ctx.fillStyle = "#f3d88d";
  ctx.fillRect(centerX - 0.5 * unit, centerY + unit, unit, 2 * unit);
  ctx.restore();
}

function drawGuidanceZoneBoundary(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  gridX: number,
  gridY: number,
  regionX: number,
  regionY: number,
  guidanceZones: ReadonlyMap<string, "heart" | "growth-ring">,
) {
  const zone = guidanceZones.get(`${regionX}:${regionY}`);
  if (!zone) return;
  const localX = positiveModulo(gridX, 16);
  const localY = positiveModulo(gridY, 16);
  const thickness = Math.max(1, Math.round(1.25 * zoom));
  const cellWidth = GARDEN_CONFIG.tileSize * zoom;
  const cellHeight = GARDEN_CONFIG.tileScreenHeight * zoom;
  const color = zone === "heart" ? "#607b55" : "#c3a443";
  ctx.save();
  ctx.globalAlpha = zone === "heart" ? 0.42 : 0.56;
  ctx.fillStyle = color;
  if (
    localX === 0 &&
    guidanceZones.get(`${regionX - 1}:${regionY}`) !== zone
  ) {
    ctx.fillRect(x, y, thickness, cellHeight + 1);
  }
  if (
    localX === 15 &&
    guidanceZones.get(`${regionX + 1}:${regionY}`) !== zone
  ) {
    ctx.fillRect(x + cellWidth - thickness, y, thickness, cellHeight + 1);
  }
  if (
    localY === 0 &&
    guidanceZones.get(`${regionX}:${regionY - 1}`) !== zone
  ) {
    ctx.fillRect(x, y, cellWidth + 1, thickness);
  }
  if (
    localY === 15 &&
    guidanceZones.get(`${regionX}:${regionY + 1}`) !== zone
  ) {
    ctx.fillRect(x, y + cellHeight - thickness, cellWidth + 1, thickness);
  }
  ctx.restore();
}

function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  layer: TerrainLayer,
  zoom: number,
  occupiedCells: Set<string>,
  openRegionKeys: ReadonlySet<string> | null,
  growingEdgeStages: ReadonlyMap<string, "edge" | "growing" | "ready">,
  guidanceZones: ReadonlyMap<string, "heart" | "growth-ring">,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const cellWidth = tileSize * zoom;
  const cellHeight = tileScreenHeight * zoom;
  const visible = getVisibleGridBounds(camera, viewport, zoom);
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  if (layer === "base") {
    ctx.fillStyle = "#e8e1d3";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  for (let gridY = visible.minGridY; gridY <= visible.maxGridY; gridY += 1) {
    for (let gridX = visible.minGridX; gridX <= visible.maxGridX; gridX += 1) {
      const topLeft = worldToScreen(
        { x: gridX * tileSize, y: gridY * tileSize },
        camera,
          viewport,
          zoom,
      );
      const x = Math.floor(topLeft.x);
      const y = Math.floor(topLeft.y);

      const regionX = Math.floor(gridX / 16);
      const regionY = Math.floor(gridY / 16);
      const regionKey = `${regionX}:${regionY}`;
      const isOpen = openRegionKeys
        ? openRegionKeys.has(regionKey)
        : isWithinGarden(gridX, gridY);
      if (!isOpen) {
        if (layer === "base") {
          const growingStage = growingEdgeStages.get(regionKey);
          ctx.fillStyle = growingStage ? "#ded5b9" : "#d9d5ca";
          ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
          if (growingStage) {
            const atRegionEdge =
              Math.abs(gridX % 16) <= 1 ||
              Math.abs(gridY % 16) <= 1 ||
              Math.abs(gridX % 16) >= 14 ||
              Math.abs(gridY % 16) >= 14;
            if (atRegionEdge && terrainNoise(gridX, gridY, 67) > 0.62) {
              ctx.fillStyle = growingStage === "ready" ? "#d9ad42" : "#c9aa5c";
              ctx.fillRect(x + 6 * zoom, y + 7 * zoom, 4 * zoom, Math.max(1, zoom));
            }
            if (
              isGrowingEdgeLockCell(
                gridX,
                gridY,
                regionX,
                regionY,
                openRegionKeys,
              )
            ) {
              drawGrowingEdgeLock(ctx, x, y, zoom);
            }
          } else {
            drawBoundaryTree(ctx, x, y, zoom, gridX, gridY);
          }
        }
        continue;
      }

      const tile = getTerrainTile(gridX, gridY);
      const occupied = occupiedCells.has(terrainCellKey(gridX, gridY));
      if (layer === "soil") {
        ctx.fillStyle = "#bd936e";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      } else if (layer === "green") {
        const guidanceZone = guidanceZones.get(regionKey);
        ctx.fillStyle =
          guidanceZone === "heart"
            ? "#96aa7c"
            : guidanceZone === "growth-ring"
              ? "#a8b184"
              : "#9ca67a";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      }

      if (!occupied && tile.detail <= 2) {
        if (layer === "green") {
          if (tile.detail === 0) {
            ctx.fillStyle = "#65714e";
            ctx.fillRect(x + 4 * zoom, y + 8 * zoom, 3 * zoom, zoom);
            ctx.fillRect(x + 11 * zoom, y + 6 * zoom, zoom, zoom);
          }
        } else {
          const detailColor = layer === "base" ? "#b9b3a8" : "#8e6b53";
          drawGroundMark(ctx, x, y, zoom, detailColor);
        }
      } else if (!occupied && tile.detail === 5) {
        ctx.fillStyle =
          layer === "base" ? "#c4bdb1" : layer === "soil" ? "#9b765b" : "#74805e";
        ctx.fillRect(x + 3 * zoom, y + 6 * zoom, 5 * zoom, zoom);
        ctx.fillRect(x + 8 * zoom, y + 7 * zoom, 4 * zoom, zoom);
      }

      if (layer === "green" && !occupied && (tile.accent === 1 || tile.accent === 4)) {
        const warmBloom = terrainNoise(gridX, gridY, 19) > 0.5;
        ctx.fillStyle =
          tile.accent === 4 ? "#6f9995" : warmBloom ? "#dfb85f" : "#df7b70";
        ctx.fillRect(x + 11 * zoom, y + 4 * zoom, 2 * zoom, 2 * zoom);
        ctx.fillStyle = "#5d6d49";
        ctx.fillRect(x + 12 * zoom, y + 6 * zoom, zoom, 2 * zoom);
        if (tile.accent === 4) {
          ctx.fillStyle = "#dca08b";
          ctx.fillRect(x + 4 * zoom, y + 8 * zoom, 2 * zoom, 2 * zoom);
        }
      }

      if (layer === "green") {
        drawGuidanceZoneBoundary(
          ctx,
          x,
          y,
          zoom,
          gridX,
          gridY,
          regionX,
          regionY,
          guidanceZones,
        );
      }
    }
  }
}

function drawPersonalTerrain(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  minX: number,
  minY: number,
  width: number,
  height: number,
  nextExpansion: NonNullable<RenderGardenState["personalGarden"]>["nextExpansion"],
  shareOnly = false,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const cellWidth = tileSize * zoom;
  const cellHeight = tileScreenHeight * zoom;
  const visible = getVisibleGridBounds(camera, viewport, zoom);

  if (shareOnly) {
    ctx.clearRect(0, 0, viewport.width, viewport.height);
  } else {
    ctx.fillStyle = "#234b35";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  for (let gridY = visible.minGridY; gridY <= visible.maxGridY; gridY += 1) {
    for (let gridX = visible.minGridX; gridX <= visible.maxGridX; gridX += 1) {
      const topLeft = worldToScreen(
        { x: gridX * tileSize, y: gridY * tileSize },
        camera,
        viewport,
        zoom,
      );
      const x = Math.floor(topLeft.x);
      const y = Math.floor(topLeft.y);
      const maxX = minX + width - 1;
      const maxY = minY + height - 1;
      const inProperty =
        gridX >= minX && gridX <= maxX && gridY >= minY && gridY <= maxY;
      const inExpansion =
        nextExpansion &&
        gridX >= nextExpansion.minX &&
        gridX < nextExpansion.minX + nextExpansion.width &&
        gridY >= nextExpansion.minY &&
        gridY < nextExpansion.minY + nextExpansion.height;

      if (shareOnly && !inProperty) continue;

      if (inProperty) {
        ctx.fillStyle = (gridX + gridY) % 2 === 0 ? "#91ad78" : "#98b47f";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      } else if (!shareOnly) {
        // A continuous, lightweight canopy replaces the old white grid. The
        // next parcel is still forested until it is unlocked, when the normal
        // playable lawn automatically replaces it.
        ctx.fillStyle = inExpansion ? "#315d42" : "#274f38";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
        const canopy = terrainNoise(gridX, gridY, 211);
        if (canopy > 0.33) {
          ctx.fillStyle = canopy > 0.72 ? "#173c2b" : "#3c6948";
          const inset = Math.max(1, Math.round(2 * zoom));
          ctx.fillRect(
            x + inset,
            y + inset,
            Math.max(2, cellWidth - inset * 2),
            Math.max(2, cellHeight - inset * 2),
          );
          if (canopy > 0.82) {
            ctx.fillStyle = "#527858";
            ctx.fillRect(
              x + Math.round(6 * zoom),
              y + Math.round(3 * zoom),
              Math.max(1, Math.round(3 * zoom)),
              Math.max(1, Math.round(2 * zoom)),
            );
          }
        }
      }

      if (inProperty && terrainNoise(gridX, gridY, 73) > 0.66) {
        drawGroundMark(ctx, x, y, zoom, "#6f895d");
      }
    }
  }
}

function drawHeritageAura(
  ctx: CanvasRenderingContext2D,
  plants: ReadonlyArray<PlantRecord>,
  selected: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  if (!selected) return;
  const anchor = findHeritageAuraAnchor(
    plants,
    selected.gridX,
    selected.gridY,
  );
  if (!anchor) return;

  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const width = tileSize * zoom;
  const height = tileScreenHeight * zoom;
  ctx.save();
  ctx.lineWidth = Math.max(1, zoom);

  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
      if (distance === 0 || distance > 2) continue;
      const topLeft = worldToScreen(
        {
          x: (anchor.grid_x + offsetX) * tileSize,
          y: (anchor.grid_y + offsetY) * tileSize,
        },
        camera,
        viewport,
        zoom,
      );
      ctx.fillStyle =
        distance === 1 ? "rgba(232, 191, 85, 0.16)" : "rgba(232, 191, 85, 0.08)";
      ctx.strokeStyle =
        distance === 1 ? "rgba(255, 220, 125, 0.72)" : "rgba(255, 220, 125, 0.42)";
      ctx.setLineDash(distance === 1 ? [] : [Math.max(2, 3 * zoom), Math.max(2, 3 * zoom)]);
      ctx.fillRect(topLeft.x, topLeft.y, width, height);
      ctx.strokeRect(
        topLeft.x + 0.5,
        topLeft.y + 0.5,
        Math.max(1, width - 1),
        Math.max(1, height - 1),
      );
    }
  }

  const anchorTopLeft = worldToScreen(
    { x: anchor.grid_x * tileSize, y: anchor.grid_y * tileSize },
    camera,
    viewport,
    zoom,
  );
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 229, 146, 0.92)";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.strokeRect(
    anchorTopLeft.x + 1,
    anchorTopLeft.y + 1,
    Math.max(1, width - 2),
    Math.max(1, height - 2),
  );
  ctx.restore();
}

function drawPersonalPaths(
  ctx: CanvasRenderingContext2D,
  paths: Array<{ gridX: number; gridY: number }>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  for (const path of paths) {
    const topLeft = worldToScreen(
      { x: path.gridX * tileSize, y: path.gridY * tileSize },
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(topLeft, viewport, tileSize * zoom)) continue;

    const inset = Math.max(1, zoom);
    const width = tileSize * zoom;
    const height = tileScreenHeight * zoom;
    ctx.save();
    ctx.fillStyle =
      (path.gridX + path.gridY) % 2 === 0 ? "#c7aa7c" : "#cfb589";
    ctx.fillRect(
      Math.floor(topLeft.x + inset),
      Math.floor(topLeft.y + inset),
      Math.ceil(width - inset * 2),
      Math.ceil(height - inset * 2),
    );
    ctx.fillStyle = "rgba(116, 86, 60, 0.34)";
    ctx.fillRect(
      Math.floor(topLeft.x + 4 * zoom),
      Math.floor(topLeft.y + 4 * zoom),
      Math.max(2, 3 * zoom),
      Math.max(1, zoom),
    );
    ctx.fillRect(
      Math.floor(topLeft.x + 10 * zoom),
      Math.floor(topLeft.y + 8 * zoom),
      Math.max(2, 2 * zoom),
      Math.max(1, zoom),
    );
    ctx.restore();
  }
}

function drawPixelShed(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const point = worldToScreen(
    {
      x: 6.5 * GARDEN_CONFIG.tileSize,
      y: 0,
    },
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport, 110)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "#6d4638";
  ctx.fillRect(-24, -35, 48, 34);
  ctx.fillStyle = "#c78358";
  ctx.fillRect(-21, -32, 42, 31);
  ctx.fillStyle = "#8f4642";
  ctx.fillRect(-29, -42, 58, 12);
  ctx.fillRect(-20, -48, 40, 7);
  ctx.fillStyle = "#e4c77d";
  ctx.fillRect(-15, -24, 12, 11);
  ctx.fillStyle = "#49362e";
  ctx.fillRect(4, -26, 12, 25);
  ctx.fillStyle = "#e7b84e";
  ctx.fillRect(12, -14, 2, 2);
  ctx.fillStyle = "#5f4639";
  ctx.fillRect(20, -50, 7, 13);
  ctx.restore();
}

function drawLockedParcel(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  minX: number,
  minY: number,
  width: number,
  height: number,
  nextExpansion: NonNullable<RenderGardenState["personalGarden"]>["nextExpansion"],
) {
  if (!nextExpansion) return;
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const currentMaxX = minX + width - 1;
  const currentMaxY = minY + height - 1;
  const nextMaxX = nextExpansion.minX + nextExpansion.width - 1;
  const nextMaxY = nextExpansion.minY + nextExpansion.height - 1;
  let parcelMinX = minX;
  let parcelMinY = minY;
  let parcelColumns = width;
  let parcelRows = height;

  if (nextExpansion.minX < minX) {
    parcelMinX = nextExpansion.minX;
    parcelMinY = nextExpansion.minY;
    parcelColumns = minX - nextExpansion.minX;
    parcelRows = nextExpansion.height;
  } else if (nextMaxX > currentMaxX) {
    parcelMinX = currentMaxX + 1;
    parcelMinY = nextExpansion.minY;
    parcelColumns = nextMaxX - currentMaxX;
    parcelRows = nextExpansion.height;
  } else if (nextExpansion.minY < minY) {
    parcelMinX = nextExpansion.minX;
    parcelMinY = nextExpansion.minY;
    parcelColumns = nextExpansion.width;
    parcelRows = minY - nextExpansion.minY;
  } else if (nextMaxY > currentMaxY) {
    parcelMinX = nextExpansion.minX;
    parcelMinY = currentMaxY + 1;
    parcelColumns = nextExpansion.width;
    parcelRows = nextMaxY - currentMaxY;
  }

  const parcelTopLeft = worldToScreen(
    {
      x: parcelMinX * tileSize,
      y: parcelMinY * tileSize,
    },
    camera,
    viewport,
    zoom,
  );
  const parcelX = parcelTopLeft.x;
  const parcelY = parcelTopLeft.y;
  const parcelWidth = parcelColumns * tileSize * zoom;
  const parcelHeight = parcelRows * tileScreenHeight * zoom;

  ctx.save();
  ctx.fillStyle = "rgba(239, 211, 142, 0.14)";
  ctx.fillRect(parcelX, parcelY, parcelWidth, parcelHeight);
  ctx.strokeStyle = "#d49a38";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.setLineDash([5 * zoom, 3 * zoom]);
  ctx.strokeRect(parcelX, parcelY, parcelWidth, parcelHeight);
  ctx.restore();

  const labelPoint = {
    x: parcelX + parcelWidth / 2,
    y: parcelY + parcelHeight / 2,
  };
  if (!isVisible(labelPoint, viewport, 70)) return;

  ctx.save();
  ctx.translate(Math.round(labelPoint.x), Math.round(labelPoint.y));
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "rgba(255, 244, 223, 0.9)";
  ctx.fillRect(-28, -11, 56, 22);
  ctx.strokeStyle = "#8a623f";
  ctx.lineWidth = 1;
  ctx.strokeRect(-28, -11, 56, 22);
  ctx.fillStyle = "#8a623f";
  ctx.fillRect(-22, -3, 8, 8);
  ctx.strokeRect(-21, -7, 6, 6);
  ctx.fillStyle = "#5f4437";
  ctx.font = '700 7px "Courier New", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${nextExpansion.careCost} CARE`, -9, 1);
  ctx.restore();
}

function drawPersonalFence(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  minX: number,
  minY: number,
  width: number,
  height: number,
  stonePosts: boolean,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const topLeft = worldToScreen(
    { x: minX * tileSize, y: minY * tileSize },
    camera,
    viewport,
    zoom,
  );
  const fenceWidth = width * tileSize * zoom;
  const fenceHeight = height * tileScreenHeight * zoom;

  ctx.save();
  ctx.strokeStyle = stonePosts ? "#776f65" : "#8b6043";
  ctx.lineWidth = Math.max(2, 2 * zoom);
  ctx.strokeRect(
    Math.floor(topLeft.x),
    Math.floor(topLeft.y),
    fenceWidth,
    fenceHeight,
  );

  const postColor = stonePosts ? "#b7afa2" : "#704b36";
  ctx.fillStyle = postColor;
  const postWidth = Math.max(3, 3 * zoom);
  const postHeight = Math.max(7, 8 * zoom);
  for (let column = 0; column <= width; column += 1) {
    const x = topLeft.x + column * tileSize * zoom;
    ctx.fillRect(x - postWidth / 2, topLeft.y - postHeight / 2, postWidth, postHeight);
    ctx.fillRect(
      x - postWidth / 2,
      topLeft.y + fenceHeight - postHeight / 2,
      postWidth,
      postHeight,
    );
  }
  for (let row = 1; row < height; row += 1) {
    const y = topLeft.y + row * tileScreenHeight * zoom;
    ctx.fillRect(topLeft.x - postWidth / 2, y - postHeight / 2, postWidth, postHeight);
    ctx.fillRect(
      topLeft.x + fenceWidth - postWidth / 2,
      y - postHeight / 2,
      postWidth,
      postHeight,
    );
  }
  ctx.restore();
}

function drawPersonalDecorations(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  minX: number,
  minY: number,
  width: number,
  height: number,
  nextExpansion: NonNullable<RenderGardenState["personalGarden"]>["nextExpansion"],
) {
  drawLockedParcel(
    ctx,
    camera,
    viewport,
    zoom,
    minX,
    minY,
    width,
    height,
    nextExpansion,
  );
  drawPersonalFence(
    ctx,
    camera,
    viewport,
    zoom,
    minX,
    minY,
    width,
    height,
    false,
  );
}

type PersonalGardenElement = NonNullable<
  RenderGardenState["personalGarden"]
>["elements"][number];

function drawPersonalElement(
  ctx: CanvasRenderingContext2D,
  element: PersonalGardenElement,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  now: number,
) {
  const definition = getMyGardenElement(element.elementType);
  const centerGridX = element.gridX + (definition.footprintWidth - 1) / 2;
  const centerGridY = element.gridY + (definition.footprintHeight - 1) / 2;
  const point = worldToScreen(
    gridToWorld(centerGridX, centerGridY),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);

  if (
    element.elementType === "stone_paver" ||
    element.elementType === "gravel_tile" ||
    element.elementType === "brick_paver"
  ) {
    if (element.elementType === "brick_paver") {
      ctx.fillStyle = "#8f5542";
      ctx.fillRect(-8, -5, 16, 9);
      ctx.fillStyle = "#c9825e";
      ctx.fillRect(-7, -4, 6, 3);
      ctx.fillRect(1, -4, 6, 3);
      ctx.fillRect(-5, 0, 7, 3);
      ctx.fillRect(4, 0, 3, 3);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#817b70";
    ctx.fillRect(-7, -5, 14, 9);
    ctx.fillStyle =
      element.elementType === "gravel_tile" ? "#a79f8e" : "#bdb6a9";
    ctx.fillRect(-6, -4, 12, 7);
    ctx.fillStyle = "#d8d1c4";
    if (element.elementType === "gravel_tile") {
      ctx.fillRect(-4, -2, 2, 2);
      ctx.fillRect(2, 0, 3, 2);
      ctx.fillRect(1, -4, 2, 2);
    } else {
      ctx.fillRect(-4, -3, 5, 2);
    }
  } else if (element.elementType === "birdhouse") {
    ctx.fillStyle = "#704b39";
    ctx.fillRect(-2, -20, 4, 21);
    ctx.fillStyle = "#e0b76d";
    ctx.fillRect(-8, -31, 16, 12);
    ctx.fillStyle = "#954a45";
    ctx.fillRect(-10, -35, 20, 5);
    ctx.fillStyle = "#4a372e";
    ctx.fillRect(-2, -28, 5, 5);
  } else if (
    element.elementType === "bench" ||
    element.elementType === "rustic_bench"
  ) {
    const halfWidth = element.elementType === "rustic_bench" ? 17 : 10;
    ctx.fillStyle = "#603b31";
    ctx.fillRect(-halfWidth, -13, halfWidth * 2, 4);
    ctx.fillRect(-halfWidth, -7, halfWidth * 2, 4);
    ctx.fillRect(-halfWidth + 2, -3, 3, 8);
    ctx.fillRect(halfWidth - 5, -3, 3, 8);
    ctx.fillStyle = "#9e6445";
    ctx.fillRect(-halfWidth + 1, -12, halfWidth * 2 - 2, 2);
    ctx.fillRect(-halfWidth + 1, -6, halfWidth * 2 - 2, 2);
  } else if (element.elementType === "clay_pot") {
    ctx.fillStyle = "#8f4f38";
    ctx.fillRect(-6, -9, 12, 4);
    ctx.fillStyle = "#b96b48";
    ctx.fillRect(-5, -5, 10, 8);
    ctx.fillStyle = "#55704d";
    ctx.fillRect(-1, -15, 2, 7);
    ctx.fillRect(-5, -13, 4, 3);
    ctx.fillRect(1, -16, 5, 3);
  } else if (
    element.elementType === "hedge" ||
    element.elementType === "fern" ||
    element.elementType === "hydrangea" ||
    element.elementType === "butterfly_bush"
  ) {
    const bloom =
      element.elementType === "hydrangea"
        ? "#8f8dbc"
        : element.elementType === "butterfly_bush"
          ? "#b86f9e"
          : null;
    ctx.fillStyle =
      element.elementType === "fern" ? "#4f714d" : "#526e45";
    ctx.fillRect(-8, -10, 16, 12);
    ctx.fillRect(-5, -15, 10, 6);
    ctx.fillStyle = "#78905b";
    ctx.fillRect(-7, -12, 5, 5);
    ctx.fillRect(2, -14, 6, 6);
    if (bloom) {
      ctx.fillStyle = bloom;
      ctx.fillRect(-6, -15, 5, 4);
      ctx.fillRect(1, -17, 6, 5);
    }
  } else if (element.elementType === "wheelbarrow") {
    ctx.fillStyle = "#6e4a35";
    ctx.fillRect(-12, -7, 17, 7);
    ctx.fillStyle = "#9f6a43";
    ctx.fillRect(-10, -9, 14, 4);
    ctx.fillStyle = "#413c34";
    ctx.fillRect(5, 0, 6, 3);
    ctx.fillRect(-9, 1, 5, 5);
    ctx.fillStyle = "#b58a5a";
    ctx.fillRect(4, -3, 11, 2);
  } else if (element.elementType === "wooden_planter") {
    ctx.fillStyle = "#684334";
    ctx.fillRect(-17, -8, 34, 10);
    ctx.fillStyle = "#a26a43";
    ctx.fillRect(-15, -6, 30, 6);
    ctx.fillStyle = "#4f6b43";
    for (let x = -12; x <= 12; x += 6) ctx.fillRect(x, -13, 3, 7);
  } else if (
    element.elementType === "bird_feeder" ||
    element.elementType === "butterfly_house"
  ) {
    ctx.fillStyle = "#654838";
    ctx.fillRect(-2, -19, 4, 20);
    ctx.fillStyle =
      element.elementType === "butterfly_house" ? "#c47a45" : "#d0a65e";
    ctx.fillRect(-7, -27, 14, 10);
    ctx.fillStyle = "#49352e";
    ctx.fillRect(-9, -29, 18, 3);
    ctx.fillRect(-1, -24, 2, 5);
  } else if (
    element.elementType === "trellis" ||
    element.elementType === "rose_trellis"
  ) {
    const width = element.elementType === "rose_trellis" ? 30 : 18;
    ctx.fillStyle = "#8b6848";
    ctx.fillRect(-width / 2, -30, 3, 32);
    ctx.fillRect(width / 2 - 3, -30, 3, 32);
    ctx.fillRect(-width / 2, -29, width, 3);
    ctx.fillRect(-width / 2, -18, width, 2);
    ctx.fillRect(-width / 2, -8, width, 2);
    if (element.elementType === "rose_trellis") {
      ctx.fillStyle = "#59734b";
      ctx.fillRect(-13, -26, 5, 22);
      ctx.fillRect(7, -25, 5, 20);
      ctx.fillStyle = "#d94a4e";
      ctx.fillRect(-14, -25, 6, 5);
      ctx.fillRect(7, -21, 7, 5);
      ctx.fillRect(-5, -13, 6, 5);
    }
  } else if (
    element.elementType === "pollinator_sign" ||
    element.elementType === "beehive"
  ) {
    if (element.elementType === "pollinator_sign") {
      ctx.fillStyle = "#674736";
      ctx.fillRect(-2, -17, 4, 18);
      ctx.fillStyle = "#ead69a";
      ctx.fillRect(-10, -26, 20, 11);
      ctx.fillStyle = "#6e8a50";
      ctx.fillRect(-6, -22, 12, 3);
    } else {
      ctx.fillStyle = "#71513b";
      ctx.fillRect(-8, -3, 3, 6);
      ctx.fillRect(5, -3, 3, 6);
      ctx.fillStyle = "#dfb84d";
      ctx.fillRect(-10, -18, 20, 16);
      ctx.fillStyle = "#a57b37";
      ctx.fillRect(-10, -14, 20, 2);
      ctx.fillRect(-10, -8, 20, 2);
      ctx.fillStyle = "#4b3b31";
      ctx.fillRect(-2, -6, 4, 4);
      const wing = Math.floor(now / 180) % 2;
      ctx.fillStyle = "#f2cf47";
      ctx.fillRect(12, -18 + wing, 3, 2);
      ctx.fillRect(-15, -12 - wing, 3, 2);
    }
  } else if (element.elementType === "reeds") {
    ctx.fillStyle = "#55724d";
    ctx.fillRect(-6, -18, 2, 19);
    ctx.fillRect(-1, -22, 2, 23);
    ctx.fillRect(5, -15, 2, 16);
    ctx.fillStyle = "#7a583b";
    ctx.fillRect(-7, -21, 4, 5);
    ctx.fillRect(-2, -25, 4, 5);
    ctx.fillRect(4, -18, 4, 5);
  } else if (element.elementType === "lily_pads") {
    ctx.fillStyle = "#5f8659";
    ctx.fillRect(-10, -4, 9, 7);
    ctx.fillRect(1, -3, 10, 7);
    ctx.fillStyle = "#eee4ce";
    ctx.fillRect(3, -8, 5, 5);
    ctx.fillStyle = "#d9a1ad";
    ctx.fillRect(4, -7, 3, 3);
  } else if (
    element.elementType === "birdbath" ||
    element.elementType === "stone_basin"
  ) {
    const wide = element.elementType === "stone_basin";
    ctx.fillStyle = "#79776e";
    ctx.fillRect(-2, -12, 4, 14);
    ctx.fillRect(-6, 0, 12, 3);
    ctx.fillStyle = "#aaa99d";
    ctx.fillRect(wide ? -13 : -9, -17, wide ? 26 : 18, 6);
    ctx.fillStyle = "#68b8cf";
    ctx.fillRect(wide ? -10 : -6, -16, wide ? 20 : 12, 2);
  } else if (element.elementType === "willow_tree") {
    ctx.fillStyle = "#604936";
    ctx.fillRect(-4, -25, 8, 28);
    ctx.fillStyle = "#597849";
    ctx.fillRect(-17, -39, 34, 18);
    ctx.fillRect(-12, -24, 5, 16);
    ctx.fillRect(8, -26, 5, 18);
    ctx.fillStyle = "#86a668";
    ctx.fillRect(-13, -37, 12, 7);
    ctx.fillRect(2, -35, 12, 7);
  } else if (element.elementType === "fountain") {
    const splash = Math.floor(now / 220) % 3;
    ctx.fillStyle = "#77766f";
    ctx.fillRect(-15, -4, 30, 7);
    ctx.fillStyle = "#aaa99e";
    ctx.fillRect(-12, -10, 24, 7);
    ctx.fillRect(-3, -24, 6, 15);
    ctx.fillStyle = "#62c2df";
    ctx.fillRect(-1, -31 - splash, 2, 12);
    ctx.fillRect(-7, -23 + splash, 3, 5);
    ctx.fillRect(5, -23 + splash, 3, 5);
  } else if (element.elementType === "small_pond") {
    ctx.fillStyle = "#69675d";
    ctx.fillRect(-25, -8, 50, 15);
    ctx.fillStyle = "#69afbd";
    ctx.fillRect(-22, -6, 44, 11);
    ctx.fillStyle = "#91d0d5";
    ctx.fillRect(-14, -4, 17, 2);
    ctx.fillStyle = "#638757";
    ctx.fillRect(8, -4, 7, 5);
  } else if (element.elementType === "woodland_shrub") {
    ctx.fillStyle = "#3f5e3e";
    ctx.fillRect(-11, -10, 22, 11);
    ctx.fillRect(-7, -15, 14, 7);
    ctx.fillStyle = "#6f8a58";
    ctx.fillRect(-9, -12, 7, 5);
    ctx.fillRect(2, -14, 7, 6);
    ctx.fillStyle = "#b86c67";
    ctx.fillRect(-5, -10, 2, 2);
    ctx.fillRect(5, -8, 2, 2);
  } else if (element.elementType === "log_bench") {
    ctx.fillStyle = "#4f392d";
    ctx.fillRect(-19, -9, 38, 9);
    ctx.fillRect(-15, 0, 5, 6);
    ctx.fillRect(10, 0, 5, 6);
    ctx.fillStyle = "#9a6740";
    ctx.fillRect(-18, -8, 36, 5);
    ctx.fillStyle = "#c08a55";
    ctx.fillRect(-14, -7, 17, 2);
  } else if (
    element.elementType === "pine_tree" ||
    element.elementType === "maple_tree" ||
    element.elementType === "flowering_tree" ||
    element.elementType === "grand_oak"
  ) {
    const grand = element.elementType === "grand_oak";
    ctx.fillStyle = "#5b4332";
    ctx.fillRect(grand ? -6 : -4, grand ? -36 : -28, grand ? 12 : 8, grand ? 39 : 31);
    ctx.fillStyle = "#825c3c";
    ctx.fillRect(grand ? -3 : -2, grand ? -34 : -26, grand ? 5 : 4, grand ? 35 : 27);
    if (element.elementType === "pine_tree") {
      ctx.fillStyle = "#335744";
      ctx.fillRect(-8, -51, 16, 11);
      ctx.fillRect(-15, -43, 30, 12);
      ctx.fillRect(-21, -33, 42, 13);
      ctx.fillStyle = "#58765a";
      ctx.fillRect(-5, -49, 9, 7);
      ctx.fillRect(-11, -40, 13, 6);
    } else {
      const canopy =
        element.elementType === "maple_tree"
          ? "#a95c3f"
          : element.elementType === "flowering_tree"
            ? "#6d8657"
            : "#476b45";
      const light =
        element.elementType === "maple_tree"
          ? "#d0834f"
          : element.elementType === "flowering_tree"
            ? "#88a56c"
            : "#6e8c58";
      const halfWidth = grand ? 30 : 22;
      const top = grand ? -58 : -48;
      ctx.fillStyle = canopy;
      ctx.fillRect(-halfWidth, top + 10, halfWidth * 2, grand ? 26 : 22);
      ctx.fillRect(-(halfWidth - 8), top, (halfWidth - 8) * 2, 16);
      ctx.fillStyle = light;
      ctx.fillRect(-halfWidth + 5, top + 5, 16, 10);
      ctx.fillRect(3, top + 12, halfWidth - 4, 9);
      if (element.elementType === "flowering_tree") {
        ctx.fillStyle = "#f0b7c1";
        ctx.fillRect(-17, top + 8, 7, 6);
        ctx.fillRect(-2, top + 2, 8, 6);
        ctx.fillRect(13, top + 15, 7, 6);
        ctx.fillStyle = "#d97891";
        ctx.fillRect(-15, top + 10, 3, 3);
        ctx.fillRect(0, top + 4, 3, 3);
      }
    }
  } else if (element.elementType === "bonsai_tree") {
    ctx.fillStyle = "#8f5940";
    ctx.fillRect(-10, -6, 20, 7);
    ctx.fillStyle = "#bc7951";
    ctx.fillRect(-8, 1, 16, 4);
    ctx.fillStyle = "#5e4433";
    ctx.fillRect(-2, -22, 4, 17);
    ctx.fillRect(-8, -18, 8, 3);
    ctx.fillRect(1, -25, 8, 3);
    ctx.fillStyle = "#476b45";
    ctx.fillRect(-13, -25, 15, 9);
    ctx.fillRect(0, -31, 15, 11);
    ctx.fillStyle = "#77915f";
    ctx.fillRect(-10, -24, 7, 4);
    ctx.fillRect(4, -29, 8, 5);
  } else if (element.elementType === "compost_bin") {
    ctx.fillStyle = "#4f3b30";
    ctx.fillRect(-12, -18, 24, 20);
    ctx.fillStyle = "#8b6645";
    ctx.fillRect(-10, -16, 20, 4);
    ctx.fillRect(-10, -9, 20, 4);
    ctx.fillRect(-10, -2, 20, 3);
    ctx.fillStyle = "#60764c";
    ctx.fillRect(-6, -21, 5, 4);
    ctx.fillRect(2, -23, 7, 5);
  } else if (element.elementType === "potting_table") {
    ctx.fillStyle = "#654637";
    ctx.fillRect(-20, -18, 40, 5);
    ctx.fillRect(-17, -13, 4, 17);
    ctx.fillRect(13, -13, 4, 17);
    ctx.fillRect(-16, -5, 32, 4);
    ctx.fillStyle = "#a06b45";
    ctx.fillRect(-19, -17, 38, 3);
    ctx.fillStyle = "#b76c49";
    ctx.fillRect(-12, -25, 9, 8);
    ctx.fillStyle = "#536f4a";
    ctx.fillRect(-10, -29, 5, 5);
  } else if (element.elementType === "raised_bed") {
    ctx.fillStyle = "#5d4032";
    ctx.fillRect(-23, -11, 46, 15);
    ctx.fillStyle = "#9a6742";
    ctx.fillRect(-21, -9, 42, 11);
    ctx.fillStyle = "#79543a";
    ctx.fillRect(-18, -7, 36, 7);
    ctx.fillStyle = "#4f7047";
    for (let x = -14; x <= 14; x += 7) {
      ctx.fillRect(x, -17, 2, 10);
      ctx.fillRect(x - 3, -15, 4, 3);
    }
  } else if (element.elementType === "cold_frame") {
    ctx.fillStyle = "#6b4b37";
    ctx.fillRect(-20, -8, 40, 12);
    ctx.fillStyle = "#9fc7c5";
    ctx.fillRect(-17, -17, 34, 10);
    ctx.fillStyle = "#e6f0df";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-14, -15, 11, 7);
    ctx.fillRect(2, -15, 12, 7);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#5f5749";
    ctx.lineWidth = 2;
    ctx.strokeRect(-18, -18, 36, 11);
  } else if (element.elementType === "garden_shed") {
    ctx.fillStyle = "#70483a";
    ctx.fillRect(-25, -37, 50, 39);
    ctx.fillStyle = "#a9604e";
    ctx.fillRect(-29, -43, 58, 7);
    ctx.fillRect(-21, -48, 42, 6);
    ctx.fillStyle = "#d5b06a";
    ctx.fillRect(-18, -27, 13, 12);
    ctx.fillStyle = "#4a392f";
    ctx.fillRect(5, -28, 13, 30);
    ctx.fillStyle = "#efd38c";
    ctx.fillRect(14, -14, 2, 3);
  } else if (
    element.elementType === "small_greenhouse" ||
    element.elementType === "greenhouse_extension" ||
    element.elementType === "conservatory" ||
    element.elementType === "glass_pavilion" ||
    element.elementType === "botanical_glasshouse"
  ) {
    const botanical = element.elementType === "botanical_glasshouse";
    const pavilion = element.elementType === "glass_pavilion";
    const conservatory = element.elementType === "conservatory";
    const extension = element.elementType === "greenhouse_extension";
    const halfWidth = botanical ? 47 : conservatory || pavilion ? 37 : 29;
    const roofY = botanical ? -61 : conservatory ? -53 : pavilion ? -47 : -43;
    const baseY = 3;
    ctx.fillStyle = "#527163";
    ctx.fillRect(-halfWidth, baseY - 4, halfWidth * 2, 6);
    ctx.strokeStyle = botanical ? "#496f62" : "#5b786a";
    ctx.lineWidth = 3;
    ctx.strokeRect(-halfWidth, roofY + 18, halfWidth * 2, baseY - roofY - 18);
    ctx.beginPath();
    ctx.moveTo(-halfWidth, roofY + 18);
    ctx.lineTo(extension ? -halfWidth / 2 : 0, roofY);
    ctx.lineTo(halfWidth, roofY + 18);
    ctx.stroke();
    ctx.fillStyle = "#b9d7ce";
    ctx.globalAlpha = pavilion ? 0.4 : 0.32;
    ctx.fillRect(-halfWidth + 3, roofY + 21, halfWidth * 2 - 6, baseY - roofY - 25);
    ctx.globalAlpha = 1;
    const panes = botanical ? 5 : conservatory || pavilion ? 4 : 3;
    for (let pane = 1; pane < panes; pane += 1) {
      const x = -halfWidth + (halfWidth * 2 * pane) / panes;
      ctx.fillStyle = "#5b786a";
      ctx.fillRect(Math.round(x), roofY + 19, 2, baseY - roofY - 18);
    }
    ctx.fillStyle = "#4f7047";
    ctx.fillRect(-halfWidth + 8, -11, 10, 13);
    ctx.fillRect(halfWidth - 18, -16, 11, 18);
    if (botanical) {
      ctx.fillStyle = "#7c9c62";
      ctx.fillRect(-5, roofY + 24, 10, 28);
      ctx.fillRect(-16, roofY + 28, 32, 10);
    }
  } else if (
    element.elementType === "topiary_arch" ||
    element.elementType === "pergola" ||
    element.elementType === "grand_rose_pergola"
  ) {
    const grand = element.elementType === "grand_rose_pergola";
    const topiary = element.elementType === "topiary_arch";
    const halfWidth = grand ? 44 : topiary ? 20 : 31;
    const height = grand ? 49 : topiary ? 39 : 43;
    ctx.fillStyle = topiary ? "#3f6645" : "#74523b";
    ctx.fillRect(-halfWidth, -height, 5, height + 3);
    ctx.fillRect(halfWidth - 5, -height, 5, height + 3);
    ctx.fillRect(-halfWidth, -height, halfWidth * 2, 5);
    if (!topiary) {
      for (let x = -halfWidth + 8; x < halfWidth; x += 11) {
        ctx.fillRect(x, -height - 5, 3, 13);
      }
    }
    if (topiary || grand) {
      ctx.fillStyle = "#4f754d";
      ctx.fillRect(-halfWidth - 4, -height + 6, 12, height - 7);
      ctx.fillRect(halfWidth - 8, -height + 6, 12, height - 7);
      ctx.fillRect(-halfWidth + 5, -height - 4, halfWidth * 2 - 10, 12);
    }
    if (grand) {
      ctx.fillStyle = "#d94a58";
      for (let x = -35; x <= 35; x += 14) ctx.fillRect(x, -height - 2, 6, 5);
      ctx.fillRect(-42, -26, 6, 5);
      ctx.fillRect(36, -34, 6, 5);
    }
  } else if (element.elementType === "mosaic_fountain") {
    const splash = Math.floor(now / 200) % 3;
    ctx.fillStyle = "#5e6866";
    ctx.fillRect(-22, -5, 44, 8);
    ctx.fillStyle = "#d6c176";
    ctx.fillRect(-19, -11, 38, 7);
    ctx.fillStyle = "#4f9db0";
    for (let x = -16; x <= 12; x += 7) ctx.fillRect(x, -9, 4, 3);
    ctx.fillStyle = "#7f7668";
    ctx.fillRect(-4, -29, 8, 19);
    ctx.fillStyle = "#62c2df";
    ctx.fillRect(-1, -39 - splash, 3, 14);
    ctx.fillRect(-12, -25 + splash, 4, 7);
    ctx.fillRect(8, -25 + splash, 4, 7);
  } else if (element.elementType === "formal_pond") {
    ctx.fillStyle = "#625e56";
    ctx.fillRect(-37, -15, 74, 25);
    ctx.fillStyle = "#d1bc84";
    ctx.fillRect(-34, -12, 68, 19);
    ctx.fillStyle = "#63adbd";
    ctx.fillRect(-29, -9, 58, 13);
    ctx.fillStyle = "#9fd3d5";
    ctx.fillRect(-22, -7, 20, 2);
    ctx.fillStyle = "#5f8659";
    ctx.fillRect(12, -5, 9, 6);
  } else if (element.elementType === "great_basil_topiary") {
    ctx.fillStyle = "#5d4432";
    ctx.fillRect(-5, -36, 10, 38);
    ctx.fillStyle = "#3f6743";
    ctx.fillRect(-27, -56, 54, 21);
    ctx.fillRect(-20, -72, 40, 19);
    ctx.fillRect(-12, -85, 24, 16);
    ctx.fillStyle = "#71915a";
    ctx.fillRect(-21, -53, 17, 9);
    ctx.fillRect(3, -68, 14, 8);
    ctx.fillRect(-7, -82, 13, 7);
    ctx.fillStyle = "#d9b85c";
    ctx.fillRect(-14, 2, 28, 6);
    ctx.fillStyle = "#f3dc87";
    ctx.fillRect(-9, 4, 18, 3);
  }
  ctx.restore();
}

export function drawMyGardenElementPreview(
  ctx: CanvasRenderingContext2D,
  elementType: MyGardenElementType,
  viewport: GardenViewport,
  now = Date.now(),
) {
  const definition = getMyGardenElement(elementType);
  const largestFootprint = Math.max(
    definition.footprintWidth,
    definition.footprintHeight,
  );
  const zoom =
    elementType === "great_basil_topiary"
      ? 0.58
      : definition.icon === "tree" || definition.icon === "greenhouse"
        ? Math.min(0.92, 2.8 / largestFootprint)
        : definition.icon === "trellis"
          ? Math.min(1.15, 3.2 / largestFootprint)
          : Math.min(1.8, 3.6 / largestFootprint);
  const camera = gridToWorld(
    (definition.footprintWidth - 1) / 2,
    (definition.footprintHeight - 1) / 2,
  );
  drawPersonalElement(
    ctx,
    {
      id: `preview:${elementType}`,
      gridX: 0,
      gridY: 0,
      elementType,
      careCost: definition.careCost,
    },
    camera,
    viewport,
    zoom,
    now,
  );
}

function drawPersonalSoilPatches(
  ctx: CanvasRenderingContext2D,
  plants: PlantRecord[],
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  for (const plant of plants) {
    const point = worldToScreen(
      gridToWorld(plant.grid_x, plant.grid_y),
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(point, viewport)) continue;
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    ctx.fillStyle = "#7d5b43";
    ctx.fillRect(-7, -4, 14, 7);
    ctx.fillStyle = "#9b7557";
    ctx.fillRect(-4, -5, 8, 2);
    ctx.fillRect(-8, -1, 3, 3);
    ctx.fillRect(5, 0, 3, 2);
    ctx.restore();
  }
}

function drawColorMask(
  ctx: CanvasRenderingContext2D,
  plants: PlantRecord[],
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  kind: "soil" | "green",
  zoom: number,
) {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  for (const plant of plants) {
    const visual = getPlantVisual(plant, now);
    if (visual.colorRadius <= 0) continue;
    const point = worldToScreen(
      gridToWorld(plant.grid_x, plant.grid_y),
      camera,
      viewport,
      zoom,
    );
    const radiusMultiplier = kind === "soil" ? 1.55 : 0.9;
    const radius = visual.colorRadius * zoom * radiusMultiplier;
    const strength =
      kind === "soil"
        ? Math.min(0.84, 0.36 + visual.colorStrength * 0.48)
        : visual.colorStrength;
    const gradient = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(kind === "soil" ? 0.58 : 0.7, `rgba(255,255,255,${strength * 0.68})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }
}

function applyMask(
  layerContext: CanvasRenderingContext2D,
  maskContext: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
) {
  layerContext.globalCompositeOperation = "destination-in";
  layerContext.drawImage(maskCanvas, 0, 0);
  layerContext.globalCompositeOperation = "source-over";
  maskContext.globalCompositeOperation = "source-over";
}

function isVisible(point: WorldPoint, viewport: GardenViewport, padding = 50) {
  return (
    point.x >= -padding &&
    point.x <= viewport.width + padding &&
    point.y >= -padding &&
    point.y <= viewport.height + padding
  );
}

function drawSeedOrSprout(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  state: "seed" | "sprout",
  heritage = false,
) {
  if (state === "seed") {
    ctx.fillStyle = plant.plant_type === "sunflower" ? "#4f4434" : "#705443";
    ctx.fillRect(-2, -2, 4, 2);
    ctx.fillStyle = plant.plant_type === "lavender" ? "#8f765b" : "#8f6b51";
    ctx.fillRect(-1, -4, 2, 2);
    return;
  }

  ctx.fillStyle = heritage
    ? HERITAGE_GOLD_DARK
    : plant.plant_type === "lavender"
      ? "#69755e"
      : "#68764f";
  ctx.fillRect(-1, -5, 2, 6);
  ctx.fillRect(-4, -4, 3, 2);
  ctx.fillRect(1, -2, 2, 2);
}

function drawRosePlant(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  state: "young" | "mature" | "blooming" | "wilting",
  heritage = false,
) {
  const wilting = state === "wilting";
  const plantVariant = Math.abs(plant.grid_x * 17 + plant.grid_y * 13) % 2;
  const stemLean = plantVariant === 0 ? -1 : 1;
  if (state === "young") {
    ctx.fillStyle = heritage ? HERITAGE_GOLD_DARK : "#45643f";
    ctx.fillRect(-1, -4, 2, 5);
    ctx.fillRect(-1 + stemLean, -9, 2, 5);
    ctx.fillRect(-4 + stemLean, -7, 3, 2);
    ctx.fillRect(1, -3, 3, 2);
    ctx.fillStyle = heritage ? HERITAGE_GOLD_LIGHT : "#718054";
    ctx.fillRect(-2 + stemLean, -10, 4, 3);
    return;
  }

  const leftLeafY = plantVariant === 0 ? -7 : -6;
  const rightLeafY = plantVariant === 0 ? -2 : -3;
  ctx.fillStyle = heritage
    ? wilting
      ? HERITAGE_GOLD_DARK
      : HERITAGE_GOLD_LIGHT
    : wilting
      ? "#677052"
      : "#45643f";
  ctx.fillRect(-1, -4, 2, 5);
  ctx.fillRect(-1 + stemLean, -9, 2, 5);
  ctx.fillRect(-5 + stemLean, leftLeafY, 4, 2);
  ctx.fillRect(-2, leftLeafY + 1, 2, 1);
  ctx.fillRect(1, rightLeafY, 3, 2);
  ctx.fillRect(0, rightLeafY + 1, 2, 1);

  if (state === "mature") {
    ctx.fillStyle = "#bc5f5f";
    ctx.fillRect(-3 + stemLean, -12, 6, 4);
    ctx.fillStyle = "#8f4548";
    ctx.fillRect(-1 + stemLean, -13, 3, 3);
    return;
  }

  ctx.fillStyle = wilting ? "#a76d62" : "#d94a4e";
  ctx.fillRect(-4, -14, 8, 7);
  ctx.fillRect(-6, -12, 12, 3);
  ctx.fillStyle = wilting ? "#845047" : "#a51f31";
  ctx.fillRect(-2, -13, 4, 4);
  ctx.fillStyle = "#f2a36f";
  ctx.fillRect(-1, -12, 2, 2);
}

function drawSunflowerPlant(
  ctx: CanvasRenderingContext2D,
  state: "young" | "mature" | "blooming" | "wilting",
  heritage = false,
) {
  const wilting = state === "wilting";
  ctx.save();
  if (wilting) ctx.rotate(0.16);
  ctx.fillStyle = heritage
    ? wilting
      ? HERITAGE_GOLD_DARK
      : HERITAGE_GOLD_LIGHT
    : wilting
      ? "#6f7151"
      : "#42633e";
  ctx.fillRect(-1, -12, 2, 13);
  ctx.fillRect(-6, -7, 5, 3);
  ctx.fillRect(1, -4, 6, 3);

  if (state === "young") {
    ctx.fillStyle = heritage ? HERITAGE_GOLD_LIGHT : "#758454";
    ctx.fillRect(-3, -14, 6, 3);
    ctx.restore();
    return;
  }

  const petal = wilting ? "#b78f4c" : "#e4b53f";
  const center = wilting ? "#705243" : "#5b4335";
  const headY = state === "mature" ? -14 : -16;
  ctx.fillStyle = petal;
  ctx.fillRect(-5, headY - 3, 10, 8);
  ctx.fillRect(-7, headY - 1, 14, 4);
  ctx.fillStyle = center;
  ctx.fillRect(-3, headY - 1, 6, 5);
  ctx.fillStyle = "#9c6e35";
  ctx.fillRect(-1, headY, 2, 2);
  ctx.restore();
}

function drawLavenderPlant(
  ctx: CanvasRenderingContext2D,
  state: "young" | "mature" | "blooming" | "wilting",
  heritage = false,
) {
  const wilting = state === "wilting";
  ctx.fillStyle = heritage
    ? wilting
      ? HERITAGE_GOLD_DARK
      : HERITAGE_GOLD_LIGHT
    : wilting
      ? "#73735d"
      : "#536a50";
  ctx.fillRect(-7, -5, 14, 5);
  ctx.fillRect(-5, -8, 3, 7);
  ctx.fillRect(-1, -10, 2, 10);
  ctx.fillRect(3, -7, 3, 7);

  if (state === "young") return;

  const flower = wilting ? "#827688" : "#7876a8";
  const flowerLight = wilting ? "#9b8c92" : "#a39bc4";
  const topOffset = state === "mature" ? 2 : 0;
  ctx.fillStyle = flower;
  ctx.fillRect(-6, -13 + topOffset, 3, 6);
  ctx.fillRect(-1, -16 + topOffset, 3, 7);
  ctx.fillRect(4, -12 + topOffset, 3, 6);
  ctx.fillStyle = flowerLight;
  ctx.fillRect(-5, -13 + topOffset, 2, 2);
  ctx.fillRect(0, -16 + topOffset, 2, 2);
  ctx.fillRect(5, -12 + topOffset, 2, 2);
}

function drawMyGardenFlower(
  ctx: CanvasRenderingContext2D,
  plantType: "daisy" | "tulip" | "wildflowers" | "peony" | "bee_balm",
  heritage = false,
) {
  ctx.fillStyle = heritage ? HERITAGE_GOLD_LIGHT : "#4f7047";
  ctx.fillRect(-1, -10, 2, 11);
  ctx.fillRect(-5, -5, 4, 2);
  ctx.fillRect(1, -7, 5, 2);

  if (plantType === "daisy") {
    ctx.fillStyle = "#fff8de";
    ctx.fillRect(-5, -15, 10, 7);
    ctx.fillRect(-7, -13, 14, 3);
    ctx.fillStyle = "#e0ad37";
    ctx.fillRect(-2, -13, 4, 4);
  } else if (plantType === "tulip") {
    ctx.fillStyle = "#d95b6a";
    ctx.fillRect(-5, -16, 10, 8);
    ctx.fillRect(-3, -18, 3, 4);
    ctx.fillRect(1, -18, 3, 4);
    ctx.fillStyle = "#a7354e";
    ctx.fillRect(-2, -14, 4, 5);
  } else if (plantType === "wildflowers") {
    ctx.fillStyle = heritage ? HERITAGE_GOLD_LIGHT : "#4f7047";
    ctx.fillRect(-6, -9, 2, 10);
    ctx.fillRect(5, -8, 2, 9);
    ctx.fillStyle = "#f0c04b";
    ctx.fillRect(-8, -13, 5, 5);
    ctx.fillStyle = "#7f79ad";
    ctx.fillRect(-2, -16, 5, 5);
    ctx.fillStyle = "#d85b68";
    ctx.fillRect(4, -12, 5, 5);
  } else if (plantType === "peony") {
    ctx.fillStyle = "#eba0ad";
    ctx.fillRect(-6, -16, 12, 9);
    ctx.fillRect(-8, -13, 16, 4);
    ctx.fillStyle = "#c85f78";
    ctx.fillRect(-4, -14, 8, 6);
    ctx.fillStyle = "#f2c5ca";
    ctx.fillRect(-2, -15, 4, 3);
  } else {
    ctx.fillStyle = "#c44e78";
    ctx.fillRect(-5, -17, 10, 9);
    ctx.fillRect(-7, -14, 14, 3);
    ctx.fillStyle = "#ed8aa4";
    ctx.fillRect(-3, -18, 2, 5);
    ctx.fillRect(1, -17, 2, 5);
    ctx.fillStyle = "#6d3f68";
    ctx.fillRect(-2, -13, 4, 4);
  }
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
  showCareCue = false,
  careReady?: boolean,
) {
  const point = worldToScreen(
    gridToWorld(plant.grid_x, plant.grid_y),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  const visual = getPlantVisual(plant, now);
  if (visual.state === "expired") return;
  const heritage = Boolean(plant.heritage_at);
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);

  if (visual.state === "dead") {
    ctx.fillStyle = plant.plant_type === "lavender" ? "#706756" : "#6f573d";
    ctx.fillRect(-1, -6, 2, 7);
    ctx.fillRect(-5, -5, 5, 2);
    ctx.fillRect(0, -3, 5, 2);
    ctx.restore();
    return;
  }

  if (visual.state === "seed" || visual.state === "sprout") {
    drawSeedOrSprout(ctx, plant, visual.state, heritage);
    if (showCareCue && (careReady ?? canEarnWateringCare(plant, now))) {
      drawCareReadyCue(ctx, now, plant);
    }
    ctx.restore();
    return;
  }

  if (plant.plant_type === "sunflower") {
    drawSunflowerPlant(ctx, visual.state, heritage);
  } else if (plant.plant_type === "lavender") {
    drawLavenderPlant(ctx, visual.state, heritage);
  } else if (
    plant.plant_type === "daisy" ||
    plant.plant_type === "tulip" ||
    plant.plant_type === "wildflowers" ||
    plant.plant_type === "peony" ||
    plant.plant_type === "bee_balm"
  ) {
    drawMyGardenFlower(ctx, plant.plant_type, heritage);
  } else {
    drawRosePlant(ctx, plant, visual.state, heritage);
  }
  if (heritage) {
    const shimmer = 0.68 + Math.sin(now / 900 + plant.grid_x + plant.grid_y) * 0.2;
    ctx.save();
    ctx.globalAlpha = shimmer;
    ctx.fillStyle = HERITAGE_GOLD_LIGHT;
    ctx.fillRect(-8, -16, 2, 2);
    ctx.fillRect(6, -10, 2, 2);
    ctx.fillStyle = "#fff4bd";
    ctx.fillRect(-7, -17, 1, 1);
    ctx.fillRect(7, -11, 1, 1);
    ctx.restore();
  }
  if (showCareCue && (careReady ?? canEarnWateringCare(plant, now))) {
    drawCareReadyCue(ctx, now, plant);
  }
  ctx.restore();
}

export function drawMyGardenPlantPreview(
  ctx: CanvasRenderingContext2D,
  plantType: PlantRecord["plant_type"],
  viewport: GardenViewport,
  now = Date.now(),
  heritage = false,
) {
  const camera = gridToWorld(0, 0);
  const timestamp = new Date(now).toISOString();
  drawPlant(
    ctx,
    {
      id: `preview:${plantType}`,
      grid_x: 0,
      grid_y: 0,
      plant_type: plantType,
      planted_at: timestamp,
      last_watered_at: timestamp,
      created_at: timestamp,
      permanent: true,
      heritage_at: heritage ? timestamp : null,
    },
    camera,
    viewport,
    now,
    2.35,
    false,
  );
}

function drawCareReadyCue(
  ctx: CanvasRenderingContext2D,
  now: number,
  plant: PlantRecord,
) {
  const phase =
    (now / 1600 + Math.abs(plant.grid_x * 7 + plant.grid_y * 11)) %
    (Math.PI * 2);
  ctx.save();
  if (isSpecialWateringFlower(plant)) {
    ctx.globalAlpha = 0.9 + Math.sin(phase) * 0.08;
    ctx.translate(-8, -12);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3, -1, 7, 2);
    ctx.fillRect(-1, -3, 2, 7);
    ctx.fillStyle = "#c94f4c";
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 0.88 + Math.sin(phase) * 0.08;
  ctx.translate(-8, -12);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-1, -3, 3, 2);
  ctx.fillRect(-2, -1, 5, 3);
  ctx.fillRect(-1, 2, 3, 2);
  ctx.fillStyle = "#54c9f3";
  ctx.fillRect(0, -2, 1, 1);
  ctx.fillRect(-1, -1, 3, 2);
  ctx.fillRect(-1, 1, 3, 2);
  ctx.fillStyle = "#e8fbff";
  ctx.fillRect(-1, -1, 1, 1);
  ctx.restore();
}

function drawPlantCareCue(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
  careReady?: boolean,
) {
  const visual = getPlantVisual(plant, now);
  if (
    visual.state === "expired" ||
    visual.state === "dead" ||
    !(careReady ?? canEarnWateringCare(plant, now))
  ) {
    return;
  }
  const point = worldToScreen(
    gridToWorld(plant.grid_x, plant.grid_y),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);
  drawCareReadyCue(ctx, now, plant);
  ctx.restore();
}

function drawPersonalDepthObjects(
  ctx: CanvasRenderingContext2D,
  plants: PlantRecord[],
  elements: PersonalGardenElement[],
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  const objects: Array<
    | { kind: "plant"; gridX: number; gridY: number; plant: PlantRecord }
    | {
        kind: "element";
        gridX: number;
        gridY: number;
        element: PersonalGardenElement;
      }
  > = [
    ...plants.map((plant) => ({
      kind: "plant" as const,
      gridX: plant.grid_x,
      gridY: plant.grid_y,
      plant,
    })),
    ...elements.map((element) => ({
      kind: "element" as const,
      gridX: element.gridX,
      gridY:
        element.gridY +
        getMyGardenElement(element.elementType).footprintHeight -
        1,
      element,
    })),
  ];

  objects.sort(
    (left, right) =>
      left.gridY - right.gridY ||
      left.gridX - right.gridX ||
      (left.kind === right.kind ? 0 : left.kind === "plant" ? -1 : 1),
  );

  for (const object of objects) {
    if (object.kind === "plant") {
      drawPlant(ctx, object.plant, camera, viewport, now, zoom);
    } else {
      drawPersonalElement(ctx, object.element, camera, viewport, zoom, now);
    }
  }
}

function drawDampSoil(
  ctx: CanvasRenderingContext2D,
  plants: PlantRecord[],
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  for (const plant of plants) {
    const visual = getPlantVisual(plant, now);
    if (visual.dampStrength <= 0) continue;
    const point = worldToScreen(
      gridToWorld(plant.grid_x, plant.grid_y),
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(point, viewport)) continue;
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    const elapsedHalfLives = -Math.log2(visual.dampStrength);
    const soilVariant = Math.abs(plant.grid_x * 17 + plant.grid_y * 13) % 3;
    const patchInset = Math.min(2, Math.floor(elapsedHalfLives));
    const patchHalfWidth = 5 - patchInset;
    const patchHeight = 6 - patchInset;
    ctx.globalAlpha = 0.42 * visual.dampStrength;
    ctx.fillStyle = "#6f5947";
    ctx.fillRect(
      -patchHalfWidth,
      -Math.ceil(patchHeight / 2),
      patchHalfWidth * 2,
      patchHeight,
    );
    if (elapsedHalfLives < 2.7) {
      if (soilVariant === 0) {
        ctx.fillRect(-3 + patchInset, -5 + patchInset, 7 - patchInset, 2);
        ctx.fillRect(-6 + patchInset, -1, 2, 3 - Math.min(1, patchInset));
      } else if (soilVariant === 1) {
        ctx.fillRect(-4 + patchInset, -4 + patchInset, 8 - patchInset * 2, 2);
        ctx.fillRect(4 - patchInset, -1, 2, 3 - Math.min(1, patchInset));
      } else {
        ctx.fillRect(-2, -5 + patchInset, 7 - patchInset, 2);
        ctx.fillRect(-6 + patchInset, 0, 3 - Math.min(1, patchInset), 2);
      }
    }
    if (elapsedHalfLives < 2) {
      ctx.globalAlpha = 0.28 * visual.dampStrength;
      ctx.fillStyle = "#a18a70";
      ctx.fillRect(-3, -2, 3, 1);
      ctx.fillRect(2, 1, 3, 1);
    }
    if (elapsedHalfLives < 1) {
      const sheenStrength = 1 - elapsedHalfLives;
      ctx.globalAlpha = 0.32 * visual.dampStrength * sheenStrength;
      ctx.fillStyle = "#93b7b0";
      ctx.fillRect(-4, -3, 2, 1);
      ctx.fillRect(3, 1, 2, 1);
    }
    ctx.restore();
  }
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  selected: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  if (!selected) return;
  const point = worldToScreen(
    gridToWorld(selected.gridX, selected.gridY),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#fff4dc";
  ctx.fillRect(-9, -7, 5, 2);
  ctx.fillRect(-9, -7, 2, 5);
  ctx.fillRect(4, -7, 5, 2);
  ctx.fillRect(7, -7, 2, 5);
  ctx.fillRect(-9, 5, 5, 2);
  ctx.fillRect(-9, 2, 2, 5);
  ctx.fillRect(4, 5, 5, 2);
  ctx.fillRect(7, 2, 2, 5);
  ctx.fillStyle = "#a84f4b";
  ctx.fillRect(-8, -6, 4, 2);
  ctx.fillRect(-8, -6, 2, 4);
  ctx.fillRect(4, -6, 4, 2);
  ctx.fillRect(6, -6, 2, 4);
  ctx.fillRect(-8, 4, 4, 2);
  ctx.fillRect(-8, 2, 2, 4);
  ctx.fillRect(4, 4, 4, 2);
  ctx.fillRect(6, 2, 2, 4);
  ctx.restore();
}

function drawWateringTargets(
  ctx: CanvasRenderingContext2D,
  targets: Array<NonNullable<SelectedCell>>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  mary: WorldPoint,
  selected: SelectedCell,
) {
  for (const target of targets) {
    const point = worldToScreen(
      gridToWorld(target.gridX, target.gridY),
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(point, viewport)) continue;
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c9f7ff";
    ctx.fillRect(-8, -8, 6, 2);
    ctx.fillRect(2, -8, 6, 2);
    ctx.fillRect(-8, 6, 6, 2);
    ctx.fillRect(2, 6, 6, 2);
    ctx.fillRect(-8, -6, 2, 5);
    ctx.fillRect(-8, 1, 2, 5);
    ctx.fillRect(6, -6, 2, 5);
    ctx.fillRect(6, 1, 2, 5);
    ctx.restore();
  }

  if (!selected || targets.length === 0) return;
  const selectedPoint = worldToScreen(
    gridToWorld(selected.gridX, selected.gridY),
    camera,
    viewport,
    zoom,
  );
  if (!isVisible(selectedPoint, viewport)) return;
  const selectedWorld = gridToWorld(selected.gridX, selected.gridY);
  const cornerX = mary.x <= selectedWorld.x ? -6 : 6;
  const cornerY = mary.y <= selectedWorld.y ? -6 : 6;
  ctx.save();
  ctx.translate(Math.round(selectedPoint.x), Math.round(selectedPoint.y));
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#d7464d";
  ctx.fillRect(cornerX < 0 ? cornerX : cornerX - 4, cornerY, 5, 2);
  ctx.fillRect(cornerX, cornerY < 0 ? cornerY : cornerY - 4, 2, 5);
  ctx.restore();
}

function drawMary(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  moving: boolean,
  now: number,
  zoom: number,
) {
  const screen = worldToScreen(point, camera, viewport, zoom);
  const step = moving && Math.floor(now / 170) % 2 === 0 ? 1 : 0;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y) - step * zoom);
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "#5e2f25";
  ctx.fillRect(-6, -22, 12, 9);
  ctx.fillRect(-8, -19, 16, 9);
  ctx.fillStyle = "#e5c4a1";
  ctx.fillRect(-5, -12, 10, 5);
  ctx.fillStyle = "#f0e0c4";
  ctx.fillRect(-7, -8, 14, 8);
  ctx.fillStyle = "#65704a";
  ctx.fillRect(-6, -7, 4, 13);
  ctx.fillRect(2, -7, 4, 13);
  ctx.fillRect(-2, -3, 4, 9);
  ctx.fillStyle = "#49382e";
  ctx.fillRect(-7, 5, 6, 4 + step);
  ctx.fillRect(1, 5, 6, 5 - step);
  ctx.fillStyle = "#312a26";
  ctx.fillRect(-7, 8 + step, 6, 2);
  ctx.fillRect(1, 9 - step, 6, 2);
  ctx.restore();
}

function drawBuilderPreview(
  ctx: CanvasRenderingContext2D,
  preview: NonNullable<RenderGardenState["builderPreview"]>,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(49, 39, 33, 0.34)";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const color = preview.mode === "place" ? "#72d7e5" : "#ef837a";
  const inner = preview.mode === "place" ? "#d7fbff" : "#ffe0dc";
  const tileWidth = GARDEN_CONFIG.tileSize * zoom;
  const tileHeight = GARDEN_CONFIG.tileScreenHeight * zoom;
  const points = preview.cells.map((cell) =>
    worldToScreen(gridToWorld(cell.gridX, cell.gridY), camera, viewport, zoom),
  );

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, 4 * zoom);
  ctx.lineJoin = "miter";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    const isHead = index === points.length - 1;
    const pulse = isHead ? 0.78 + Math.sin(now / 170) * 0.12 : 0.64;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = inner;
    ctx.fillRect(
      Math.round(point.x - tileWidth / 2 + 2 * zoom),
      Math.round(point.y - tileHeight / 2 + 2 * zoom),
      Math.max(2, Math.round(tileWidth - 4 * zoom)),
      Math.max(2, Math.round(tileHeight - 4 * zoom)),
    );
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, (isHead ? 4 : 3) * zoom);
    ctx.strokeRect(
      Math.round(point.x - tileWidth / 2),
      Math.round(point.y - tileHeight / 2),
      Math.round(tileWidth),
      Math.round(tileHeight),
    );
    ctx.fillStyle = "#fff8e7";
    ctx.font = `900 ${Math.max(10, Math.round(11 * zoom))}px "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), point.x, point.y);
  });

  if (preview.invalidCell) {
    const point = worldToScreen(
      gridToWorld(preview.invalidCell.gridX, preview.invalidCell.gridY),
      camera,
      viewport,
      zoom,
    );
    ctx.strokeStyle = "#e44747";
    ctx.lineWidth = Math.max(3, 4 * zoom);
    ctx.strokeRect(
      Math.round(point.x - tileWidth / 2),
      Math.round(point.y - tileHeight / 2),
      Math.round(tileWidth),
      Math.round(tileHeight),
    );
  }
  ctx.restore();
}

function drawDuck(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  moving: boolean,
  now: number,
  zoom: number,
) {
  const screen = worldToScreen(point, camera, viewport, zoom);
  const waddle = moving && Math.floor(now / 150) % 2 === 0 ? 1 : -1;
  ctx.save();
  ctx.translate(Math.round(screen.x) + waddle * zoom, Math.round(screen.y));
  ctx.scale(zoom, zoom);
  ctx.fillStyle = "#f5f0df";
  ctx.fillRect(-5, -8, 10, 8);
  ctx.fillRect(-3, -12, 7, 6);
  ctx.fillStyle = "#2f3130";
  ctx.fillRect(2, -10, 1, 1);
  ctx.fillStyle = "#d6a13b";
  ctx.fillRect(4, -9, 4, 2);
  ctx.fillRect(-4, 0, 3, 1);
  ctx.fillRect(2, 0, 3, 1);
  ctx.restore();
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: GardenEffect[],
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
) {
  for (const effect of effects) {
    const age = now - effect.startedAt;
    const duration =
      effect.kind === "care" ? 1100 : effect.kind === "worm" ? 1800 : 900;
    if (age < 0 || age > duration) continue;
    const progress = age / duration;
    if (effect.kind === "spray") {
      const from = worldToScreen(
        { x: effect.fromX, y: effect.fromY - 8 },
        camera,
        viewport,
        zoom,
      );
      const targetWorld = gridToWorld(effect.gridX, effect.gridY);
      const directionX = targetWorld.x - effect.fromX;
      const directionY = targetWorld.y - effect.fromY;
      const directionLength = Math.max(1, Math.hypot(directionX, directionY));
      const extendedTarget = {
        x: targetWorld.x + (directionX / directionLength) * 32,
        y: targetWorld.y + (directionY / directionLength) * 32,
      };
      const to = worldToScreen(
        extendedTarget,
        camera,
        viewport,
        zoom,
      );
      ctx.save();
      ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.74;
      ctx.fillStyle = "#75b7cf";
      for (let index = 1; index <= 12; index += 1) {
        const t = index / 13;
        const arc = Math.sin(t * Math.PI) * 8 * zoom;
        ctx.fillRect(
          Math.round(from.x + (to.x - from.x) * t),
          Math.round(from.y + (to.y - from.y) * t - arc),
          Math.max(1, Math.round(2 * zoom)),
          Math.max(1, Math.round(2 * zoom)),
        );
      }
      ctx.restore();
      continue;
    }
    const point =
      effect.kind === "care"
        ? worldToScreen({ x: effect.x, y: effect.y }, camera, viewport, zoom)
        : worldToScreen(
            gridToWorld(effect.gridX, effect.gridY),
            camera,
            viewport,
            zoom,
          );
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    if (effect.kind === "care") {
      const fadeIn = Math.min(1, progress / 0.12);
      const fadeOut = Math.min(1, (1 - progress) / 0.28);
      ctx.globalAlpha = Math.min(fadeIn, fadeOut);
      ctx.translate(0, -31 - progress * 18);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '900 14px "Courier New", monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 244, 223, 0.92)";
      ctx.fillStyle = effect.dailyBonus ? "#57865a" : "#c94f4c";
      const label = `+${effect.value}`;
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
    } else if (effect.kind === "water") {
      ctx.fillStyle = "#75b7cf";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 4 - 6;
        ctx.fillRect(offset, -20 + progress * 16 + (index % 2) * 3, 2, 3);
      }
    } else if (effect.kind === "worm") {
      const wiggle = Math.sin(progress * Math.PI * 6) * 3;
      ctx.globalAlpha = Math.sin(progress * Math.PI);
      ctx.translate(wiggle, -12 - progress * 12);
      ctx.fillStyle = "#d88a72";
      ctx.fillRect(-7, -2, 5, 4);
      ctx.fillStyle = "#c46f5f";
      ctx.fillRect(-2, -4, 5, 4);
      ctx.fillStyle = "#a9514c";
      ctx.fillRect(3, -2, 5, 4);
      ctx.fillStyle = "#34231f";
      ctx.fillRect(6, -1, 1, 1);
    } else if (effect.kind === "plant") {
      ctx.fillStyle = "#876444";
      ctx.fillRect(-7 - progress * 4, -3, 3, 2);
      ctx.fillRect(4 + progress * 4, -5, 3, 2);
    } else if (effect.kind === "path") {
      ctx.fillStyle = "#e1c495";
      ctx.fillRect(-8 - progress * 2, -7 - progress * 3, 3, 2);
      ctx.fillRect(5 + progress * 2, -5 - progress * 4, 3, 2);
    } else {
      ctx.fillStyle = "#f2d08c";
      ctx.fillRect(-6 - progress * 5, -10 - progress * 6, 3, 3);
      ctx.fillRect(3 + progress * 5, -7 - progress * 8, 3, 3);
    }
    ctx.restore();
  }
}

export function renderGarden(ctx: CanvasRenderingContext2D, state: RenderGardenState) {
  if (state.mode === "personal" && state.personalGarden) {
    const visiblePlants = state.plants.filter(
      (plant) => getPlantVisual(plant, state.now).state !== "expired",
    );
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
    drawPersonalTerrain(
      ctx,
      state.camera,
      state.viewport,
      state.zoom,
      state.personalGarden.minX,
      state.personalGarden.minY,
      state.personalGarden.width,
      state.personalGarden.height,
      state.personalGarden.nextExpansion,
      state.shareOnly,
    );
    drawPersonalPaths(
      ctx,
      state.personalGarden.paths,
      state.camera,
      state.viewport,
      state.zoom,
    );
    drawPersonalDecorations(
      ctx,
      state.camera,
      state.viewport,
      state.zoom,
      state.personalGarden.minX,
      state.personalGarden.minY,
      state.personalGarden.width,
      state.personalGarden.height,
      state.personalGarden.nextExpansion,
    );
    drawSuggestedPlantingHighlight(
      ctx,
      state.suggestedPlantingCell,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    );
    drawPersonalSoilPatches(
      ctx,
      visiblePlants,
      state.camera,
      state.viewport,
      state.zoom,
    );
    drawDampSoil(ctx, visiblePlants, state.camera, state.viewport, state.now, state.zoom);
    drawPersonalDepthObjects(
      ctx,
      visiblePlants,
      state.personalGarden.elements,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    );
    // The house is a fixed foreground structure. Garden items may still be
    // placed beneath it, but they should read as being behind the building
    // instead of painting over its roof and walls.
    drawPixelShed(ctx, state.camera, state.viewport, state.zoom);
    drawDuck(ctx, state.duck, state.camera, state.viewport, state.moving, state.now, state.zoom);
    if (state.tutorialDimmed) {
      drawTutorialDimmer(
        ctx,
        state.viewport,
        state.mary,
        state.camera,
        state.zoom,
      );
      drawSuggestedPlantingHighlight(
        ctx,
        state.suggestedPlantingCell,
        state.camera,
        state.viewport,
        state.now,
        state.zoom,
      );
    }
    drawMary(ctx, state.mary, state.camera, state.viewport, state.moving, state.now, state.zoom);
    drawSuggestedPlantingLabel(
      ctx,
      state.suggestedPlantingCell,
      state.mary,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    );
    drawEffects(ctx, state.effects, state.camera, state.viewport, state.now, state.zoom);
    if (state.builderPreview) {
      drawBuilderPreview(
        ctx,
        state.builderPreview,
        state.camera,
        state.viewport,
        state.now,
        state.zoom,
      );
    } else {
      drawSelection(ctx, state.selected, state.camera, state.viewport, state.zoom);
    }
    return;
  }

  baseLayer = ensureLayer(baseLayer, state.viewport);
  soilLayer = ensureLayer(soilLayer, state.viewport);
  greenLayer = ensureLayer(greenLayer, state.viewport);
  maskLayer = ensureLayer(maskLayer, state.viewport);
  const baseCtx = baseLayer.getContext("2d");
  const soilCtx = soilLayer.getContext("2d");
  const greenCtx = greenLayer.getContext("2d");
  const maskCtx = maskLayer.getContext("2d");
  if (!baseCtx || !soilCtx || !greenCtx || !maskCtx) return;

  const visiblePlants = state.plants.filter(
    (plant) => getPlantVisual(plant, state.now).state !== "expired",
  );
  const occupiedCells = new Set(
    [
      ...visiblePlants.map((plant) => terrainCellKey(plant.grid_x, plant.grid_y)),
      ...state.weeds.map((weed) => terrainCellKey(weed.grid_x, weed.grid_y)),
    ],
  );
  const openRegionKeys = state.communityRegions
    ? new Set(
        state.communityRegions
          .filter((region) => region.isOpen)
          .map((region) => `${region.regionX}:${region.regionY}`),
      )
    : null;
  const growingEdgeStages = new Map(
    (state.communityRegions ?? []).flatMap((region) =>
      !region.isOpen &&
      (region.publicStage === "edge" ||
        region.publicStage === "growing" ||
        region.publicStage === "ready")
        ? [[
            `${region.regionX}:${region.regionY}`,
            region.publicStage as "edge" | "growing" | "ready",
          ] as const]
        : [],
    ),
  );
  const guidanceZones = new Map(
    (state.communityRegions ?? []).flatMap((region) =>
      region.isOpen &&
      (region.guidanceZone === "heart" ||
        region.guidanceZone === "growth-ring")
        ? [[
            `${region.regionX}:${region.regionY}`,
            region.guidanceZone,
          ] as const]
        : [],
    ),
  );
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawTerrainLayer(baseCtx, state.camera, state.viewport, "base", state.zoom, occupiedCells, openRegionKeys, growingEdgeStages, guidanceZones);
  drawTerrainLayer(soilCtx, state.camera, state.viewport, "soil", state.zoom, occupiedCells, openRegionKeys, growingEdgeStages, guidanceZones);
  drawColorMask(
    maskCtx,
    visiblePlants,
    state.camera,
    state.viewport,
    state.now,
    "soil",
    state.zoom,
  );
  applyMask(soilCtx, maskCtx, maskLayer);
  drawTerrainLayer(greenCtx, state.camera, state.viewport, "green", state.zoom, occupiedCells, openRegionKeys, growingEdgeStages, guidanceZones);
  drawColorMask(
    maskCtx,
    visiblePlants,
    state.camera,
    state.viewport,
    state.now,
    "green",
    state.zoom,
  );
  applyMask(greenCtx, maskCtx, maskLayer);

  ctx.drawImage(baseLayer, 0, 0);
  ctx.drawImage(soilLayer, 0, 0);
  ctx.drawImage(greenLayer, 0, 0);
  drawHeritageAura(
    ctx,
    visiblePlants,
    state.selected,
    state.camera,
    state.viewport,
    state.zoom,
  );
  drawSuggestedPlantingHighlight(
    ctx,
    state.suggestedPlantingCell,
    state.camera,
    state.viewport,
    state.now,
    state.zoom,
  );
  drawSuggestedWateringHighlight(
    ctx,
    state.suggestedWateringCell,
    state.camera,
    state.viewport,
    state.now,
    state.zoom,
  );
  drawDampSoil(ctx, visiblePlants, state.camera, state.viewport, state.now, state.zoom);
  state.gardenWorms.forEach((worm) =>
    drawGardenWorm(
      ctx,
      worm,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    ),
  );
  state.weeds.forEach((weed) =>
    drawWeed(ctx, weed, state.camera, state.viewport, state.zoom),
  );
  visiblePlants.forEach((plant) =>
    drawPlant(
      ctx,
      plant,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
      false,
    ),
  );
  visiblePlants.forEach((plant) =>
    drawPlantCareCue(
      ctx,
      plant,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
      state.wateringCareStatusLoaded
        ? state.wateringCareReadyPlantIds?.has(plant.id) ?? false
        : undefined,
    ),
  );
  drawWateringTargets(
    ctx,
    state.wateringTargets,
    state.camera,
    state.viewport,
    state.zoom,
    state.mary,
    state.selected,
  );
  drawDuck(ctx, state.duck, state.camera, state.viewport, state.moving, state.now, state.zoom);
  if (state.tutorialDimmed) {
    drawTutorialDimmer(
      ctx,
      state.viewport,
      state.mary,
      state.camera,
      state.zoom,
    );
    drawSuggestedPlantingHighlight(
      ctx,
      state.suggestedPlantingCell,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    );
    drawSuggestedWateringHighlight(
      ctx,
      state.suggestedWateringCell,
      state.camera,
      state.viewport,
      state.now,
      state.zoom,
    );
  }
  drawMary(ctx, state.mary, state.camera, state.viewport, state.moving, state.now, state.zoom);
  drawSuggestedPlantingLabel(
    ctx,
    state.suggestedPlantingCell,
    state.mary,
    state.camera,
    state.viewport,
    state.now,
    state.zoom,
  );
  drawEffects(ctx, state.effects, state.camera, state.viewport, state.now, state.zoom);
  drawSelection(ctx, state.selected, state.camera, state.viewport, state.zoom);
}

