import { GARDEN_CONFIG } from "./gardenConfig.ts";

export type CameraPoint = { x: number; y: number };

export const CAMERA_FOLLOW_DEAD_ZONE = {
  x: 16,
  y: 12,
} as const;

export function getFrameStableCameraEase(
  deltaSeconds: number,
  responsePerSecond = 7,
) {
  const safeDelta = Math.max(0, deltaSeconds);
  const safeResponse = Math.max(0, responsePerSecond);
  return 1 - Math.exp(-safeResponse * safeDelta);
}

function getDeadZoneAxisTarget(
  camera: number,
  focus: number,
  pixelsPerWorldUnit: number,
  deadZonePixels: number,
) {
  const safeScale = Math.max(Number.EPSILON, Math.abs(pixelsPerWorldUnit));
  const safeDeadZone = Math.max(0, deadZonePixels);
  const screenDelta = (focus - camera) * safeScale;
  if (Math.abs(screenDelta) <= safeDeadZone) return camera;
  return focus - (Math.sign(screenDelta) * safeDeadZone) / safeScale;
}

/**
 * Keep the camera still while Mary remains inside a small on-screen follow
 * zone. Once she crosses its edge, return the nearest camera position that
 * places her back on that edge. Builder and explicit camera anchors bypass
 * this helper so their existing exact focus behavior remains unchanged.
 */
export function getCameraFollowTarget(
  camera: CameraPoint,
  focus: CameraPoint,
  zoom: number,
  deadZone = CAMERA_FOLLOW_DEAD_ZONE,
): CameraPoint {
  const safeZoom = Math.max(GARDEN_CONFIG.minCameraZoom, Math.abs(zoom));
  const verticalScale =
    GARDEN_CONFIG.tileScreenHeight / GARDEN_CONFIG.tileSize;
  return {
    x: getDeadZoneAxisTarget(
      camera.x,
      focus.x,
      safeZoom,
      deadZone.x,
    ),
    y: getDeadZoneAxisTarget(
      camera.y,
      focus.y,
      safeZoom * verticalScale,
      deadZone.y,
    ),
  };
}
