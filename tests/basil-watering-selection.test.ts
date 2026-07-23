import assert from "node:assert/strict";
import { test } from "node:test";
import { selectDirectionalWateringTargets } from "../app/community-garden/lib/wateringSelection.ts";

function flower(id: string, gridX: number, gridY: number, careReady = true) {
  return { id, gridX, gridY, careReady };
}

test("the directional quadrant keeps a complete four-flower square", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 3,
    clickedGridY: 3,
    maryGridX: 0,
    maryGridY: 0,
    candidates: [
      flower("a", 3, 3),
      flower("b", 4, 3),
      flower("c", 3, 4),
      flower("d", 4, 4),
    ],
  });
  assert.equal(targets.length, 4);
  assert.deepEqual(new Set(targets.map((target) => target.id)), new Set(["a", "b", "c", "d"]));
});

test("an empty click beside a row can whip a four-flower chain outward", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 3,
    clickedGridY: 3,
    maryGridX: 0,
    maryGridY: 3,
    candidates: [
      flower("a", 3, 4),
      flower("b", 4, 4),
      flower("c", 5, 4),
      flower("d", 6, 4),
      flower("too-far", 10, 4),
    ],
  });
  assert.deepEqual(targets.map((target) => target.id), ["a", "b", "c", "d"]);
});

test("Care-ready flowers outrank already-watered flowers in the same connected spray", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
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

test("already-watered flowers fill remaining capacity only when needed", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
    candidates: [
      flower("ready-a", 2, 2),
      flower("ready-b", 3, 2),
      flower("resting-a", 4, 2, false),
      flower("resting-b", 5, 2, false),
    ],
  });
  assert.equal(targets.length, 4);
  assert.deepEqual(targets.slice(0, 2).map((target) => target.id), ["ready-a", "ready-b"]);
});
