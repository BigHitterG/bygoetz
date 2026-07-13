import { GARDEN_CONFIG, isWithinGarden } from "../lib/gardenConfig";
import { getRoseVisual, type RoseRecord } from "../lib/roseLifecycle";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";

export type WorldPoint = { x: number; y: number };
export type GardenViewport = { width: number; height: number };
export type SelectedCell = { gridX: number; gridY: number; roseId?: string } | null;
export type GardenEffect = {
  kind: "plant" | "water";
  gridX: number;
  gridY: number;
  startedAt: number;
};

export type RenderGardenState = {
  viewport: GardenViewport;
  camera: WorldPoint;
  mary: WorldPoint;
  duck: WorldPoint;
  roses: RoseRecord[];
  selected: SelectedCell;
  effects: GardenEffect[];
  moving: boolean;
  now: number;
};

type TerrainLayer = "base" | "soil" | "green";

let baseLayer: HTMLCanvasElement | null = null;
let soilLayer: HTMLCanvasElement | null = null;
let greenLayer: HTMLCanvasElement | null = null;
let maskLayer: HTMLCanvasElement | null = null;

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
): WorldPoint {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  const zoom = GARDEN_CONFIG.cameraZoom;
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
) {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  const zoom = GARDEN_CONFIG.cameraZoom;
  const worldX = camera.x + (screenX - viewport.width / 2) / zoom;
  const worldY = camera.y + (screenY - getMaryScreenY(viewport)) / (yScale * zoom);
  return {
    gridX: Math.floor(worldX / GARDEN_CONFIG.tileSize),
    gridY: Math.floor(worldY / GARDEN_CONFIG.tileSize),
  };
}

function getVisibleGridBounds(camera: WorldPoint, viewport: GardenViewport) {
  const { tileSize, tileScreenHeight, cameraZoom: zoom } = GARDEN_CONFIG;
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

function drawGrassMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 4 * scale, y + 7 * scale, scale, 3 * scale);
  ctx.fillRect(x + 6 * scale, y + 5 * scale, scale, 5 * scale);
  ctx.fillRect(x + 8 * scale, y + 7 * scale, scale, 3 * scale);
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
) {
  const { tileSize, tileScreenHeight, cameraZoom: zoom } = GARDEN_CONFIG;
  const cellWidth = tileSize * zoom;
  const cellHeight = tileScreenHeight * zoom;
  const visible = getVisibleGridBounds(camera, viewport);
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  if (layer === "base") {
    ctx.fillStyle = "#fafaf7";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
  }

  for (let gridY = visible.minGridY; gridY <= visible.maxGridY; gridY += 1) {
    for (let gridX = visible.minGridX; gridX <= visible.maxGridX; gridX += 1) {
      const topLeft = worldToScreen(
        { x: gridX * tileSize, y: gridY * tileSize },
        camera,
        viewport,
      );
      const x = Math.floor(topLeft.x);
      const y = Math.floor(topLeft.y);

      if (!isWithinGarden(gridX, gridY)) {
        if (layer === "base") {
          ctx.fillStyle = "#eef0eb";
          ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
          drawBoundaryTree(ctx, x, y, zoom, gridX, gridY);
        }
        continue;
      }

      const tile = getTerrainTile(gridX, gridY);
      if (layer === "soil") {
        ctx.fillStyle = "#ad8b69";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      } else if (layer === "green") {
        ctx.fillStyle = "#9eac6c";
        ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
      }

      if (tile.detail <= 2) {
        const detailColor =
          layer === "base" ? "#d2d4cf" : layer === "soil" ? "#866c53" : "#667548";
        drawGrassMark(ctx, x, y, zoom, detailColor);
      } else if (tile.detail === 5) {
        ctx.fillStyle =
          layer === "base" ? "#d9dad6" : layer === "soil" ? "#94765b" : "#758453";
        ctx.fillRect(x + 3 * zoom, y + 6 * zoom, 5 * zoom, zoom);
        ctx.fillRect(x + 8 * zoom, y + 7 * zoom, 4 * zoom, zoom);
      }

      if (layer === "green" && tile.accent === 1) {
        ctx.fillStyle = terrainNoise(gridX, gridY, 19) > 0.5 ? "#f2d46f" : "#e98673";
        ctx.fillRect(x + 11 * zoom, y + 4 * zoom, 2 * zoom, 2 * zoom);
        ctx.fillStyle = "#6e7845";
        ctx.fillRect(x + 12 * zoom, y + 6 * zoom, zoom, 2 * zoom);
      }
    }
  }
}

