import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726020008_quorum_frontier_growth_foundation.sql",
  "utf8",
);
const normalized = migration.toLowerCase();

function functionBody(name: string) {
  const start = normalized.indexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = normalized.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return normalized.slice(start, end + 4);
}

test("the frontier migration is one atomic, non-destructive foundation", () => {
  assert.equal((normalized.match(/^begin;/gm) ?? []).length, 1);
  assert.equal((normalized.match(/^commit;/gm) ?? []).length, 1);

  const initialization = normalized.slice(
    0,
    normalized.indexOf("create or replace function"),
  );
  assert.doesNotMatch(
    initialization,
    /(?:update|delete from)\s+public\.community_garden_roses/,
  );
  assert.match(migration, /generate_series\(-6, 3\)/);
  assert.match(migration, /automation_enabled boolean not null default false/i);
});
test("policy values match the reviewed shadow-mode model", () => {
  for (const expected of [
    /effective_region_capacity integer not null default 180/i,
    /prepare_percent numeric\(5,2\) not null default 50/i,
    /expand_percent numeric\(5,2\) not null default 60/i,
    /target_percent numeric\(5,2\) not null default 55/i,
    /supported_live_plants integer not null default 64/i,
    /supported_subcells integer not null default 8/i,
    /supported_accounts integer not null default 6/i,
    /supported_active_days integer not null default 4/i,
    /supported_consecutive_days integer not null default 3/i,
    /max_regions_per_actor_day integer not null default 3/i,
    /heritage_capacity_per_region integer not null default 9/i,
  ]) {
    assert.match(migration, expected);
  }
  assert.match(migration, /greatest\(\s*12,\s*ceil\(perimeter_regions::numeric \/ 3\)/i);
});

test("browser roles cannot read or mutate private frontier state", () => {
  const privateTables = [
    "community_garden_account_actors",
    "community_garden_region_actor_days",
    "community_garden_region_action_evidence",
    "community_garden_frontier_policy",
    "community_garden_frontier_world_evaluations",
    "community_garden_frontier_region_evaluations",
    "community_garden_region_state_audit",
    "community_garden_heritage_events",
    "community_garden_heritage_notifications",
  ];
  for (const table of privateTables) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated`, "i"),
    );
  }
  assert.match(
    migration,
    /revoke all on sequence public\.community_garden_region_state_audit_id_seq\s+from public, anon, authenticated/i,
  );
  assert.doesNotMatch(migration, /grant[^;]+\bto (?:anon|authenticated)\b/i);
});

test("tile mutations share locks and fallow land cannot accept new plants", () => {
  const plantGuard = functionBody("enforce_community_garden_plant_insert_v1");
  const weedGuard = functionBody("enforce_community_garden_weed_insert_v1");
  assert.match(plantGuard, /basil-community-tile:/);
  assert.match(weedGuard, /basil-community-tile:/);
  assert.match(plantGuard, /basil-community-region:/);
  assert.match(weedGuard, /basil-community-region:/);
  assert.match(plantGuard, /if target_land_state = 'fallow'/);
});

test("the existing v9 contract remains compatible and idempotent", () => {
  const action = functionBody("perform_idempotent_community_garden_action_v9");
  assert.match(
    migration,
    /perform_idempotent_community_garden_action_v9\(\s*p_action_id uuid,\s*p_actor_key text,\s*p_network_key text,\s*p_is_guest boolean,\s*p_action_type text,\s*p_grid_x integer default null,\s*p_grid_y integer default null,\s*p_plant_type text default null,\s*p_plant_ids uuid\[\] default null/i,
  );
  assert.match(action, /result_payload -> 'heritageplantids'/);
  assert.match(action, /'\{heritagemoments\}'/);
  assert.match(action, /update public\.community_garden_actions/);
  assert.match(action, /where action_id = p_action_id and status = 'completed'/);
});

test("Heritage promotion is account-only, capacity-indexed, and durable", () => {
  const capacity = functionBody("enforce_community_garden_heritage_capacity_v1");
  const notificationRead = functionBody(
    "get_community_garden_heritage_notifications_v1",
  );
  const notificationAck = functionBody(
    "acknowledge_community_garden_heritage_notifications_v1",
  );
  assert.match(capacity, /new\.contributor_kind <> 'account'/);
  assert.match(capacity, /land_state not in \('founding', 'established'\)/);
  assert.match(migration, /community_garden_heritage_events_region_idx/);
  assert.doesNotMatch(notificationRead, /acknowledged_at\s*=/);
  assert.match(notificationAck, /recipient_user_id = p_user_id/);
  assert.match(notificationAck, /cardinality\(p_notification_ids\) > 20/);
});

test("quorum credits actual candidate regions and never opens land automatically", () => {
  const evaluator = functionBody("evaluate_community_garden_frontier_v1");
  assert.match(evaluator, /frontier_targets as/);
  assert.match(evaluator, /ranked_candidate_activity as/);
  assert.match(evaluator, /partition by activity\.actor_key, activity\.activity_date/);
  assert.match(evaluator, /credited_candidate_number\s+<= selected_policy\.max_regions_per_actor_day/);
  assert.match(evaluator, /where day\.actor_kind = 'account'/);
  assert.match(evaluator, /not target_record\.region_exists/);
  assert.match(evaluator, /region\.land_state in \('founding', 'established', 'frontier'\)/);
  assert.doesNotMatch(evaluator, /set_community_garden_region_state_v1\s*\(/);
});
