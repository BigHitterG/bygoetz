import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getWorldScreenOrigin,
  gridToWorld,
  screenToGrid,
  worldToScreen,
} from "../app/community-garden/lib/cameraProjection.ts";
import { getFrameStableCameraEase } from "../app/community-garden/lib/cameraMotion.ts";
import { GARDEN_CONFIG } from "../app/community-garden/lib/gardenConfig.ts";

const viewport = { width: 853, height: 480 };
const cells = [
  { gridX: -5, gridY: -3 },
  { gridX: 0, gridY: 0 },
  { gridX: 7, gridY: 4 },
];

test("the complete tile lattice translates as one rigid surface", () => {
  for (const zoom of GARDEN_CONFIG.cameraZoomStops) {
    let previous = cells.map(({ gridX, gridY }) =>
      worldToScreen(gridToWorld(gridX, gridY), { x: 3.1, y: -8.4 }, viewport, zoom),
    );

    for (let frame = 1; frame <= 80; frame += 1) {
      const camera = {
        x: 3.1 + frame * 0.37,
        y: -8.4 + frame * 0.29,
      };
      const current = cells.map(({ gridX, gridY }) =>
        worldToScreen(gridToWorld(gridX, gridY), camera, viewport, zoom),
      );
      const expectedDx = current[0].x - previous[0].x;
      const expectedDy = current[0].y - previous[0].y;

      for (let index = 1; index < current.length; index += 1) {
        assert.equal(current[index].x - previous[index].x, expectedDx);
        assert.equal(current[index].y - previous[index].y, expectedDy);
      }
      previous = current;
    }
  }
});

test("tile spacing does not breathe as the camera crosses pixel boundaries", () => {
  for (const zoom of GARDEN_CONFIG.cameraZoomStops) {
    const expectedWidth = GARDEN_CONFIG.tileSize * zoom;
    const expectedHeight = GARDEN_CONFIG.tileScreenHeight * zoom;
    for (let frame = 0; frame < 80; frame += 1) {
      const camera = { x: frame * 0.31, y: frame * 0.27 };
      const origin = worldToScreen(gridToWorld(0, 0), camera, viewport, zoom);
      const right = worldToScreen(gridToWorld(1, 0), camera, viewport, zoom);
      const below = worldToScreen(gridToWorld(0, 1), camera, viewport, zoom);
      assert.ok(Math.abs(right.x - origin.x - expectedWidth) < 1e-9);
      assert.ok(Math.abs(below.y - origin.y - expectedHeight) < 1e-9);
    }
  }
});

test("hit testing uses the same snapped projection as rendering", () => {
  for (const zoom of GARDEN_CONFIG.cameraZoomStops) {
    const camera = { x: 11.37, y: -5.82 };
    for (const cell of cells) {
      const screen = worldToScreen(
        gridToWorld(cell.gridX, cell.gridY),
        camera,
        viewport,
        zoom,
      );
      assert.deepEqual(
        screenToGrid(screen.x, screen.y, camera, viewport, zoom),
        cell,
      );
    }
    const origin = getWorldScreenOrigin(camera, viewport, zoom);
    assert.equal(Number.isInteger(origin.x), true);
    assert.equal(Number.isInteger(origin.y), true);
  }
});

test("camera easing composes consistently across different frame rates", () => {
  const oneFrame = getFrameStableCameraEase(1 / 30);
  const halfFrame = getFrameStableCameraEase(1 / 60);
  const twoHalfFrames = halfFrame + (1 - halfFrame) * halfFrame;
  assert.ok(Math.abs(oneFrame - twoHalfFrames) < 1e-12);
});
