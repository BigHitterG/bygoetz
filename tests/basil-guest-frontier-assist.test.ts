import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const foundation = readFileSync(
  "supabase/migrations/20260726053000_add_guest_frontier_assist.sql",
  "utf8",
);
const correction = readFileSync(
  "supabase/migrations/20260726054000_fix_guest_frontier_evaluator.sql",
  "utf8",
);
const migration = `${foundation}\n${correction}`;
const normalized = migration.toLowerCase();

function functionBody(name: string) {
  const start = normalized.lastIndexOf(`create or replace function public.${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = normalized.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return normalized.slice(start, end + 4);
}

test("Guest Assist is quarter-strength and cannot dominate physical support", () => {
  assert.match(migration, /guest_assist_weight_percent numeric\(5,2\)[\s\S]*default 25/i);
  assert.match(migration, /guest_assist_max_percent numeric\(5,2\)[\s\S]*default 25/i);
  const evaluator = functionBody("evaluate_community_garden_frontier_v2");
  assert.match(evaluator, /plant\.contributor_kind in \('account', 'guest'\)/);
  assert.match(evaluator, /selected_policy\.guest_assist_weight_percent \/ 100/);
  assert.match(evaluator, /selected_policy\.guest_assist_max_percent \/ 100/);
});

test("guests never count as gardeners or account activity days", () => {
  const evaluator = functionBody("evaluate_community_garden_frontier_v2");
  assert.match(evaluator, /target_record\.eligible_accounts_7d/);
  assert.match(evaluator, /target_record\.active_days_7d/);
  assert.doesNotMatch(evaluator, /eligible_accounts_7d\s*=\s*[^;]*guest/i);
  assert.match(migration, /'countsAsGardener', false/);
});

test("Founding Season stages quorum and paces early recommendations", () => {
  const stage = functionBody("get_community_garden_frontier_stage_v2");
  assert.match(stage, /<= 3 then 1/);
  assert.match(stage, /<= 11 then 2/);
  assert.match(stage, /<= 29 then 3/);
  assert.match(stage, /<= 3 then 30/);
  assert.match(stage, /<= 11 then 14/);
  assert.match(stage, /<= 29 then 7/);
  const evaluator = functionBody("evaluate_community_garden_frontier_v2");
  assert.match(evaluator, /least\(capacity_recommendation, 1\)/);
  assert.match(evaluator, /community_garden_region_state_audit/);
});

test("the evaluator is recommendation-only and service-role-only", () => {
  const evaluator = functionBody("evaluate_community_garden_frontier_v2");
  assert.doesNotMatch(evaluator, /set_community_garden_region_state_v1\s*\(/);
  assert.doesNotMatch(evaluator, /update public\.community_garden_roses/);
  assert.doesNotMatch(evaluator, /delete from public\.community_garden_roses/);
  assert.match(
    migration,
    /revoke execute on function public\.evaluate_community_garden_frontier_v2\(date\)\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.evaluate_community_garden_frontier_v2\(date\)\s+to service_role/i,
  );
});

test("the deployed evaluator disambiguates its recommendation variable", () => {
  const evaluator = functionBody("evaluate_community_garden_frontier_v2");
  assert.match(evaluator, /recommended_expansion_value integer := 0/);
  assert.match(
    evaluator,
    /recommended_expansion_count = recommended_expansion_value/,
  );
  assert.doesNotMatch(
    evaluator,
    /recommended_expansion_count = recommended_expansion_count/,
  );
});
