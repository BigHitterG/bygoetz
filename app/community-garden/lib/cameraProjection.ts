import { GARDEN_CONFIG } from "./gardenConfig.ts";

export type WorldPoint = { x: number; y: number };
export type GardenViewport = { width: number; height: number };

export function gridToWorld(gridX: number, gridY: number): WorldPoint {
  return {
    x: (gridX + 0.5) * GARDEN_CONFIG.tileSize,
    y: (gridY + 0.5) * GARDEN_CONFIG.tileSize,
  };
}

function getMaryScreenY(viewport: GardenViewport) {
  return viewport.height * GARDEN_CONFIG.maryScreenYRatio;
}

/**
 * Snap the camera translation once for the whole frame, rather than snapping
 * every tile and sprite independently. This keeps the complete world lattice
 * rigid while the camera moves, including at fractional zoom levels.
 */
export function getWorldScreenOrigin(
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number = GARDEN_CONFIG.defaultCameraZoom,
): WorldPoint {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  return {
    x: Math.round(viewport.width / 2 - camera.x * zoom),
    y: Math.round(getMaryScreenY(viewport) - camera.y * yScale * zoom),
  };
}

export function worldToScreen(
  point: WorldPoint,
  camera: WorldPoint,
  viewport: GardenViewport,
  zoom: number = GARDEN_CONFIG.defaultCameraZoom,
): WorldPoint {
  const yScale = GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  const origin = getWorldScreenOrigin(camera, viewport, zoom);
  return {
    x: origin.x + point.x * zoom,
    y: origin.y + point.y * yScale * zoom,
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
  const origin = getWorldScreenOrigin(camera, viewport, zoom);
  const worldX = (screenX - origin.x) / zoom;
  const worldY = (screenY - origin.y) / (yScale * zoom);
  return {
    gridX: Math.floor(worldX / GARDEN_CONFIG.tileSize),
    gridY: Math.floor(worldY / GARDEN_CONFIG.tileSize),
  };
}
