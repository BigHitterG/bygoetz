import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASIL_FRONTIER_POLICY,
  getEffectiveGardenCapacity,
  getFoundingSquarePerimeterRegions,
  getFrontierCommunityStage,
  getFrontierCapacityState,
  getFrontierGlobalQuorum,
  getGuestAssistCredit,
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

test("Founding Season raises account quorum in measured community stages", () => {
  assert.deepEqual(getFrontierCommunityStage(3), {
    id: "founding",
    requiredAccounts: 1,
    recommendationCooldownDays: 30,
  });
  assert.equal(getFrontierCommunityStage(4).requiredAccounts, 2);
  assert.equal(getFrontierCommunityStage(11).recommendationCooldownDays, 14);
  assert.equal(getFrontierCommunityStage(12).requiredAccounts, 3);
  assert.equal(getFrontierCommunityStage(29).recommendationCooldownDays, 7);
  assert.equal(getFrontierCommunityStage(30).requiredAccounts, 6);
  assert.equal(getFrontierCommunityStage(30).recommendationCooldownDays, 0);
  assert.equal(getFrontierGlobalQuorum(40, 1), 1);
  assert.equal(getFrontierGlobalQuorum(40, 4), 2);
  assert.equal(getFrontierGlobalQuorum(40, 12), 3);
  assert.equal(getFrontierGlobalQuorum(40, 30), 14);
});

test("Guest Assist is weighted and capped at one quarter of physical support", () => {
  assert.equal(getGuestAssistCredit(1, 64), 1);
  assert.equal(getGuestAssistCredit(8, 64), 2);
  assert.equal(getGuestAssistCredit(64, 64), 16);
  assert.equal(getGuestAssistCredit(1_000, 64), 16);
  assert.equal(getGuestAssistCredit(8, 8), 2);
});

test("one account can anchor a region only during the measured founding stage", () => {
  assert.equal(
    qualifiesFrontierRegion({
      supportedPlants: 64,
      supportedSubcells: 8,
      distinctGardeners: 1,
      requiredGardeners: 1,
      activeDays: 4,
      consecutiveQualifyingDays: 3,
      sideAdjacentToEstablished: true,
    }),
    true,
  );
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
