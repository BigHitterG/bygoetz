import { GARDEN_CONFIG, isWithinGarden } from "../lib/gardenConfig";
import type { MyGardenUpgradeType } from "../lib/myGardenCatalog";
import { getPlantVisual, type PlantRecord } from "../lib/roseLifecycle";
import { getTerrainTile, terrainNoise } from "./terrainGenerator";

export type WorldPoint = { x: number; y: number };
export type GardenViewport = { width: number; height: number };
export type GardenWorldMode = "community" | "personal";
export type SelectedCell = { gridX: number; gridY: number; plantId?: string } | null;
export type GardenEffect =
  | {
      kind: "plant" | "water" | "uproot" | "path";
      gridX: number;
      gridY: number;
      startedAt: number;
    }
  | {
      kind: "care";
      x: number;
      y: number;
      value: number;
      steadyProgress?: number;
      steadyActionsRequired?: number;
      startedAt: number;
    };

export type RenderGardenState = {
  viewport: GardenViewport;
  camera: WorldPoint;
  zoom: number;
  mary: WorldPoint;
  duck: WorldPoint;
  plants: PlantRecord[];
  selected: SelectedCell;
  effects: GardenEffect[];
  moving: boolean;
  now: number;
  mode: GardenWorldMode;
  personalGarden?: {
    width: number;
    height: number;
    maxWidth: number;
    maxHeight: number;
    upgrades: MyGardenUpgradeType[];
    paths: Array<{ gridX: number; gridY: number }>;
    nextExpansion: null | {
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
      } else if (layer === "green") {
        ctx.fillStyle = "#9ca67a";
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
    }
  }
}

