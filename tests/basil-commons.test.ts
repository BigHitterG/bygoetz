import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASIL_COMMONS_POLICY,
  calculateCommonsCareAward,
} from "../lib/communityGarden/commonsPolicy.ts";

test("first meaningful action earns the +4 daily return", () => {
  assert.deepEqual(calculateCommonsCareAward({ careEarned: 0, tierProgress: 0 }, 1), {
    award: 4,
    progress: 0,
    actionsRequired: 1,
    phase: "daily",
  });
});

test("normal play earns one Care through the first 200", () => {
  assert.equal(
    calculateCommonsCareAward({ careEarned: 172, tierProgress: 0 }, 1).award,
    1,
  );
});

test("middle and long-session tiers advance at 4 and 20 actions", () => {
  assert.deepEqual(
    calculateCommonsCareAward({ careEarned: 200, tierProgress: 3 }, 1),
    { award: 1, progress: 0, actionsRequired: 4, phase: "taper4" },
  );
  assert.deepEqual(
    calculateCommonsCareAward({ careEarned: 400, tierProgress: 19 }, 1),
    { award: 1, progress: 0, actionsRequired: 20, phase: "taper20" },
  );
});

test("special flowers cannot exceed the hard daily Care ceiling", () => {
  assert.equal(
    calculateCommonsCareAward({ careEarned: 599, tierProgress: 0 }, 3).award,
    1,
  );
  assert.equal(
    calculateCommonsCareAward({ careEarned: 600, tierProgress: 0 }, 3).award,
    0,
  );
  assert.equal(BASIL_COMMONS_POLICY.dailyMutationLimit, 3_000);
});