function drawColorMask(
  ctx: CanvasRenderingContext2D,
  roses: RoseRecord[],
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  kind: "soil" | "green",
) {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  for (const rose of roses) {
    const visual = getRoseVisual(rose, now);
    if (visual.colorRadius <= 0) continue;
    const point = worldToScreen(gridToWorld(rose.grid_x, rose.grid_y), camera, viewport);
    const radiusMultiplier = kind === "soil" ? 1.55 : 0.9;
    const radius = visual.colorRadius * GARDEN_CONFIG.cameraZoom * radiusMultiplier;
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

function drawRose(
  ctx: CanvasRenderingContext2D,
  rose: RoseRecord,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
) {
  const point = worldToScreen(gridToWorld(rose.grid_x, rose.grid_y), camera, viewport);
  if (!isVisible(point, viewport)) return;
  const visual = getRoseVisual(rose, now);
  const wilting = visual.state === "wilting";
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(GARDEN_CONFIG.cameraZoom, GARDEN_CONFIG.cameraZoom);

  if (visual.state === "dead") {
    ctx.fillStyle = "#6f573d";
    ctx.fillRect(-1, -6, 2, 7);
    ctx.fillRect(-5, -5, 5, 2);
    ctx.fillRect(0, -3, 5, 2);
    ctx.restore();
    return;
  }

  ctx.fillStyle = wilting ? "#677052" : "#45643f";
  ctx.fillRect(-1, -9, 2, 10);
  ctx.fillRect(-5, -5, 5, 2);
  ctx.fillRect(1, -4, 4, 2);
  if (visual.state === "sprout") {
    ctx.fillStyle = "#71854b";
    ctx.fillRect(-3, -10, 6, 4);
    ctx.restore();
    return;
  }

  ctx.fillStyle = wilting ? "#a76d62" : "#d94a4e";
  ctx.fillRect(-4, -14, 8, 7);
  ctx.fillRect(-6, -12, 12, 3);
  ctx.fillStyle = wilting ? "#845047" : "#a51f31";
  ctx.fillRect(-2, -13, 4, 4);
  ctx.fillStyle = "#f2a36f";
  ctx.fillRect(-1, -12, 2, 2);
  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  selected: SelectedCell,
  camera: WorldPoint,
  viewport: GardenViewport,
) {
  if (!selected) return;
  const point = worldToScreen(gridToWorld(selected.gridX, selected.gridY), camera, viewport);
  if (!isVisible(point, viewport)) return;
  ctx.save();
  ctx.translate(Math.round(point.x), Math.round(point.y));
  ctx.scale(GARDEN_CONFIG.cameraZoom, GARDEN_CONFIG.cameraZoom);
  ctx.fillStyle = "#6f4c3e";
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

function drawMary(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  moving: boolean,
  now: number,
) {
  const screen = worldToScreen(point, camera, viewport);
  const step = moving && Math.floor(now / 170) % 2 === 0 ? 1 : 0;
  ctx.save();
  ctx.translate(Math.round(screen.x), Math.round(screen.y) - step * GARDEN_CONFIG.cameraZoom);
  ctx.scale(GARDEN_CONFIG.cameraZoom, GARDEN_CONFIG.cameraZoom);
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

function drawDuck(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  moving: boolean,
  now: number,
) {
  const screen = worldToScreen(point, camera, viewport);
  const waddle = moving && Math.floor(now / 150) % 2 === 0 ? 1 : -1;
  ctx.save();
  ctx.translate(Math.round(screen.x) + waddle * GARDEN_CONFIG.cameraZoom, Math.round(screen.y));
  ctx.scale(GARDEN_CONFIG.cameraZoom, GARDEN_CONFIG.cameraZoom);
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
) {
  for (const effect of effects) {
    const age = now - effect.startedAt;
    if (age < 0 || age > 900) continue;
    const progress = age / 900;
    const point = worldToScreen(gridToWorld(effect.gridX, effect.gridY), camera, viewport);
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(GARDEN_CONFIG.cameraZoom, GARDEN_CONFIG.cameraZoom);
    if (effect.kind === "water") {
      ctx.fillStyle = "#75b7cf";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 4 - 6;
        ctx.fillRect(offset, -20 + progress * 16 + (index % 2) * 3, 2, 3);
      }
    } else {
      ctx.fillStyle = "#876444";
      ctx.fillRect(-7 - progress * 4, -3, 3, 2);
      ctx.fillRect(4 + progress * 4, -5, 3, 2);
    }
    ctx.restore();
  }
}

export function renderGarden(ctx: CanvasRenderingContext2D, state: RenderGardenState) {
  baseLayer = ensureLayer(baseLayer, state.viewport);
  soilLayer = ensureLayer(soilLayer, state.viewport);
  greenLayer = ensureLayer(greenLayer, state.viewport);
  maskLayer = ensureLayer(maskLayer, state.viewport);
  const baseCtx = baseLayer.getContext("2d");
  const soilCtx = soilLayer.getContext("2d");
  const greenCtx = greenLayer.getContext("2d");
  const maskCtx = maskLayer.getContext("2d");
  if (!baseCtx || !soilCtx || !greenCtx || !maskCtx) return;

  const visibleRoses = state.roses.filter(
    (rose) => getRoseVisual(rose, state.now).state !== "expired",
  );
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawTerrainLayer(baseCtx, state.camera, state.viewport, "base");
  drawTerrainLayer(soilCtx, state.camera, state.viewport, "soil");
  drawColorMask(maskCtx, visibleRoses, state.camera, state.viewport, state.now, "soil");
  applyMask(soilCtx, maskCtx, maskLayer);
  drawTerrainLayer(greenCtx, state.camera, state.viewport, "green");
  drawColorMask(maskCtx, visibleRoses, state.camera, state.viewport, state.now, "green");
  applyMask(greenCtx, maskCtx, maskLayer);

  ctx.drawImage(baseLayer, 0, 0);
  ctx.drawImage(soilLayer, 0, 0);
  ctx.drawImage(greenLayer, 0, 0);
  drawSelection(ctx, state.selected, state.camera, state.viewport);
  visibleRoses.forEach((rose) => drawRose(ctx, rose, state.camera, state.viewport, state.now));
  drawDuck(ctx, state.duck, state.camera, state.viewport, state.moving, state.now);
  drawMary(ctx, state.mary, state.camera, state.viewport, state.moving, state.now);
  drawEffects(ctx, state.effects, state.camera, state.viewport, state.now);
}

