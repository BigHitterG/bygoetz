import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceWateringPump,
  selectDirectionalWateringTargets,
} from "../app/community-garden/lib/wateringSelection.ts";

function flower(id: string, gridX: number, gridY: number, careReady = true) {
  return { id, gridX, gridY, careReady };
}

test("watering requires three pumps before one spray is submitted", () => {
  const first = advanceWateringPump(0, 3);
  const second = advanceWateringPump(first.nextPumpCount, 3);
  const third = advanceWateringPump(second.nextPumpCount, 3);

  assert.deepEqual(first, { nextPumpCount: 1, requiredPumps: 3, shouldSpray: false });
  assert.deepEqual(second, { nextPumpCount: 2, requiredPumps: 3, shouldSpray: false });
  assert.deepEqual(third, { nextPumpCount: 0, requiredPumps: 3, shouldSpray: true });
});

test("an isolated flower sprays on the first tap", () => {
  assert.deepEqual(advanceWateringPump(0, 1), {
    nextPumpCount: 0,
    requiredPumps: 1,
    shouldSpray: true,
  });
});

test("a two-flower connection completes on the second tap", () => {
  const first = advanceWateringPump(0, 2);
  const second = advanceWateringPump(first.nextPumpCount, 2);

  assert.deepEqual(first, {
    nextPumpCount: 1,
    requiredPumps: 2,
    shouldSpray: false,
  });
  assert.deepEqual(second, {
    nextPumpCount: 0,
    requiredPumps: 2,
    shouldSpray: true,
  });
});

test("the tapped flower anchors a three-flower directional spray", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 3,
    clickedGridY: 3,
    maryGridX: 0,
    maryGridY: 0,
    anchorCandidateId: "a",
    candidates: [
      flower("a", 3, 3),
      flower("b", 4, 3),
      flower("c", 3, 4),
      flower("d", 4, 4),
    ],
  });
  assert.equal(targets.length, 3);
  assert.equal(targets[0].id, "a");
});

test("an empty click cannot start a watering spray", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 3,
    clickedGridY: 3,
    maryGridX: 0,
    maryGridY: 3,
    anchorCandidateId: null,
    candidates: [
      flower("a", 3, 4),
      flower("b", 4, 4),
      flower("c", 5, 4),
      flower("d", 6, 4),
      flower("too-far", 10, 4),
    ],
  });
  assert.deepEqual(targets, []);
});

test("Care-ready flowers outrank already-watered flowers in the same connected spray", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
    anchorCandidateId: "ready-a",
    candidates: [
      flower("resting-a", 2, 2, false),
      flower("resting-b", 2, 3, false),
      flower("ready-a", 3, 2),
      flower("ready-b", 4, 2),
      flower("ready-c", 5, 2),
      flower("ready-d", 6, 2),
    ],
  });
  assert.deepEqual(
    new Set(targets.map((target) => target.id)),
    new Set(["ready-a", "ready-b", "ready-c"]),
  );
});

test("already-watered flowers fill remaining capacity only when needed", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
    anchorCandidateId: "ready-a",
    candidates: [
      flower("ready-a", 2, 2),
      flower("ready-b", 3, 2),
      flower("resting-a", 4, 2, false),
      flower("resting-b", 5, 2, false),
    ],
  });
  assert.equal(targets.length, 3);
  assert.deepEqual(targets.slice(0, 2).map((target) => target.id), ["ready-a", "ready-b"]);
});
