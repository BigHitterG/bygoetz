import { GARDEN_CONFIG } from "../lib/gardenConfig";
import { getRoseVisual, type RoseRecord } from "../lib/roseLifecycle";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";

export type WorldPoint = { x: number; y: number };
export type SelectedCell = { gridX: number; gridY: number; roseId?: string } | null;
export type GardenEffect = {
  kind: "plant" | "water";
  gridX: number;
  gridY: number;
  startedAt: number;
};

export type RenderGardenState = {
  camera: WorldPoint;
  mary: WorldPoint;
  duck: WorldPoint;
  roses: RoseRecord[];
  selected: SelectedCell;
  effects: GardenEffect[];
  moving: boolean;
  now: number;
};

let grayLayer: HTMLCanvasElement | null = null;
let colorLayer: HTMLCanvasElement | null = null;
let maskLayer: HTMLCanvasElement | null = null;

function ensureLayer(current: HTMLCanvasElement | null) {
  if (current) return current;
  const canvas = document.createElement("canvas");
  canvas.width = GARDEN_CONFIG.logicalWidth;
  canvas.height = GARDEN_CONFIG.logicalHeight;
  return canvas;
}

export function gridToWorld(gridX: number, gridY: number): WorldPoint {
  return {
    x: (gridX + 0.5) * GARDEN_CONFIG.tileSize,
    y: (gridY + 0.5) * GARDEN_CONFIG.tileSize,
  };
}

export function worldToScreen(point: WorldPoint, camera: WorldPoint): WorldPoint {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  return {
    x: GARDEN_CONFIG.logicalWidth / 2 + point.x - camera.x,
    y: GARDEN_CONFIG.maryScreenY + (point.y - camera.y) * yScale,
  };
}

export function screenToGrid(screenX: number, screenY: number, camera: WorldPoint) {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  const worldX = camera.x + screenX - GARDEN_CONFIG.logicalWidth / 2;
  const worldY = camera.y + (screenY - GARDEN_CONFIG.maryScreenY) / yScale;
  return {
    gridX: Math.floor(worldX / GARDEN_CONFIG.tileSize),
    gridY: Math.floor(worldY / GARDEN_CONFIG.tileSize),
  };
}

function drawHorizon(ctx: CanvasRenderingContext2D, warmth: number) {
  const { logicalWidth: width, horizonHeight: horizon } = GARDEN_CONFIG;
  ctx.fillStyle = "#d7d1c5";
  ctx.fillRect(0, 0, width, 28);
  ctx.fillStyle = "#c8c2b8";
  ctx.fillRect(0, 28, width, 28);
  ctx.fillStyle = "#b6b1a8";
  ctx.fillRect(0, 56, width, horizon - 56);

  if (warmth > 0) {
    ctx.fillStyle = `rgba(244, 166, 126, ${warmth * 0.52})`;
    ctx.fillRect(0, 0, width, horizon);
    ctx.fillStyle = `rgba(255, 214, 126, ${warmth * 0.38})`;
    ctx.fillRect(0, 28, width, 30);
  }

  ctx.fillStyle = warmth > 0.2 ? "#f7d16c" : "#d8d2bd";
  ctx.fillRect(width / 2 - 14, 42, 28, 12);
  ctx.fillRect(width / 2 - 18, 48, 36, 10);

  ctx.fillStyle = "#7f7d78";
  ctx.beginPath();
  ctx.moveTo(0, 72);
  ctx.lineTo(35, 53);
  ctx.lineTo(67, 70);
  ctx.lineTo(103, 48);
  ctx.lineTo(142, 72);
  ctx.lineTo(183, 50);
  ctx.lineTo(225, 73);
  ctx.lineTo(267, 54);
  ctx.lineTo(width, 70);
  ctx.lineTo(width, horizon);
  ctx.lineTo(0, horizon);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#696b68";
  for (let x = 4; x < width; x += 17) {
    const height = 5 + (x % 13);
    ctx.fillRect(x, horizon - height, 2, height);
  }
}

