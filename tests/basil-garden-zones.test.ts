import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  planCommunityGardenZones,
  type CommunityGardenZoneSignal,
} from "../lib/communityGarden/gardenZones.ts";

function signal(
  regionX: number,
  regionY: number,
  plantCount = 0,
  heritagePlantCount = 0,
): CommunityGardenZoneSignal {
  return {
    regionKey: `${regionX}:${regionY}`,
    regionX,
    regionY,
    isOpen: true,
    landState: "founding",
    plantCount,
    heritagePlantCount,
    coveredSubcells: plantCount > 0 ? 6 : 0,
    distinctGardeners: plantCount > 0 ? 2 : 0,
  };
}

test("the Heart follows the largest connected established cluster", () => {
  const signals: CommunityGardenZoneSignal[] = [];
  for (let y = -2; y <= 3; y += 1) {
    for (let x = -2; x <= 3; x += 1) signals.push(signal(x, y));
  }
  const counts = new Map([
    ["0:0", 24],
    ["1:0", 21],
    ["0:1", 18],
    ["3:3", 140],
  ]);
  for (const item of signals) item.plantCount = counts.get(item.regionKey) ?? 0;

  const plan = planCommunityGardenZones(signals, {
    evaluatedOn: "2026-07-26",
    source: "daily-frontier",
  });

  assert.deepEqual(plan.heartRegionKeys, ["0:0", "0:1", "1:0"]);
  assert.equal(plan.zoneByRegionKey.get("3:3"), "garden");
  assert.equal(plan.zoneByRegionKey.get("1:1"), "growth-ring");
  assert.equal(plan.zoneByRegionKey.get("-1:-1"), "growth-ring");
  assert.equal(plan.zoneByRegionKey.get("-2:-2"), "garden");
});

test("closed and fallow land cannot become part of the Heart", () => {
  const closed = { ...signal(0, 0, 180, 2), isOpen: false };
  const fallow = { ...signal(1, 0, 180, 2), landState: "fallow" as const };
  const established = signal(2, 0, 30, 1);
  const plan = planCommunityGardenZones([closed, fallow, established], {
    evaluatedOn: "2026-07-26",
    source: "daily-frontier",
  });
  assert.deepEqual(plan.heartRegionKeys, ["2:0"]);
  assert.equal(plan.zoneByRegionKey.has("0:0"), false);
  assert.equal(plan.zoneByRegionKey.get("1:0"), "growth-ring");
});

test("the zone release is explanatory and does not alter Care rewards", () => {
  const guide = readFileSync(
    new URL("../app/community-garden/components/GardenGuide.tsx", import.meta.url),
    "utf8",
  );
  const manifest = readFileSync(
    new URL("../lib/communityGarden/regionDelivery.ts", import.meta.url),
    "utf8",
  );
  assert.match(guide, /Garden Heart/);
  assert.match(guide, /Growth Ring/);
  assert.match(guide, /does not change Care rewards/);
  assert.match(manifest, /guidanceZone/);
  assert.doesNotMatch(manifest, /careValue|award.*Care/i);
});
