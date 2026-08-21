import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  advanceWateringSpray,
  selectDirectionalWateringTargets,
} from "../app/community-garden/lib/wateringSelection.ts";

const personalCareMigration = await readFile(
  new URL(
    "../supabase/migrations/20260804031012_basil_personal_watering_care.sql",
    import.meta.url,
  ),
  "utf8",
);

function flower(id: string, gridX: number, gridY: number, careReady = true) {
  return { id, gridX, gridY, careReady };
}

test("six connected flowers use two three-flower sprays for one submission", () => {
  const first = advanceWateringSpray(0, 6);
  const second = advanceWateringSpray(first.nextSprayCount, 6);

  assert.deepEqual(first, {
    nextSprayCount: 1,
    requiredSprays: 2,
    shouldSubmit: false,
    targetStartIndex: 0,
    targetEndIndex: 3,
  });
  assert.deepEqual(second, {
    nextSprayCount: 0,
    requiredSprays: 2,
    shouldSubmit: true,
    targetStartIndex: 3,
    targetEndIndex: 6,
  });
});

test("up to three connected flowers complete in one spray", () => {
  assert.deepEqual(advanceWateringSpray(0, 3), {
    nextSprayCount: 0,
    requiredSprays: 1,
    shouldSubmit: true,
    targetStartIndex: 0,
    targetEndIndex: 3,
  });
});

test("a four-flower connection reveals one final flower on the second spray", () => {
  assert.deepEqual(advanceWateringSpray(1, 4), {
    nextSprayCount: 0,
    requiredSprays: 2,
    shouldSubmit: true,
    targetStartIndex: 3,
    targetEndIndex: 4,
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
  assert.equal(targets.length, 6);
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

test("watering stays inside the nearby connected flower island", () => {
  const targets = selectDirectionalWateringTargets({
    clickedGridX: 2,
    clickedGridY: 2,
    maryGridX: 0,
    maryGridY: 2,
    anchorCandidateId: "island-a",
    candidates: [
      flower("island-a", 2, 2),
      flower("island-b", 3, 2),
      flower("distant-a", 6, 6),
      flower("distant-b", 7, 6),
      flower("off-map-distance", 12, 2),
    ],
  });

  assert.deepEqual(targets.map((target) => target.id), [
    "island-a",
    "island-b",
  ]);
});

test("Care-ready flowers are preferred while resting flowers remain waterable", () => {
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
  assert.equal(targets[0].id, "ready-a");
  assert.deepEqual(
    new Set(targets.map((target) => target.id)),
    new Set([
      "ready-a",
      "ready-b",
      "ready-c",
      "ready-d",
      "resting-a",
      "resting-b",
    ]),
  );
});

test("resting flowers fill remaining spray capacity", () => {
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
  assert.deepEqual(targets.map((target) => target.id), [
    "ready-a",
    "ready-b",
    "resting-a",
    "resting-b",
  ]);
});

test("a resting flower can anchor a watering sequence without earning Care", () => {
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
  assert.equal(targets[0].id, "resting-a");
  assert.deepEqual(
    new Set(targets.map((target) => target.id)),
    new Set(["resting-a", "ready-a", "ready-b"]),
  );
});

test("Care eligibility is personal and legacy shared claims are retired", () => {
  assert.match(
    personalCareMigration,
    /left join public\.community_garden_watering_history as personal/,
  );
  assert.match(
    personalCareMigration,
    /personal\.last_rewarded_at is null[\s\S]*personal\.last_rewarded_at <= checked_at - interval '4 hours'/,
  );
  assert.doesNotMatch(
    personalCareMigration,
    /insert into public\.community_garden_watering_claims/,
  );
  assert.match(
    personalCareMigration,
    /update public\.community_garden_watering_claims[\s\S]*where released_at is null/,
  );
});