function drawPersonalTerrain(
  ctx: CanvasRenderingContext2D,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number,
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const cellWidth = tileSize * zoom;
  const cellHeight = tileScreenHeight * zoom;
  const visible = getVisibleGridBounds(camera, viewport, zoom);

  ctx.fillStyle = "#eee9df";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

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
      const inProperty =
        gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;
      const inExpansion =
        gridX >= 0 && gridX < maxWidth && gridY >= 0 && gridY < maxHeight;

      ctx.fillStyle = inProperty
        ? (gridX + gridY) % 2 === 0
          ? "#91ad78"
          : "#98b47f"
        : inExpansion
          ? (gridX + gridY) % 3 === 0
            ? "#f4f1e9"
            : "#eeebe3"
          : (gridX + gridY) % 3 === 0
            ? "#e3ded2"
            : "#e9e4da";
      ctx.fillRect(x, y, cellWidth + 1, cellHeight + 1);

      if (inProperty && terrainNoise(gridX, gridY, 73) > 0.66) {
        drawGroundMark(ctx, x, y, zoom, "#6f895d");
      }
    }
  }
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
  width: number,
  sage: boolean,
) {
  const point = worldToScreen(
    {
      x: (Math.floor(width / 2) + 0.5) * GARDEN_CONFIG.tileSize,
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
  ctx.fillStyle = sage ? "#7e9d73" : "#c78358";
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
  width: number,
  height: number,
  nextExpansion: NonNullable<RenderGardenState["personalGarden"]>["nextExpansion"],
) {
  if (!nextExpansion) return;
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const topLeft = worldToScreen({ x: 0, y: 0 }, camera, viewport, zoom);
  const currentWidth = width * tileSize * zoom;
  const currentHeight = height * tileScreenHeight * zoom;
  const nextWidth = nextExpansion.width * tileSize * zoom;
  const nextHeight = nextExpansion.height * tileScreenHeight * zoom;
  const parcelX = nextWidth > currentWidth ? topLeft.x + currentWidth : topLeft.x;
  const parcelY = nextHeight > currentHeight ? topLeft.y + currentHeight : topLeft.y;
  const parcelWidth =
    nextWidth > currentWidth ? nextWidth - currentWidth : currentWidth;
  const parcelHeight =
    nextHeight > currentHeight ? nextHeight - currentHeight : currentHeight;

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
  width: number,
  height: number,
  stonePosts: boolean,
) {
  const { tileSize, tileScreenHeight } = GARDEN_CONFIG;
  const topLeft = worldToScreen({ x: 0, y: 0 }, camera, viewport, zoom);
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
  for (let gridX = 0; gridX <= width; gridX += 1) {
    const x = topLeft.x + gridX * tileSize * zoom;
    ctx.fillRect(x - postWidth / 2, topLeft.y - postHeight / 2, postWidth, postHeight);
    ctx.fillRect(
      x - postWidth / 2,
      topLeft.y + fenceHeight - postHeight / 2,
      postWidth,
      postHeight,
    );
  }
  for (let gridY = 1; gridY < height; gridY += 1) {
    const y = topLeft.y + gridY * tileScreenHeight * zoom;
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
  width: number,
  height: number,
  upgrades: MyGardenUpgradeType[],
  nextExpansion: NonNullable<RenderGardenState["personalGarden"]>["nextExpansion"],
) {
  const has = (upgrade: MyGardenUpgradeType) => upgrades.includes(upgrade);
  drawLockedParcel(
    ctx,
    camera,
    viewport,
    zoom,
    width,
    height,
    nextExpansion,
  );
  drawPersonalFence(ctx, camera, viewport, zoom, width, height, has("stone_path"));
  drawPixelShed(ctx, camera, viewport, zoom, width, has("sage_shed"));

  if (has("birdhouse")) {
    const point = worldToScreen(gridToWorld(width + 1, 0), camera, viewport, zoom);
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    ctx.fillStyle = "#704b39";
    ctx.fillRect(-2, -24, 4, 25);
    ctx.fillStyle = "#e0b76d";
    ctx.fillRect(-10, -35, 20, 15);
    ctx.fillStyle = "#954a45";
    ctx.fillRect(-13, -40, 26, 7);
    ctx.fillStyle = "#4a372e";
    ctx.fillRect(-3, -31, 6, 6);
    ctx.restore();
  }

  if (has("bench")) {
    const point = worldToScreen(
      gridToWorld(width + 1, Math.min(3, height - 1)),
      camera,
      viewport,
      zoom,
    );
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.scale(zoom, zoom);
    ctx.fillStyle = "#7a4936";
    ctx.fillRect(-15, -15, 30, 5);
    ctx.fillRect(-15, -7, 30, 5);
    ctx.fillRect(-12, -2, 4, 10);
    ctx.fillRect(8, -2, 4, 10);
    ctx.restore();
  }
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
) {
  if (state === "seed") {
    ctx.fillStyle = plant.plant_type === "sunflower" ? "#4f4434" : "#705443";
    ctx.fillRect(-2, -2, 4, 2);
    ctx.fillStyle = plant.plant_type === "lavender" ? "#8f765b" : "#8f6b51";
    ctx.fillRect(-1, -4, 2, 2);
    return;
  }

  ctx.fillStyle = plant.plant_type === "lavender" ? "#69755e" : "#68764f";
  ctx.fillRect(-1, -5, 2, 6);
  ctx.fillRect(-4, -4, 3, 2);
  ctx.fillRect(1, -2, 2, 2);
}

function drawRosePlant(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  state: "young" | "mature" | "blooming" | "wilting",
) {
  const wilting = state === "wilting";
  const plantVariant = Math.abs(plant.grid_x * 17 + plant.grid_y * 13) % 2;
  const stemLean = plantVariant === 0 ? -1 : 1;
  if (state === "young") {
    ctx.fillStyle = "#45643f";
    ctx.fillRect(-1, -4, 2, 5);
    ctx.fillRect(-1 + stemLean, -9, 2, 5);
    ctx.fillRect(-4 + stemLean, -7, 3, 2);
    ctx.fillRect(1, -3, 3, 2);
    ctx.fillStyle = "#718054";
    ctx.fillRect(-2 + stemLean, -10, 4, 3);
    return;
  }

  const leftLeafY = plantVariant === 0 ? -7 : -6;
  const rightLeafY = plantVariant === 0 ? -2 : -3;
  ctx.fillStyle = wilting ? "#677052" : "#45643f";
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
) {
  const wilting = state === "wilting";
  ctx.save();
  if (wilting) ctx.rotate(0.16);
  ctx.fillStyle = wilting ? "#6f7151" : "#42633e";
  ctx.fillRect(-1, -12, 2, 13);
  ctx.fillRect(-6, -7, 5, 3);
  ctx.fillRect(1, -4, 6, 3);

  if (state === "young") {
    ctx.fillStyle = "#758454";
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
) {
  const wilting = state === "wilting";
  ctx.fillStyle = wilting ? "#73735d" : "#536a50";
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

function drawPlant(
  ctx: CanvasRenderingContext2D,
  plant: PlantRecord,
  camera: WorldPoint,
  viewport: GardenViewport,
  now: number,
  zoom: number,
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
    drawSeedOrSprout(ctx, plant, visual.state);
    ctx.restore();
    return;
  }

  if (plant.plant_type === "sunflower") {
    drawSunflowerPlant(ctx, visual.state);
  } else if (plant.plant_type === "lavender") {
    drawLavenderPlant(ctx, visual.state);
  } else {
    drawRosePlant(ctx, plant, visual.state);
  }
  ctx.restore();
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
    const duration = effect.kind === "care" ? 1100 : 900;
    if (age < 0 || age > duration) continue;
    const progress = age / duration;
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
      ctx.font =
        effect.value > 0
          ? '900 14px "Courier New", monospace'
          : '800 7px "Courier New", monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 244, 223, 0.92)";
      ctx.fillStyle = effect.value > 0 ? "#c94f4c" : "#63764e";
      const label =
        effect.value > 0
          ? `+${effect.value}`
          : `TENDING ${effect.steadyProgress ?? 0}/${effect.steadyActionsRequired ?? 4}`;
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
    } else if (effect.kind === "water") {
      ctx.fillStyle = "#75b7cf";
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 4 - 6;
        ctx.fillRect(offset, -20 + progress * 16 + (index % 2) * 3, 2, 3);
      }
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
      state.personalGarden.width,
      state.personalGarden.height,
      state.personalGarden.maxWidth,
      state.personalGarden.maxHeight,
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
      state.personalGarden.width,
      state.personalGarden.height,
      state.personalGarden.upgrades,
      state.personalGarden.nextExpansion,
    );
    drawPersonalSoilPatches(
      ctx,
      visiblePlants,
      state.camera,
      state.viewport,
      state.zoom,
    );
    drawDampSoil(ctx, visiblePlants, state.camera, state.viewport, state.now, state.zoom);
    visiblePlants.forEach((plant) =>
      drawPlant(ctx, plant, state.camera, state.viewport, state.now, state.zoom),
    );
    drawDuck(ctx, state.duck, state.camera, state.viewport, state.moving, state.now, state.zoom);
    drawMary(ctx, state.mary, state.camera, state.viewport, state.moving, state.now, state.zoom);
    drawEffects(ctx, state.effects, state.camera, state.viewport, state.now, state.zoom);
    drawSelection(ctx, state.selected, state.camera, state.viewport, state.zoom);
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
    visiblePlants.map((plant) => terrainCellKey(plant.grid_x, plant.grid_y)),
  );
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawTerrainLayer(baseCtx, state.camera, state.viewport, "base", state.zoom, occupiedCells);
  drawTerrainLayer(soilCtx, state.camera, state.viewport, "soil", state.zoom, occupiedCells);
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
  drawTerrainLayer(greenCtx, state.camera, state.viewport, "green", state.zoom, occupiedCells);
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
  drawDampSoil(ctx, visiblePlants, state.camera, state.viewport, state.now, state.zoom);
  visiblePlants.forEach((plant) =>
    drawPlant(ctx, plant, state.camera, state.viewport, state.now, state.zoom),
  );
  drawDuck(ctx, state.duck, state.camera, state.viewport, state.moving, state.now, state.zoom);
  drawMary(ctx, state.mary, state.camera, state.viewport, state.moving, state.now, state.zoom);
  drawEffects(ctx, state.effects, state.camera, state.viewport, state.now, state.zoom);
  drawSelection(ctx, state.selected, state.camera, state.viewport, state.zoom);
}

