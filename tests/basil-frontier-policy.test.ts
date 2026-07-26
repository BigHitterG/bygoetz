import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASIL_FRONTIER_POLICY,
  getEffectiveGardenCapacity,
  getFoundingSquarePerimeterRegions,
  getFrontierCapacityState,
  getFrontierGlobalQuorum,
  qualifiesFrontierRegion,
} from "../lib/communityGarden/frontierPolicy.ts";

test("the founding garden uses pressure-limited rather than raw tile capacity", () => {
  assert.equal(getEffectiveGardenCapacity(100), 18_000);
  const state = getFrontierCapacityState(10_800, 100);
  assert.equal(state.occupancy, 0.6);
  assert.equal(state.shouldPrepare, true);
  assert.equal(state.shouldRecommendOpening, true);
  assert.equal(state.regionsNeeded, 10);
});

test("global quorum grows with the real square perimeter", () => {
  assert.equal(getFoundingSquarePerimeterRegions(0), 40);
  assert.equal(getFoundingSquarePerimeterRegions(1), 48);
  assert.equal(getFoundingSquarePerimeterRegions(2), 56);
  assert.equal(getFrontierGlobalQuorum(40), 14);
  assert.equal(getFrontierGlobalQuorum(84), 28);
  assert.equal(getFrontierGlobalQuorum(124), 42);
});

test("volume from one gardener cannot satisfy a regional quorum", () => {
  assert.equal(
    qualifiesFrontierRegion({
      supportedPlants: 180,
      supportedSubcells: 16,
      distinctGardeners: 1,
      activeDays: 7,
      consecutiveQualifyingDays: 7,
      sideAdjacentToEstablished: true,
    }),
    false,
  );
});

test("distributed sustained support qualifies a connected region", () => {
  assert.equal(
    qualifiesFrontierRegion({
      supportedPlants: BASIL_FRONTIER_POLICY.supportedPlantsPerRegion,
      supportedSubcells: BASIL_FRONTIER_POLICY.supportedSubcellsPerRegion,
      distinctGardeners: BASIL_FRONTIER_POLICY.localGardenersPerRegion,
      activeDays: BASIL_FRONTIER_POLICY.activeDaysRequired,
      consecutiveQualifyingDays:
        BASIL_FRONTIER_POLICY.consecutiveQualifyingDays,
      sideAdjacentToEstablished: true,
    }),
    true,
  );
});

test("automatic frontier opening remains off during shadow validation", () => {
  assert.equal(BASIL_FRONTIER_POLICY.automaticOpeningEnabled, false);
});
