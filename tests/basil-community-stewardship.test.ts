import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260730181729_community_stewardship_and_flexible_clearings.sql",
  "utf8",
);
const dailyTaskMigration = readFileSync(
  "supabase/migrations/20260730191059_daily_stewardship_tasks_and_project_fix.sql",
  "utf8",
);
const app = readFileSync(
  "app/community-garden/components/CommunityGardenApp.tsx",
  "utf8",
);
const canvas = readFileSync(
  "app/community-garden/components/GardenCanvas.tsx",
  "utf8",
);
const renderer = readFileSync(
  "app/community-garden/game/gardenRenderer.ts",
  "utf8",
);
const serverGarden = readFileSync("lib/communityGarden/myGarden.ts", "utf8");

test("Community Stewardship has the intended six permanent footprint ranks", () => {
  assert.match(
    migration,
    /ordinary_footprint_capacity in \(100,125,175,250,350,500\)/,
  );
  for (const requirement of [
    "tasks_completed>=3",
    "tasks_completed>=10",
    "tasks_completed>=25",
    "tasks_completed>=60",
    "tasks_completed>=120",
    "day_count>=45",
    "community_projects_completed>=3",
  ]) {
    assert.ok(migration.includes(requirement), requirement);
  }
  assert.doesNotMatch(migration, /ordinary_footprint_capacity\s*=\s*greatest\([^)]*-\s*1/);
});

test("members receive three achievable daily Garden Tasks without Care inflation or task churn", () => {
  assert.match(dailyTaskMigration, /for slot_number in 1\.\.3 loop/);
  assert.match(dailyTaskMigration, /assignment\.completed_at >= current_date::timestamptz/);
  assert.match(dailyTaskMigration, /completed_at > now\(\) - interval '48 hours'/);
  assert.doesNotMatch(
    dailyTaskMigration,
    /assign_garden_task_v1\(resolved_steward_id,\s*assignment\.slot\)/,
  );
  assert.match(migration, /conditional_key is distinct from 'weeds'/);
  assert.match(migration, /conditional_key is distinct from 'other_flowers'/);
  assert.doesNotMatch(
    migration,
    /garden_task_assignments[\s\S]{0,1200}care_balance\s*=\s*care_balance\s*\+/,
  );
});

test("ordinary account footprint is dynamic while Heritage Flowers remain outside it", () => {
  assert.match(
    migration,
    /get_community_stewardship_capacity_v1\(p_actor_key\)/,
  );
  assert.match(
    migration,
    /contributor_key=p_account_actor_key and heritage_at is null/,
  );
  assert.match(migration, /greatest\(ordinary_count-capacity,0\)/);
  assert.match(migration, /contributor_count - public\.get_community_stewardship_capacity_v1\(p_actor_key\)/);
  assert.match(migration, /coalesce\([\s\S]*ordinary_footprint_capacity[\s\S]*, 100\)/);
});

test("freeform expansion is cardinal, Care-funded, and gated at Caretaker", () => {
  assert.match(migration, /ordinary_footprint_capacity<175/);
  assert.match(migration, /parcel_x=p_parcel_x-1 and parcel_y=p_parcel_y/);
  assert.match(migration, /parcel_x=p_parcel_x and parcel_y=p_parcel_y\+1/);
  assert.match(migration, /care_balance<expansion_cost/);
  assert.ok(serverGarden.includes("getExpansionCandidates"));
  assert.match(serverGarden, /const nextExpansion = getNextExpansion\(progress\.plot_level\)/);
  assert.doesNotMatch(serverGarden, /progress\.plot_level < 5 \? getNextExpansion/);
  assert.ok(canvas.includes("expansionCandidates"));
  assert.ok(renderer.includes("drawFreeformFence"));
});

test("returning land preserves the original clearing, contents, and connectivity", () => {
  assert.match(migration, /parcel\.source='starter'/);
  assert.match(migration, /Clear every plant, path, and item before returning this land/);
  assert.match(migration, /with recursive connected\(parcel_x,parcel_y\)/);
  assert.match(migration, /connected_count<>remaining_count/);
  assert.match(migration, /if parcel\.source='freeform' then refund:=parcel\.care_cost/);
  assert.ok(app.includes("Return selected land"));
  assert.ok(app.includes("return-clearing"));
});

test("private footprint tools and task celebrations are visible only through member state", () => {
  assert.ok(app.includes("showMyCommunityFlowers"));
  assert.ok(app.includes("GardenTaskCelebration"));
  assert.ok(renderer.includes("drawPersonalCommunityFlowerMarkers"));
  assert.match(migration, /revoke all on table public\.%I from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.%I to service_role/);
});

test("project progress uses an unambiguous project id and daily tasks report completion state", () => {
  assert.match(dailyTaskMigration, /current_project_id uuid/);
  assert.match(dailyTaskMigration, /project_progress\.project_id = current_project\.id/);
  assert.match(dailyTaskMigration, /'status', task\.status/);
  assert.match(dailyTaskMigration, /'completedAt', task\.completed_at/);
});
