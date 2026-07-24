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
};

type TerrainLayer = "base" | "soil" | "green";

let baseLayer: HTMLCanvasElement | null = null;
let soilLayer: HTMLCanvasElement | null = null;
let greenLayer: HTMLCanvasElement | null = null;
let maskLayer: HTMLCanvasElement | null = null;

function terrainCellKey(gridX: number, gridY: number) {
  const worldSize = GARDEN_CONFIG.worldMax - GARDEN_CONFIG.worldMin + 1;
  return (
    (gridY - GARDEN_CONFIG.worldMin) * worldSize +
    (gridX - GARDEN_CONFIG.worldMin)
  );
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
    x: viewport.width / 2 + (point.x - camera.x) * zoom,
    y: getMaryScreenY(viewport) + (point.y - camera.y) * yScale * zoom,
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

function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  layer: TerrainLayer,
  zoom: number,
  occupiedCells: Set<number>,
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

      if (!isWithinGarden(gridX, gridY)) {
        if (layer === "base") {
          ctx.fillStyle = "#d9d5ca";
          ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
          drawBoundaryTree(ctx, x, y, zoom, gridX, gridY);
        }
        continue;
      }

      const tile = getTerrainTile(gridX, gridY);
      const occupied = occupiedCells.has(terrainCellKey(gridX, gridY));
      if (layer === "soil") {
        ctx.fillStyle = "#bd936e";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      } else if (lay×]têÚ$z{-®éÜj×6öç7B6†VVå7G&VæwF‚ÒÒVÆ6VD†ÆdÆ—fW3°¢7G‚ævÆö&ÄÇ†Òã3"¢f—7VÂæF×7G&VæwF‚¢6†VVå7G&VæwFƒ°¢7G‚æf–ÆÅ7G–ÆRÒ"3“6#v##°¢7G‚æf–ÆÅ&V7B‚ÓBÂÓ2Â"Â“°¢7G‚æf–ÆÅ&V7Bƒ2ÂÂ"Â“°¢Ð¢7G‚ç&W7F÷&R‚“°¢Ð§Ð ¦gVæ7F–öâG&u6VÆV7F–öâ€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢6VÆV7FVC¢6VÆV7FVD6VÆÂÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢¦ööÓ¢çVÖ&W"À¢’°¢–b‚6VÆV7FVB’&WGW&ã°¢6öç7Bö–çBÒv÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB‡6VÆV7FVBæw&–E‚Â6VÆV7FVBæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢–b‚—5f—6–&ÆR‡ö–çBÂf–Ww÷'B’’&WGW&ã°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡ö–çBç‚’ÂÖF‚ç&÷VæB‡ö–çBç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚ævÆö&ÄÇ†Òã“S°¢7G‚æf–ÆÅ7G–ÆRÒ"6ffcFF2#°¢7G‚æf–ÆÅ&V7B‚Ó’ÂÓrÂRÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó’ÂÓrÂ"ÂR“°¢7G‚æf–ÆÅ&V7BƒBÂÓrÂRÂ"“°¢7G‚æf–ÆÅ&V7BƒrÂÓrÂ"ÂR“°¢7G‚æf–ÆÅ&V7B‚Ó’ÂRÂRÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó’Â"Â"ÂR“°¢7G‚æf–ÆÅ&V7BƒBÂRÂRÂ"“°¢7G‚æf–ÆÅ&V7BƒrÂ"Â"ÂR“°¢7G‚æf–ÆÅ7G–ÆRÒ"6ƒFcF"#°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÓbÂBÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÓbÂ"ÂB“°¢7G‚æf–ÆÅ&V7BƒBÂÓbÂBÂ"“°¢7G‚æf–ÆÅ&V7BƒbÂÓbÂ"ÂB“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂBÂBÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó‚Â"Â"ÂB“°¢7G‚æf–ÆÅ&V7BƒBÂBÂBÂ"“°¢7G‚æf–ÆÅ&V7BƒbÂ"Â"ÂB“°¢7G‚ç&W7F÷&R‚“°§Ð ¦gVæ7F–öâG&uvFW&–æuF&vWG2€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢F&vWG3¢'&“ÄæöäçVÆÆ&ÆSÅ6VÆV7FVD6VÆÃãâÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢¦ööÓ¢çVÖ&W"À¢Ö'“¢v÷&ÆEö–çBÀ¢6VÆV7FVC¢6VÆV7FVD6VÆÂÀ¢’°¢f÷"†6öç7BF&vWBöbF&vWG2’°¢6öç7Bö–çBÒv÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB‡F&vWBæw&–E‚ÂF&vWBæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢–b‚—5f—6–&ÆR‡ö–çBÂf–Ww÷'B’’6öçF–çVS°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡ö–çBç‚’ÂÖF‚ç&÷VæB‡ö–çBç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚ævÆö&ÄÇ†Ò°¢7G‚æf–ÆÅ7G–ÆRÒ"63–cvfb#°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÓ‚ÂbÂ"“°¢7G‚æf–ÆÅ&V7Bƒ"ÂÓ‚ÂbÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂbÂbÂ"“°¢7G‚æf–ÆÅ&V7Bƒ"ÂbÂbÂ"“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÓbÂ"ÂR“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÂ"ÂR“°¢7G‚æf–ÆÅ&V7BƒbÂÓbÂ"ÂR“°¢7G‚æf–ÆÅ&V7BƒbÂÂ"ÂR“°¢7G‚ç&W7F÷&R‚“°¢Ð ¢–b‚6VÆV7FVBÇÂF&vWG2æÆVæwF‚ÓÓÒ’&WGW&ã°¢6öç7B6VÆV7FVEö–çBÒv÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB‡6VÆV7FVBæw&–E‚Â6VÆV7FVBæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢–b‚—5f—6–&ÆR‡6VÆV7FVEö–çBÂf–Ww÷'B’’&WGW&ã°¢6öç7B6VÆV7FVEv÷&ÆBÒw&–EFõv÷&ÆB‡6VÆV7FVBæw&–E‚Â6VÆV7FVBæw&–E’“°¢6öç7B6÷&æW%‚ÒÖ'’ç‚ÃÒ6VÆV7FVEv÷&ÆBç‚òÓb¢c°¢6öç7B6÷&æW%’ÒÖ'’ç’ÃÒ6VÆV7FVEv÷&ÆBç’òÓb¢c°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡6VÆV7FVEö–çBç‚’ÂÖF‚ç&÷VæB‡6VÆV7FVEö–çBç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚ævÆö&ÄÇ†Ò°¢7G‚æf–ÆÅ7G–ÆRÒ"6CsCcFB#°¢7G‚æf–ÆÅ&V7B†6÷&æW%‚Âò6÷&æW%‚¢6÷&æW%‚ÒBÂ6÷&æW%’ÂRÂ"“°¢7G‚æf–ÆÅ&V7B†6÷&æW%‚Â6÷&æW%’Âò6÷&æW%’¢6÷&æW%’ÒBÂ"ÂR“°¢7G‚ç&W7F÷&R‚“°§Ð ¦gVæ7F–öâG&tÖ'’€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢ö–çC¢v÷&ÆEö–çBÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢Ö÷f–æs¢&ööÆVâÀ¢æ÷s¢çVÖ&W"À¢¦ööÓ¢çVÖ&W"À¢’°¢6öç7B67&VVâÒv÷&ÆEFõ67&VVâ‡ö–çBÂ6ÖW&Âf–Ww÷'BÂ¦ööÒ“°¢6öç7B7FWÒÖ÷f–ærbbÖF‚æfÆö÷"†æ÷ròs’R"ÓÓÒò¢°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡67&VVâç‚’ÂÖF‚ç&÷VæB‡67&VVâç’’Ò7FW¢¦ööÒ“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚æf–ÆÅ7G–ÆRÒ"3VS&c#R#°¢7G‚æf–ÆÅ&V7B‚ÓbÂÓ#"Â"Â’“°¢7G‚æf–ÆÅ&V7B‚Ó‚ÂÓ’ÂbÂ’“°¢7G‚æf–ÆÅ7G–ÆRÒ"6SV3F#°¢7G‚æf–ÆÅ&V7B‚ÓRÂÓ"ÂÂR“°¢7G‚æf–ÆÅ7G–ÆRÒ"6cS3B#°¢7G‚æf–ÆÅ&V7B‚ÓrÂÓ‚ÂBÂ‚“°¢7G‚æf–ÆÅ7G–ÆRÒ"3cSsF#°¢7G‚æf–ÆÅ&V7B‚ÓbÂÓrÂBÂ2“°¢7G‚æf–ÆÅ&V7Bƒ"ÂÓrÂBÂ2“°¢7G‚æf–ÆÅ&V7B‚Ó"ÂÓ2ÂBÂ’“°¢7G‚æf–ÆÅ7G–ÆRÒ"3C“3ƒ&R#°¢7G‚æf–ÆÅ&V7B‚ÓrÂRÂbÂB²7FW“°¢7G‚æf–ÆÅ&V7BƒÂRÂbÂRÒ7FW“°¢7G‚æf–ÆÅ7G–ÆRÒ"33&#b#°¢7G‚æf–ÆÅ&V7B‚ÓrÂ‚²7FWÂbÂ"“°¢7G‚æf–ÆÅ&V7BƒÂ’Ò7FWÂbÂ"“°¢7G‚ç&W7F÷&R‚“°§Ð ¦gVæ7F–öâG&tGV6²€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢ö–çC¢v÷&ÆEö–çBÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢Ö÷f–æs¢&ööÆVâÀ¢æ÷s¢çVÖ&W"À¢¦ööÓ¢çVÖ&W"À¢’°¢6öç7B67&VVâÒv÷&ÆEFõ67&VVâ‡ö–çBÂ6ÖW&Âf–Ww÷'BÂ¦ööÒ“°¢6öç7BvFFÆRÒÖ÷f–ærbbÖF‚æfÆö÷"†æ÷ròS’R"ÓÓÒò¢Ó°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡67&VVâç‚’²vFFÆR¢¦ööÒÂÖF‚ç&÷VæB‡67&VVâç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢7G‚æf–ÆÅ7G–ÆRÒ"6cVcFb#°¢7G‚æf–ÆÅ&V7B‚ÓRÂÓ‚ÂÂ‚“°¢7G‚æf–ÆÅ&V7B‚Ó2ÂÓ"ÂrÂb“°¢7G‚æf–ÆÅ7G–ÆRÒ"3&c33#°¢7G‚æf–ÆÅ&V7Bƒ"ÂÓÂÂ“°¢7G‚æf–ÆÅ7G–ÆRÒ"6Cf6"#°¢7G‚æf–ÆÅ&V7BƒBÂÓ’ÂBÂ"“°¢7G‚æf–ÆÅ&V7B‚ÓBÂÂ2Â“°¢7G‚æf–ÆÅ&V7Bƒ"ÂÂ2Â“°¢7G‚ç&W7F÷&R‚“°§Ð ¦gVæ7F–öâG&tVffV7G2€¢7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÀ¢VffV7G3¢v&FVäVffV7EµÒÀ¢6ÖW&¢v÷&ÆEö–çBÀ¢f–Ww÷'C¢v&FVåf–Ww÷'BÀ¢æ÷s¢çVÖ&W"À¢¦ööÓ¢çVÖ&W"À¢’°¢f÷"†6öç7BVffV7BöbVffV7G2’°¢6öç7BvRÒæ÷rÒVffV7Bç7F'FVDC°¢6öç7BGW&F–öâÐ¢VffV7Bæ¶–æBÓÓÒ&6&R"ò¢VffV7Bæ¶–æBÓÓÒ'v÷&Ò"òƒ¢“°¢–b†vRÂÇÂvRâGW&F–öâ’6öçF–çVS°¢6öç7B&öw&W72ÒvRòGW&F–öã°¢–b†VffV7Bæ¶–æBÓÓÒ'7&’"’°¢6öç7Bg&öÒÒv÷&ÆEFõ67&VVâ€¢²ƒ¢VffV7Bæg&öÕ‚Â“¢VffV7Bæg&öÕ’Ò‚ÒÀ¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢6öç7BF&vWEv÷&ÆBÒw&–EFõv÷&ÆB†VffV7Bæw&–E‚ÂVffV7Bæw&–E’“°¢6öç7BF—&V7F–öå‚ÒF&vWEv÷&ÆBç‚ÒVffV7Bæg&öÕƒ°¢6öç7BF—&V7F–öå’ÒF&vWEv÷&ÆBç’ÒVffV7Bæg&öÕ“°¢6öç7BF—&V7F–öäÆVæwF‚ÒÖF‚æÖ‚ƒÂÖF‚æ‡—÷B†F—&V7F–öå‚ÂF—&V7F–öå’’“°¢6öç7BW‡FVæFVEF&vWBÒ°¢ƒ¢F&vWEv÷&ÆBç‚²†F—&V7F–öå‚òF—&V7F–öäÆVæwF‚’¢3"À¢“¢F&vWEv÷&ÆBç’²†F—&V7F–öå’òF—&V7F–öäÆVæwF‚’¢3"À¢Ó°¢6öç7BFòÒv÷&ÆEFõ67&VVâ€¢W‡FVæFVEF&vWBÀ¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢7G‚ç6fR‚“°¢7G‚ævÆö&ÄÇ†ÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’’¢ãsC°¢7G‚æf–ÆÅ7G–ÆRÒ"3sV#v6b#°¢f÷"†ÆWB–æFW‚Ò²–æFW‚ÃÒ#²–æFW‚³Ò’°¢6öç7BBÒ–æFW‚ò3°¢6öç7B&2ÒÖF‚ç6–â‡B¢ÖF‚å’’¢‚¢¦ööÓ°¢7G‚æf–ÆÅ&V7B€¢ÖF‚ç&÷VæB†g&öÒç‚²‡Fòç‚Òg&öÒç‚’¢B’À¢ÖF‚ç&÷VæB†g&öÒç’²‡Fòç’Òg&öÒç’’¢BÒ&2’À¢ÖF‚æÖ‚ƒÂÖF‚ç&÷VæBƒ"¢¦ööÒ’’À¢ÖF‚æÖ‚ƒÂÖF‚ç&÷VæBƒ"¢¦ööÒ’’À¢“°¢Ð¢7G‚ç&W7F÷&R‚“°¢6öçF–çVS°¢Ð¢6öç7Bö–çBÐ¢VffV7Bæ¶–æBÓÓÒ&6&R ¢òv÷&ÆEFõ67&VVâ‡²ƒ¢VffV7Bç‚Â“¢VffV7Bç’ÒÂ6ÖW&Âf–Ww÷'BÂ¦ööÒ¢¢v÷&ÆEFõ67&VVâ€¢w&–EFõv÷&ÆB†VffV7Bæw&–E‚ÂVffV7Bæw&–E’’À¢6ÖW&À¢f–Ww÷'BÀ¢¦ööÒÀ¢“°¢7G‚ç6fR‚“°¢7G‚çG&ç6ÆFR„ÖF‚ç&÷VæB‡ö–çBç‚’ÂÖF‚ç&÷VæB‡ö–çBç’’“°¢7G‚ç66ÆR‡¦ööÒÂ¦ööÒ“°¢–b†VffV7Bæ¶–æBÓÓÒ&6&R"’°¢6öç7BfFT–âÒÖF‚æÖ–âƒÂ&öw&W72òã"“°¢6öç7BfFT÷WBÒÖF‚æÖ–âƒÂƒÒ&öw&W72’òã#‚“°¢7G‚ævÆö&ÄÇ†ÒÖF‚æÖ–â†fFT–âÂfFT÷WB“°¢7G‚çG&ç6ÆFRƒÂÓ3Ò&öw&W72¢‚“°¢7G‚çFW‡DÆ–vâÒ&6VçFW"#°¢7G‚çFW‡D&6VÆ–æRÒ&Ö–FFÆR#°¢7G‚æföçBÒs“G‚$6÷W&–W"æWr"ÂÖöæ÷76Rs°¢7G‚æÆ–æUv–GF‚Ò3°¢7G‚ç7G&ö¶U7G–ÆRÒ'&v&ƒ#SRÂ#CBÂ##2Âã“"’#°¢7G‚æf–ÆÅ7G–ÆRÒVffV7BæF–Ç”&öçW2ò"3SsƒcV"¢"63“FcF2#°¢6öç7BÆ&VÂÒ²G¶VffV7BçfÇVWÖ°¢7G‚ç7G&ö¶UFW‡B†Æ&VÂÂÂ“°¢7G‚æf–ÆÅFW‡B†Æ&VÂÂÂ“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'vFW""’°¢7G‚æf–ÆÅ7G–ÆRÒ"3sV#v6b#°¢f÷"†ÆWB–æFW‚Ò²–æFW‚ÂC²–æFW‚³Ò’°¢6öç7Böfg6WBÒ–æFW‚¢BÒc°¢7G‚æf–ÆÅ&V7B†öfg6WBÂÓ#²&öw&W72¢b²†–æFW‚R"’¢2Â"Â2“°¢Ð¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'v÷&Ò"’°¢6öç7Bv–vvÆRÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’¢b’¢3°¢7G‚ævÆö&ÄÇ†ÒÖF‚ç6–â‡&öw&W72¢ÖF‚å’“°¢7G‚çG&ç6ÆFR‡v–vvÆRÂÓ"Ò&öw&W72¢"“°¢7G‚æf–ÆÅ7G–ÆRÒ"6Cƒ†s"#°¢7G‚æf–ÆÅ&V7B‚ÓrÂÓ"ÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"63CfcVb#°¢7G‚æf–ÆÅ&V7B‚Ó"ÂÓBÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"6“SF2#°¢7G‚æf–ÆÅ&V7Bƒ2ÂÓ"ÂRÂB“°¢7G‚æf–ÆÅ7G–ÆRÒ"33C#3b#°¢7G‚æf–ÆÅ&V7BƒbÂÓÂÂ“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'ÆçB"’°¢7G‚æf–ÆÅ7G–ÆRÒ"3ƒscCCB#°¢7G‚æf–ÆÅ&V7B‚ÓrÒ&öw&W72¢BÂÓ2Â2Â"“°¢7G‚æf–ÆÅ&V7BƒB²&öw&W72¢BÂÓRÂ2Â"“°¢ÒVÇ6R–b†VffV7Bæ¶–æBÓÓÒ'F‚"’°¢7G‚æf–ÆÅ7G–ÆRÒ"6S3C“R#°¢7G‚æf–ÆÅ&V7B‚Ó‚Ò&öw&W72¢"ÂÓrÒ&öw&W72¢2Â2Â"“°¢7G‚æf–ÆÅ&V7BƒR²&öw&W72¢"ÂÓRÒ&öw&W72¢BÂ2Â"“°¢ÒVÇ6R°¢7G‚æf–ÆÅ7G–ÆRÒ"6c&C†2#°¢7G‚æf–ÆÅ&V7B‚ÓbÒ&öw&W72¢RÂÓÒ&öw&W72¢bÂ2Â2“°¢7G‚æf–ÆÅ&V7Bƒ2²&öw&W72¢RÂÓrÒ&öw&W72¢‚Â2Â2“°¢Ð¢7G‚ç&W7F÷&R‚“°¢Ð§Ð ¦W‡÷'BgVæ7F–öâ&VæFW$v&FVâ†7Gƒ¢6çf5&VæFW&–æt6öçFW‡C$BÂ7FFS¢&VæFW$v&FVå7FFR’°¢–b‡7FFRæÖöFRÓÓÒ'W'6öæÂ"bb7FFRçW'6öæÄv&FVâ’°¢6öç7Bf—6–&ÆUÆçG2Ò7FFRçÆçG2æf–ÇFW"€¢‡ÆçB’ÓâvWEÆçEf—7VÂ‡ÆçBÂ7FFRææ÷r’ç7FFRÓÒ&W‡—&VB"À¢“°¢7G‚æ–ÖvU6Öö÷F†–ætVæ&ÆVBÒfÇ6S°¢7G‚æ6ÆV%&V7BƒÂÂ7FFRçf–Ww÷'Bçv–GF‚Â7FFRçf–Ww÷'Bæ†V–v‡B“°¢G&uW'6öæÅFW'&–â€¢7G‚À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRçW'6öæÄv&FVâæÖ–å‚À¢7FFRçW'6öæÄv&FVâæÖ–å’À¢7FFRçW'6öæÄv&FVâçv–GF‚À¢7FFRçW'6öæÄv&FVâæ†V–v‡BÀ¢7FFRçW'6öæÄv&FVâææW‡DW‡ç6–öâÀ¢“°¢G&uW'6öæÅF‡2€¢7G‚À¢7FFRçW'6öæÄv&FVâçF‡2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&uW'6öæÄFV6÷&F–öç2€¢7G‚À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRçW'6öæÄv&FVâæÖ–å‚À¢7FFRçW'6öæÄv&FVâæÖ–å’À¢7FFRçW'6öæÄv&FVâçv–GF‚À¢7FFRçW'6öæÄv&FVâæ†V–v‡BÀ¢7FFRçW'6öæÄv&FVâææW‡DW‡ç6–öâÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&uW'6öæÅ6ö–ÅF6†W2€¢7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢“°¢G&tF×6ö–Â†7G‚Âf—6–&ÆUÆçG2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&uW'6öæÄFWF„ö&¦V7G2€¢7G‚À¢f—6–&ÆUÆçG2À¢7FFRçW'6öæÄv&FVâæVÆVÖVçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tGV6²†7G‚Â7FFRæGV6²Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢–b‡7FFRçGWF÷&–ÄF–ÖÖVB’°¢G&uGWF÷&–ÄF–ÖÖW"€¢7G‚À¢7FFRçf–Ww÷'BÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢Ð¢G&tÖ'’†7G‚Â7FFRæÖ'’Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u7VvvW7FVEÆçF–ætÆ&VÂ€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tVffV7G2†7G‚Â7FFRæVffV7G2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u6VÆV7F–öâ†7G‚Â7FFRç6VÆV7FVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ“°¢&WGW&ã°¢Ð ¢&6TÆ–W"ÒVç7W&TÆ–W"†&6TÆ–W"Â7FFRçf–Ww÷'B“°¢6ö–ÄÆ–W"ÒVç7W&TÆ–W"‡6ö–ÄÆ–W"Â7FFRçf–Ww÷'B“°¢w&VVäÆ–W"ÒVç7W&TÆ–W"†w&VVäÆ–W"Â7FFRçf–Ww÷'B“°¢Ö6´Æ–W"ÒVç7W&TÆ–W"†Ö6´Æ–W"Â7FFRçf–Ww÷'B“°¢6öç7B&6T7G‚Ò&6TÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7B6ö–Ä7G‚Ò6ö–ÄÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7Bw&VVä7G‚Òw&VVäÆ–W"ævWD6öçFW‡B‚#&B"“°¢6öç7BÖ6´7G‚ÒÖ6´Æ–W"ævWD6öçFW‡B‚#&B"“°¢–b‚&6T7G‚ÇÂ6ö–Ä7G‚ÇÂw&VVä7G‚ÇÂÖ6´7G‚’&WGW&ã° ¢6öç7Bf—6–&ÆUÆçG2Ò7FFRçÆçG2æf–ÇFW"€¢‡ÆçB’ÓâvWEÆçEf—7VÂ‡ÆçBÂ7FFRææ÷r’ç7FFRÓÒ&W‡—&VB"À¢“°¢6öç7Bö67W–VD6VÆÇ2ÒæWr6WB€¢°¢ââçf—6–&ÆUÆçG2æÖ‚‡ÆçB’ÓâFW'&–ä6VÆÄ¶W’‡ÆçBæw&–E÷‚ÂÆçBæw&–E÷’’’À¢ââç7FFRçvVVG2æÖ‚‡vVVB’ÓâFW'&–ä6VÆÄ¶W’‡vVVBæw&–E÷‚ÂvVVBæw&–E÷’’’À¢ÒÀ¢“°¢7G‚æ–ÖvU6Öö÷F†–ætVæ&ÆVBÒfÇ6S°¢7G‚æ6ÆV%&V7BƒÂÂ7FFRçf–Ww÷'Bçv–GF‚Â7FFRçf–Ww÷'Bæ†V–v‡B“°¢G&uFW'&–äÆ–W"†&6T7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ&&6R"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2“°¢G&uFW'&–äÆ–W"‡6ö–Ä7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ'6ö–Â"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2“°¢G&t6öÆ÷$Ö6²€¢Ö6´7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢'6ö–Â"À¢7FFRç¦ööÒÀ¢“°¢Ç”Ö6²‡6ö–Ä7G‚ÂÖ6´7G‚ÂÖ6´Æ–W"“°¢G&uFW'&–äÆ–W"†w&VVä7G‚Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ&w&VVâ"Â7FFRç¦ööÒÂö67W–VD6VÆÇ2“°¢G&t6öÆ÷$Ö6²€¢Ö6´7G‚À¢f—6–&ÆUÆçG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢&w&VVâ"À¢7FFRç¦ööÒÀ¢“°¢Ç”Ö6²†w&VVä7G‚ÂÖ6´7G‚ÂÖ6´Æ–W"“° ¢7G‚æG&t–ÖvR†&6TÆ–W"ÂÂ“°¢7G‚æG&t–ÖvR‡6ö–ÄÆ–W"ÂÂ“°¢7G‚æG&t–ÖvR†w&VVäÆ–W"ÂÂ“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEvFW&–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEvFW&–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tF×6ö–Â†7G‚Âf—6–&ÆUÆçG2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢7FFRæv&FVåv÷&×2æf÷$V6‚‚‡v÷&Ò’Óà¢G&tv&FVåv÷&Ò€¢7G‚À¢v÷&ÒÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢’À¢“°¢7FFRçvVVG2æf÷$V6‚‚‡vVVB’Óà¢G&uvVVB†7G‚ÂvVVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ’À¢“°¢f—6–&ÆUÆçG2æf÷$V6‚‚‡ÆçB’Óà¢G&uÆçB€¢7G‚À¢ÆçBÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢fÇ6RÀ¢’À¢“°¢f—6–&ÆUÆçG2æf÷$V6‚‚‡ÆçB’Óà¢G&uÆçD6&T7VR€¢7G‚À¢ÆçBÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢7FFRçvFW&–æt6&U7FGW4ÆöFV@¢ò7FFRçvFW&–æt6&U&VG•ÆçD–G3òæ†2‡ÆçBæ–B’óòfÇ6P¢¢VæFVf–æVBÀ¢’À¢“°¢G&uvFW&–æuF&vWG2€¢7G‚À¢7FFRçvFW&–æuF&vWG2À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRç¦ööÒÀ¢7FFRæÖ'’À¢7FFRç6VÆV7FVBÀ¢“°¢G&tGV6²†7G‚Â7FFRæGV6²Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢–b‡7FFRçGWF÷&–ÄF–ÖÖVB’°¢G&uGWF÷&–ÄF–ÖÖW"€¢7G‚À¢7FFRçf–Ww÷'BÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEÆçF–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&u7VvvW7FVEvFW&–æt†–v†Æ–v‡B€¢7G‚À¢7FFRç7VvvW7FVEvFW&–æt6VÆÂÀ¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢Ð¢G&tÖ'’†7G‚Â7FFRæÖ'’Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRæÖ÷f–ærÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u7VvvW7FVEÆçF–ætÆ&VÂ€¢7G‚À¢7FFRç7VvvW7FVEÆçF–æt6VÆÂÀ¢7FFRæÖ'’À¢7FFRæ6ÖW&À¢7FFRçf–Ww÷'BÀ¢7FFRææ÷rÀ¢7FFRç¦ööÒÀ¢“°¢G&tVffV7G2†7G‚Â7FFRæVffV7G2Â7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRææ÷rÂ7FFRç¦ööÒ“°¢G&u6VÆV7F–öâ†7G‚Â7FFRç6VÆV7FVBÂ7FFRæ6ÖW&Â7FFRçf–Ww÷'BÂ7FFRç¦ööÒ“°§Ð Ð