import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  OCCUPIED_GARDEN_COORDINATE_REASON,
  parseGardenActionFailureReason,
} from "../app/community-garden/lib/gardenActionFailure.ts";
import { choosePlantingSuggestion } from "../app/community-garden/lib/plantingSuggestion.ts";

const actionRouteSource = await readFile(
  new URL("../app/api/community-garden/action/route.ts", import.meta.url),
  "utf8",
);
const canvasSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("occupied database coordinates receive a stable public failure reason", () => {
  assert.equal(
    parseGardenActionFailureReason(OCCUPIED_GARDEN_COORDINATE_REASON),
    OCCUPIED_GARDEN_COORDINATE_REASON,
  );
  assert.equal(parseGardenActionFailureReason("23505"), null);
  assert.match(actionRouteSource, /errorCode === "23505"/);
  assert.match(actionRouteSource, /reason: OCCUPIED_GARDEN_COORDINATE_REASON/);
});

test("simultaneous visitors can be distributed across nearby candidates", () => {
  const candidates = Array.from({ length: 16 }, (_, index) => index);
  const choices = [0.05, 0.3, 0.55, 0.8].map((randomValue) =>
    choosePlantingSuggestion(candidates, randomValue),
  );
  assert.equal(new Set(choices).size, 4);
  assert.equal(choosePlantingSuggestion([], 0.5), null);
});

test("an occupied tutorial target is blocked and replaced before retrying", () => {
  assert.match(
    canvasSource,
    /runtime\.blockedTutorialPlantingCells\.add\([\s\S]*plantKey\(selected\.gridX, selected\.gridY\)/,
  );
  assert.match(
    canvasSource,
    /retryTutorialPlanting[\s\S]*runtime\.selected = null;[\s\S]*runtime\.suggestedPlantingCell = findSuggestedPlantingCell\(runtime\)/,
  );
  assert.match(canvasSource, /runtime\.loadedRegionWindowKey = "";/);
  assert.match(canvasSource, /void loadPlantsRef\.current\(\);/);
  assert.match(canvasSource, /Follow the new glowing patch/);
});
