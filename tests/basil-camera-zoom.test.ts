import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GARDEN_CONFIG,
  getAdaptiveChunkLoadRadius,
} from "../app/community-garden/lib/gardenConfig.ts";

test("community zoom keeps a bounded detailed regional window", () => {
  assert.equal(
    getAdaptiveChunkLoadRadius(1, { width: 320, height: 480 }),
    2,
  );
  assert.equal(
    getAdaptiveChunkLoadRadius(0.5, { width: 320, height: 480 }),
    3,
  );
  assert.equal(
    getAdaptiveChunkLoadRadius(0.5, { width: 900, height: 480 }),
    3,
  );
});

test("the camera exposes touch, wheel, and fit-garden zoom behavior", () => {
  assert.equal(GARDEN_CONFIG.minCommunityCameraZoom, 0.5);
  assert.equal(GARDEN_CONFIG.minPersonalCameraZoom, 0.35);
  const canvas = readFileSync(
    new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
    "utf8",
  );
  assert.match(canvas, /pinchGestureRef/);
  assert.match(canvas, /onWheel=\{onWheel\}/);
  assert.match(canvas, /getPersonalGardenOverviewCamera/);
  assert.match(canvas, /getAdaptiveChunkLoadRadius/);
});
