import { GARDEN_CONFIG, isWithinGarden } from "../lib/gardenConfig";
import {
  gridToWorld,
  worldToScreen,
  type GardenViewport,
  type WorldPoint,
} from "../lib/cameraProjection";
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
import {
  buildHeritageAuraField,
  findHeritageAuraAnchor,
  getHeritageAuraFieldMultiplier,
  getHeritageGrowthProfile,
  type HeritageAuraMultiplier,
  type HeritageGrowthPhase,
} from "../lib/heritageAura";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";
import {
  getLivingGardenDefinition,
  type LivingGardenDefinition,
  type LivingGardenHabitat,
} from "../lib/livingGarden";

export {
  getWorldScreenOrigin,
  gridToWorld,
  screenToGrid,
  worldToScreen,
} from "../lib/cameraProjection";
export type { GardenViewport, WorldPoint } from "../lib/cameraProjection";
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
  personalCommunityFlowers?: Array<{
    gridX: number;
    gridY: number;
    plantId?: string;
  }>;
  shareOnly?: boolean;
  reducedMotion?: boolean;
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
    livingHabitats?: LivingGardenHabitat[];
    gardenJournalEnabled?: boolean;
    gardenJournalUnreadCount?: number;
    unlockedParcels?: Array<{
      minX: number;
      minY: number;
      width: number;
      height: number;
    }>;
    expansionCandidates?: Array<{
      minX: number;
      minY: number;
      width: number;
      height: number;
      careCost: number;
    }>;
    selectedParcel?: {
      minX: number;
      minY: number;
      width: number;
      height: number;
    };
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

function livingGardenHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function drawLivingGardenVisitorGlyph(
  ctx: CanvasRenderingContext2D,
  definition: LivingGardenDefinition,
) {
  const { pixels, palette } = definition.sprite;
  const pixelSize = 1.45;
  const width = (pixels[0]?.length ?? 1) * pixelSize;
  const height = pixels.length * pixelSize;
  const startX = -width / 2;
  const startY = -height / 2;

  pixels.forEach((row, y) => {
    Array.from(row).forEach((colorKey, x) => {
      const color = palette[colorKey];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(
        startX + x * pixelSize,
        startY + y * pixelSize,
        pixelSize + 0.08,
        pixelSize + 0.08,
      );
    });
  });
}

function drawLivingGardenHabitats(
  ctx: CanvasRenderingContext2D,
  habitats: readonly LivingGardenHabitat[],
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  now: number,
  reducedMotion: boolean,
) {
  const visible = [...habitats]
    .sort((left, right) => {
      const leftWorld = gridToWorld(left.gridX, left.gridY);
      const rightWorld = gridToWorld(right.gridX, right.gridY);
      return (
        Math.hypot(leftWorld.x - camera.x, leftWorld.y - camera.y) -
        Math.hypot(rightWorld.x - camera.x, rightWorld.y - camera.y)
      );
    })
    .slice(0, 5);

  for (const habitat of visible) {
    const definition = getLivingGardenDefinition(habitat.key);
    const hash = livingGardenHash(habitat.signature);
    const phase = reducedMotion ? 0 : now / (1_700 + (hash % 1_100)) + hash;
    const orbit = definition.visitorKind === "seedlings" || definition.visitorKind === "canopy" ? 3 : 10;
    const world = gridToWorld(habitat.gridX, habitat.gridY);
    const screen = worldToScreen(
      {
        x: world.x + Math.cos(phase) * orbit,
        y: world.y + Math.sin(phase * 1.3) * (orbit * 0.55),
      },
      camera,
      viewport,
      zoom,
    );
    screen.y -= (16 + (hash % 7)) * zoom;
    if (!isVisible(screen, viewport, 30)) continue;
    ctx.save();
    ctx.translate(Math.round(screen.x), Math.round(screen.y));
    ctx.scale(Math.max(0.7, zoom), Math.max(0.7, zoom));
    ctx.globalAlpha = 0.9;
    drawLivingGardenVisitorGlyph(ctx, definition);
    ctx.restore();
  }
}

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

