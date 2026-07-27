import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FOUNDING_STEWARD_SESSION_COUNT,
  getFoundingStewardActionId,
  getFoundingStewardActionOrdinal,
  getFoundingStewardDueActions,
  getFoundingStewardScheduledCount,
} from "../lib/communityGarden/foundingStewardPolicy.ts";

const migration = readFileSync(
  "supabase/migrations/20260727045342_add_three_founding_stewards.sql",
  "utf8",
);
const paceMigration = readFileSync(
  "supabase/migrations/20260727162855_run_full_pace_founding_stewards.sql",
  "utf8",
);
const schedulerMigration = readFileSync(
  "supabase/migrations/20260727190000_schedule_founding_steward_sessions.sql",
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
  assert.match(worker, /TUTORIAL_CLEARANCE_TILES = 12/);
  assert.match(worker, /farFromTutorialSpawns/);
  assert.match(migration, /entitlement\.status = 'active'/);
  assert.match(migration, /entitlement\.product_key = 'basil_founding_gardener'/);
  assert.match(migration, /plant\.contributor_kind = 'account'/);
});

test("each steward has the requested full daily pace", () => {
  assert.match(paceMigration, /daily_plant_actions = 105/);
  assert.match(paceMigration, /daily_water_actions = 360/);
  assert.match(paceMigration, /daily_weed_actions = 12/);
  assert.equal(105 + 360 + 12, 477);
  assert.equal(3 * 477, 1431);
  assert.equal(FOUNDING_STEWARD_SESSION_COUNT, 32);
  assert.equal(getFoundingStewardScheduledCount(360, 31), 360);
});

test("resumable sessions use distinct action namespaces and bounded catch-up", () => {
  assert.equal(getFoundingStewardActionOrdinal("plant", 0), 1001);
  assert.equal(getFoundingStewardActionOrdinal("water", 0), 2001);
  assert.equal(getFoundingStewardActionOrdinal("weed", 0), 3001);
  const due = getFoundingStewardDueActions({
    dailyPlantActions: 105,
    dailyWaterActions: 360,
    dailyWeedActions: 12,
    sessionSlot: 31,
    successfulOrdinals: new Set(),
  });
  assert.equal(due.length, 24);
});

test("stewards plant locally and use normal connected watering chains", () => {
  assert.match(worker, /PLANT_TRAILS/);
  assert.match(worker, /LOCAL_WATER_REACH_TILES = 6/);
  assert.match(worker, /selectDirectionalWateringTargets/);
  assert.match(worker, /buildWaterChain/);
  assert.match(worker, /targetIds: chain\.map/);
  assert.match(worker, /actionType: "weed"/);
});

test("daily action IDs are deterministic and distinct", () => {
  const first = getFoundingStewardActionId("2026-07-27", 1, 1);
  assert.equal(first, getFoundingStewardActionId("2026-07-27", 1, 1));
  assert.notEqual(first, getFoundingStewardActionId("2026-07-27", 2, 1));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("Supabase wakes half-hour steward sessions while Vercel evaluates the frontier daily", () => {
  assert.match(cron, /runCommunityGardenFoundingStewardSession\(now\)/);
  assert.match(cron, /const frontier = await evaluateCommunityGardenFrontier\(\)/);
  assert.doesNotMatch(cron, /getUTCMinutes|shouldEvaluateFrontier/);
  assert.match(cron, /basil_founding_stewards_failed/);
  assert.match(cron, /claim_community_garden_founding_steward_tick/);
  assert.match(cron, /export async function POST/);
  assert.match(cron, /refreshFrontierIfOverdue\(now\)/);
  assert.match(cron, /community_garden_frontier_world_evaluations/);
  assert.match(cron, /data\?\.evaluation_date === today/);
  assert.match(cron, /basil_frontier_self_heal_failed/);
  assert.match(schedulerMigration, /'basil-founding-stewards-half-hour'/);
  assert.match(schedulerMigration, /'\*\/30 \* \* \* \*'/);
  assert.match(schedulerMigration, /net\.http_post/);
  assert.match(schedulerMigration, /claim_community_garden_founding_steward_tick/);
});

test("founder dashboard reports steward work without exposing keys", () => {
  assert.match(health, /get_community_garden_founding_steward_dashboard_v2/);
  assert.match(panel, /Founding Stewards/);
  assert.match(panel, /never shown as players/);
  assert.match(panel, /Heritage contribution/);
  assert.match(panel, /Today&apos;s pace/);
  assert.doesNotMatch(panel, /actorKey|networkKey/);
});