function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  colored: boolean,
) {
  const { logicalWidth: width, logicalHeight: height, horizonHeight, tileSize } =
    GARDEN_CONFIG;
  const yScale = GARDEN_CONFIG.tileScreenHeight / tileSize;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colored ? "#a7ad69" : "#b2afa6";
  ctx.fillRect(0, horizonHeight, width, height - horizonHeight);

  const minGridX = Math.floor((camera.x - width / 2) / tileSize) - 1;
  const maxGridX = Math.ceil((camera.x + width / 2) / tileSize) + 1;
  const minWorldY = camera.y + (horizonHeight - GARDEN_CONFIG.maryScreenY) / yScale;
  const maxWorldY = camera.y + (height - GARDEN_CONFIG.maryScreenY) / yScale;
  const minGridY = Math.floor(minWorldY / tileSize) - 1;
  const maxGridY = Math.ceil(maxWorldY / tileSize) + 1;

  for (let gridY = minGridY; gridY <= maxGridY; gridY += 1) {
    for (let gridX = minGridX; gridX <= maxGridX; gridX += 1) {
      const tile = getTerrainTile(gridX, gridY);
      const topLeft = worldToScreen(
        { x: gridX * tileSize, y: gridY * tileSize },
        camera,
      );
      const x = Math.floor(topLeft.x);
      const y = Math.floor(topLeft.y);
      ctx.fillStyle = colored ? tile.color : tile.gray;
      ctx.fillRect(x, y, tileSize + 1, GARDEN_CONFIG.tileScreenHeight + 1);

      ctx.fillStyle = colored ? "rgba(71,82,45,.23)" : "rgba(72,72,70,.16)";
      ctx.fillRect(x, y, tileSize, 1);
      ctx.fillRect(x, y, 1, GARDEN_CONFIG.tileScreenHeight);

      if (tile.detail <= 2) {
        ctx.fillStyle = colored ? "#68733f" : "#88877f";
        ctx.fillRect(x + 4, y + 7, 1, 3);
        ctx.fillRect(x + 6, y + 6, 1, 4);
        ctx.fillRect(x + 8, y + 8, 1, 2);
      } else if (tile.detail === 5) {
        ctx.fillStyle = colored ? "#8f8054" : "#929088";
        ctx.fillRect(x + 3, y + 5, 5, 1);
        ctx.fillRect(x + 7, y + 6, 4, 1);
      }

      if (colored && tile.accent === 1) {
        ctx.fillStyle = terrainNoise(gridX, gridY, 19) > 0.5 ? "#f2d46f" : "#e98673";
        ctx.fillRect(x + 11, y + 4, 2, 2);
        ctx.fillStyle = "#6e7845";
        ctx.fillRect(x + 12, y + 6, 1, 2);
      }
    }
  }
}

function drawRose(
  ctx: CanvasRenderingContext2D,
  rose: RoseRecord,
  camera: WorldPoint,
  now: number,
) {
  const point = worldToScreen(gridToWorld(rose.grid_x, rose.grid_y), camera);
  if (point.x < -20 || point.x > 340 || point.y < 70 || point.y > 500) return;

  const visual = getRoseVisual(rose, now);
  const x = Math.round(point.x);
  const y = Math.round(point.y);

  if (visual.state === "dead") {
    ctx.fillStyle = "#6f573d";
    ctx.fillRect(x - 1, y - 6, 2, 7);
    ctx.fillRect(x - 5, y - 5, 5, 2);
    ctx.fillRect(x, y - 3, 5, 2);
    return;
  }

  const wilting = visual.state === "wilting";
  ctx.fillStyle = wilting ? "#677052" : "#45643f";
  ctx.fillRect(x - 1, y - 9, 2, 10);
  ctx.fillRect(x - 5, y - 5, 5, 2);
  ctx.fillRect(x + 1, y - 4, 4, 2);

  if (visual.state === "sprout") {
    ctx.fillStyle = "#71854b";
    ctx.fillRect(x - 3, y - 10, 6, 4);
    return;
  }

  ctx.fillStyle = wilting ? "#a76d62" : "#d94a4e";
  ctx.fillRect(x - 4, y - 14, 8, 7);
  ctx.fillRect(x - 6, y - 12, 12, 3);
  ctx.fillStyle = wilting ? "#845047" : "#a51f31";
  ctx.fillRect(x - 2, y - 13, 4, 4);
  ctx.fillStyle = "#f2a36f";
  ctx.fillRect(x - 1, y - 12, 2, 2);
}

function drawSelection(ctx: CanvasRenderingContext2D, selected: SelectedCell, camera: WorldPoint) {
  if (!selected) return;
  const point = worldToScreen(gridToWorld(selected.gridX, selected.gridY), camera);
  const x = Math.round(point.x - 8);
  const y = Math.round(point.y - 6);
  ctx.fillStyle = "#fff5d8";
  ctx.fillRect(x, y, 4, 2);
  ctx.fillRect(x, y, 2, 4);
  ctx.fillRect(x + 12, y, 4, 2);
  ctx.fillRect(x + 14, y, 2, 4);
  ctx.fillRect(x, y + 10, 4, 2);
  ctx.fillRect(x, y + 8, 2, 4);
  ctx.fillRect(x + 12, y + 10, 4, 2);
  ctx.fillRect(x + 14, y + 8, 2, 4);
}

function drawMary(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  moving: boolean,
  now: number,
) {
  const screen = worldToScreen(point, camera);
  const step = moving && Math.floor(now / 170) % 2 === 0 ? 1 : 0;
  const x = Math.round(screen.x);
  const y = Math.round(screen.y) - step;

  ctx.fillStyle = "#5e2f25";
  ctx.fillRect(x - 6, y - 22, 12, 9);
  ctx.fillRect(x - 8, y - 19, 16, 9);
  ctx.fillStyle = "#e5c4a1";
  ctx.fillRect(x - 5, y - 12, 10, 5);
  ctx.fillStyle = "#f0e0c4";
  ctx.fillRect(x - 7, y - 8, 14, 8);
  ctx.fillStyle = "#65704a";
  ctx.fillRect(x - 6, y - 7, 4, 13);
  ctx.fillRect(x + 2, y - 7, 4, 13);
  ctx.fillRect(x - 2, y - 3, 4, 9);
  ctx.fillStyle = "#49382e";
  ctx.fillRect(x - 7, y + 5, 6, 4 + step);
  ctx.fillRect(x + 1, y + 5, 6, 5 - step);
  ctx.fillStyle = "#312a26";
  ctx.fillRect(x - 7, y + 8 + step, 6, 2);
  ctx.fillRect(x + 1, y + 9 - step, 6, 2);
}