function getMaryScreenY(viewport: GardenViewport) {
  return viewport.height * GARDEN_CONFIG.maryScreenYRatio;
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

function drawPersonalCommunityFlowerMarkers(
  ctx: CanvasRenderingContext2D,
  flowers: NonNullable<RenderGardenState["personalCommunityFlowers"]>,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  const markerSize = Math.max(8, GARDEN_CONFIG.tileSize * zoom * 0.72);
  for (const flower of flowers) {
    const screen = worldToScreen(
      gridToWorld(flower.gridX, flower.gridY),
      camera,
      viewport,
      zoom,
    );
    if (!isVisible(screen, viewport, markerSize)) continue;
    ctx.save();
    ctx.translate(Math.round(screen.x), Math.round(screen.y));
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = "#c6f4e4";
    ctx.lineWidth = Math.max(2, Math.round(2 * zoom));
    ctx.setLineDash([Math.max(3, 4 * zoom), Math.max(2, 3 * zoom)]);
    ctx.strokeRect(
      -markerSize / 2,
      -markerSize / 2,
      markerSize,
      markerSize,
    );
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff4df";
    ctx.fillRect(-markerSize / 2, -markerSize / 2, 4, 4);
    ctx.restore();
  }
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
    localX === 15 &…15144 tokens truncated… camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
) {
  if (!parcel) return;
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const topLeft = worldToScreen(
    { x: parcel.minX * tileSize, y: parcel.minY * tileSize },
    camera,
    viewport,
    zoom,
  );
  const width = parcel.width * tileSize * zoom;
  const height = parcel.height * tileScreenHeight * zoom;
  ctx.save();
  ctx.fillStyle = "rgba(245, 219, 144, 0.07)";
  ctx.strokeStyle = "rgba(151, 66, 65, 0.58)";
  ctx.lineWidth = Math.max(1, Math.round(zoom));
  ctx.setLineDash([Math.max(3, Math.round(5 * zoom)), Math.max(3, Math.round(4 * zoom))]);
  ctx.fillRect(topLeft.x, topLeft.y, width, height);
  ctx.strokeRect(
    Math.round(topLeft.x) + 0.5,
    Math.round(topLeft.y) + 0.5,
    Math.max(1, Math.round(width) - 1),
    Math.max(1, Math.round(height) - 1),
  );
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
      state.personalGarden.unlockedParcels,
      state.personalGarden.expansionCandidates,
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
      state.personalGarden.unlockedParcels,
      state.personalGarden.expansionCandidates,
    );
    drawSelectedPersonalParcel(
      ctx,
      state.personalGarden.selectedParcel,
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
    drawLivingGardenHabitats(
      ctx,
      state.personalGarden.livingHabitats ?? [],
      state.camera,
      state.viewport,
      state.zoom,
      state.now,
      Boolean(state.reducedMotion),
    );
    // The house is a fixed foreground structure. Garden items may still be
    // placed beneath it, but they should read as being behind the building
    // instead of painting over its roof and walls.
    drawPixelShed(
      ctx,
      state.camera,
      state.viewport,
      state.zoom,
      Boolean(state.personalGarden.gardenJournalEnabled),
      state.personalGarden.gardenJournalUnreadCount ?? 0,
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
  const heritageAuraField = buildHeritageAuraField(visiblePlants);
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
    heritageAuraField,
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
    heritageAuraField,
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
      undefined,
      plant.heritage_at
        ? 1
        : getHeritageAuraFieldMultiplier(
            heritageAuraField,
            plant.grid_x,
            plant.grid_y,
          ),
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
  if (state.personalCommunityFlowers?.length) {
    drawPersonalCommunityFlowerMarkers(
      ctx,
      state.personalCommunityFlowers,
      state.camera,
      state.viewport,
      state.zoom,
    );
  }
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


