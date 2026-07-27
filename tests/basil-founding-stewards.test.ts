import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getFoundingStewardActionId } from "../lib/communityGarden/foundingStewardPolicy.ts";

const migration = readFileSync(
  "supabase/migrations/20260727045342_add_three_founding_stewards.sql",
  "utf8",
);
const worker = readFileSync("lib/communityGarden/foundingStewards.ts", "utf8");
const cron = readFileSync("app/api/cron/basil-frontier/route.ts", "utf8");
const health = readFileSync("lib/communityGarden/health.ts", "utf8");
const panel = readFileSync(
  "app/community-garden/components/GardenHealthPanel.tsx",
  "utf8",
);

test("exactly three private paid-world Founding Stewards are seeded", () => {
  assert.match(migration, /1, 'rowan', 'Rowan'/);
  assert.match(migration, /2, 'clover', 'Clover'/);
  assert.match(migration, /3, 'wren', 'Wren'/);
  assert.match(migration, /paid_only boolean not null default true/);
  assert.match(migration, /steward_id between 1 and 3/);
  assert.match(migration, /revoke all on table public\.community_garden_founding_stewards from public, anon, authenticated/);
  assert.doesNotMatch(worker, /presence|avatar|player position/i);
});

test("stewards use normal account actions and avoid tutorial spawn zones", () => {
  assert.match(worker, /submitCommunityGardenAction/);
  assert.match(worker, /identityKind: "account"/);
  assert.match(worker, /TUTORIAL_CLEARANCE_TILES = 8/);
  assert.match(worker, /farFromTutorialSpawns/);
  assert.match(migration, /entitlement\.status = 'active'/);
  assert.match(migration, /entitlement\.product_key = 'basil_founding_gardener'/);
  assert.match(migration, /plant\.contributor_kind = 'account'/);
});

test("daily action IDs are deterministic and distinct", () => {
  const first = getFoundingStewardActionId("2026-07-27", 1, 1);
  assert.equal(first, getFoundingStewardActionId("2026-07-27", 1, 1));
  assert.notEqual(first, getFoundingStewardActionId("2026-07-27", 2, 1));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("the existing daily frontier cron runs stewards before evaluation", () => {
  assert.match(cron, /runCommunityGardenFoundingStewards\(\)/);
  assert.ok(
    cron.indexOf("runCommunityGardenFoundingStewards()") <
      cron.indexOf("evaluateCommunityGardenFrontier()"),
  );
  assert.match(cron, /basil_founding_stewards_failed/);
});

test("founder dashboard reports steward work without exposing keys", () => {
  assert.match(health, /get_community_garden_founding_steward_dashboard_v1/);
  assert.match(panel, /Founding Stewards/);
  assert.match(panel, /never shown as players/);
  assert.match(panel, /Heritage contribution/);
  assert.doesNotMatch(panel, /actorKey|networkKey/);
});