function drawDuck(
  ctx: CanvasRenderingContext2D,
  point: WorldPoint,
  camera: WorldPoint,
  moving: boolean,
  now: number,
) {
  const screen = worldToScreen(point, camera);
  const waddle = moving && Math.floor(now / 150) % 2 === 0 ? 1 : -1;
  const x = Math.round(screen.x) + waddle;
  const y = Math.round(screen.y);
  ctx.fillStyle = "#f5f0df";
  ctx.fillRect(x - 5, y - 8, 10, 8);
  ctx.fillRect(x - 3, y - 12, 7, 6);
  ctx.fillStyle = "#2f3130";
  ctx.fillRect(x + 2, y - 10, 1, 1);
  ctx.fillStyle = "#d6a13b";
  ctx.fillRect(x + 4, y - 9, 4, 2);
  ctx.fillRect(x - 4, y, 3, 1);
  ctx.fillRect(x + 2, y, 3, 1);
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: GardenEffect[], camera: WorldPoint, now: number) {
  for (const effect of effects) {
    const age = now - effect.startedAt;
    if (age < 0 || age > 900) continue;
    const progress = age / 900;
    const point = worldToScreen(gridToWorld(effect.gridX, effect.gridY), camera);
    if (effect.kind === "water") {
      ctx.fillStyle = "#75b7cf";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 4 - 6;
        ctx.fillRect(
          Math.round(point.x + offset),
          Math.round(point.y - 20 + progress * 16 + (index % 2) * 3),
          2,
          3,
        );
      }
    } else {
      ctx.fillStyle = "#876444";
      ctx.fillRect(Math.round(point.x - 7 - progress * 4), Math.round(point.y - 3), 3, 2);
      ctx.fillRect(Math.round(point.x + 4 + progress * 4), Math.round(point.y - 5), 3, 2);
    }
  }
}

export function renderGarden(ctx: CanvasRenderingContext2D, state: RenderGardenState) {
  grayLayer = ensureLayer(grayLayer);
  colorLayer = ensureLayer(colorLayer);
  maskLayer = ensureLayer(maskLayer);
  const grayCtx = grayLayer.getContext("2d");
  const colorCtx = colorLayer.getContext("2d");
  const maskCtx = maskLayer.getContext("2d");
  if (!grayCtx || !colorCtx || !maskCtx) return;

  const visibleRoses = state.roses.filter(
    (rose) => getRoseVisual(rose, state.now).state !== "expired",
  );
  const warmRoses = visibleRoses.filter((rose) => {
    const roseState = getRoseVisual(rose, state.now).state;
    return roseState === "healthy" || roseState === "sprout";
  }).length;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, GARDEN_CONFIG.logicalWidth, GARDEN_CONFIG.logicalHeight);
  drawHorizon(ctx, Math.min(0.65, warmRoses * 0.055));
  drawTerrainLayer(grayCtx, state.camera, false);
  drawTerrainLayer(colorCtx, state.camera, true);
  maskCtx.clearRect(0, 0, GARDEN_CONFIG.logicalWidth, GARDEN_CONFIG.logicalHeight);

  for (const rose of visibleRoses) {
    const visual = getRoseVisual(rose, state.now);
    if (visual.colorRadius <= 0) continue;
    const point = worldToScreen(gridToWorld(rose.grid_x, rose.grid_y), state.camera);
    const gradient = maskCtx.createRadialGradient(
      point.x,
      point.y,
      3,
      point.x,
      point.y,
      visual.colorRadius,
    );
    gradient.addColorStop(0, `rgba(255,255,255,${visual.colorStrength})`);
    gradient.addColorStop(0.72, `rgba(255,255,255,${visual.colorStrength * 0.62})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = gradient;
    maskCtx.fillRect(
      point.x - visual.colorRadius,
      point.y - visual.colorRadius,
      visual.colorRadius * 2,
      visual.colorRadius * 2,
    );
  }

  colorCtx.globalCompositeOperation = "destination-in";
  colorCtx.drawImage(maskLayer, 0, 0);
  colorCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(grayLayer, 0, 0);
  ctx.drawImage(colorLayer, 0, 0);

  drawSelection(ctx, state.selected, state.camera);
  visibleRoses.forEach((rose) => drawRose(ctx, rose, state.camera, state.now));
  drawDuck(ctx, state.duck, state.camera, state.moving, state.now);
  drawMary(ctx, state.mary, state.camera, state.moving, state.now);
  drawEffects(ctx, state.effects, state.camera, state.now);
}

