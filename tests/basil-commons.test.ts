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

test("normal play always earns one Care after the daily return", () => {
  assert.equal(
    calculateCommonsCareAward({ careEarned: 172, tierProgress: 0 }, 1).award,
    1,
  );
});

test("long sessions never taper", () => {
  assert.deepEqual(
    calculateCommonsCareAward({ careEarned: 2_000, tierProgress: 19 }, 1),
    { award: 1, progress: 0, actionsRequired: 1, phase: "open" },
  );
  assert.deepEqual(
    calculateCommonsCareAward({ careEarned: 20_000, tierProgress: 99 }, 3),
    { award: 3, progress: 0, actionsRequired: 1, phase: "open" },
  );
});

test("technical rails allow a strong three-hour session", () => {
  assert.equal(
    calculateCommonsCareAward({ careEarned: 600, tierProgress: 0 }, 3).award,
    3,
  );
  assert.equal(BASIL_COMMONS_POLICY.dailyMutationLimit, 30_000);
  assert.ok(BASIL_COMMONS_POLICY.actorActionsPerMinute >= 150);
});
