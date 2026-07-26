import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726050000_founder_frontier_dashboard.sql",
  "utf8",
);
const health = readFileSync("lib/communityGarden/health.ts", "utf8");
const panel = readFileSync(
  "app/community-garden/components/GardenHealthPanel.tsx",
  "utf8",
);
const dashboard = readFileSync(
  "app/community-garden/components/FounderFrontierDashboard.tsx",
  "utf8",
);

test("the founder frontier RPC is aggregate-only and service-role-only", () => {
  assert.match(migration, /get_community_garden_frontier_dashboard_v1/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(
    migration,
    /revoke execute on function public\.get_community_garden_frontier_dashboard_v1\(\)\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_community_garden_frontier_dashboard_v1\(\)\s+to service_role/i,
  );
  assert.doesNotMatch(migration, /planter_actor_key|helper_actor_key|recipient_user_id/);
  assert.doesNotMatch(migration, /requested_by',|user_id',|email/i);
});

test("the private health route requests the expanded frontier dashboard", () => {
  assert.match(health, /get_community_garden_frontier_dashboard_v1/);
  assert.match(health, /map: \{/);
  assert.match(health, /trends: CommunityGardenFrontierTrend\[\]/);
  assert.match(health, /recentStateChanges: CommunityGardenRegionStateChange\[\]/);
  assert.match(health, /thomas\.goetz\.jr@gmail\.com/);
  assert.match(panel, /FounderFrontierDashboard/);
});

test("the founder UI is visual, explainable, and cannot change land", () => {
  assert.match(dashboard, /How the frontier is forming/);
  assert.match(dashboard, /Density/);
  assert.match(dashboard, /Support/);
  assert.match(dashboard, /Heritage/);
  assert.match(dashboard, /Owner decision inbox/);
  assert.match(dashboard, /Why this region is not advancing yet/);
  assert.match(dashboard, /Read-only: this dashboard cannot change the garden/);
  assert.doesNotMatch(dashboard, /set_community_garden_region_state_v1/);
  assert.doesNotMatch(dashboard, /fetch\(/);
});
