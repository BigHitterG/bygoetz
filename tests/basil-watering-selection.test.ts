import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceWateringSpray,
  selectDirectionalWateringTargets,
} from "../app/community-garden/lib/wateringSelection.ts";

function flower(id: string, gridX: number, gridY: number, careReady = true) {
  return { id, gridX, gridY, careReady };
}

test("eight connected flowers use two four-flower sprays for one submission", () => {
  const first = advanceWateringSpray(0, 8);
  const second = advanceWateringSpray(first.nextSprayCount, 8);

  assert.deepEqual(first, {
    nextSprayCount: 1,
    requiredSprays: 2,
    shouldSubmit: false,
    targetStartIndex: 0,
    targetEndIndex: 4,
  });
  assert.deepEqual(second, {
    nextSprayCount: 0,
    requiredSprays: 2,
    shouldSubmit: true,
    targetStartIndex: 4,
    targetEndIndex: 8,
  });
});

test("up to four connected flowers complete in one spray", () => {
  assert.deepEqual(advanceWateringSpray(0, 4), {
    nextSprayCount: 0,
    requiredSprays: 1,
    shouldSubmit: true,
    targetStartIndex: 0,
    targetEndIndex: 4,
  });
});

test("a five-flower connection reveals one final flower on the second spray", () => {
  assert.deepEqual(advanceWateringSpray(1, 5), {
    nextSprayCount: 0,
    requiredSprays: 2,
    shouldSubmit: true,
    targetStartIndex: 4,
    targetEndIndex: 5,
  });
});

test("the tapped flower anchors a broad directional spray", () => {
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
      flower("e", 5, 4),
      flower("f", 6, 4),
      flower("g", 7, 4),
      flower("h", 8, 4),
    ],
  });
  assert.equal(targets.length, 8);
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

test("only Care-ready flowers join the same connected spray", () => {
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
    new Set(["ready-a", "ready-b", "ready-c", "ready-d"]),
  );
});

test("already-watered flowers never fill remaining capacity", () => {
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
  assert.deepEqual(targets.map((target) => target.id), ["ready-a", "ready-b"]);
});

test("a flower without a water drop cannot anchor a sequence", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
    anchorCandidateId: "resting-a",
    candidates: [
      flower("resting-a", 2, 2, false),
      flower("ready-a", 3, 2),
      flower("ready-b", 4, 2),
    ],
  });
  assert.deepEqual(targets, []);
});
