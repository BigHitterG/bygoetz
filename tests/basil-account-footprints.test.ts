import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260725022936_account_based_community_footprints.sql",
  "utf8",
);
const gardenServer = readFileSync(
  "lib/communityGarden/publicGardenServer.ts",
  "utf8",
);
const actionRoute = readFileSync(
  "app/api/community-garden/action/route.ts",
  "utf8",
);
const canvas = readFileSync(
  "app/community-garden/components/GardenCanvas.tsx",
  "utf8",
);

test("authenticated Community Garden identity is a one-way account key", () => {
  assert.match(gardenServer, /sign\(`account:\$\{userId\}`\)/);
  assert.match(gardenServer, /reconcile_community_garden_actor_v3/);
  assert.doesNotMatch(gardenServer, /user\.email/);
});

test("garden requests carry the current account session into authoritative routes", () => {
  assert.match(canvas, /accountAccessTokenRef/);
  assert.match(actionRoute, /await getCanonicalGardenActor\(request\)/);
  assert.match(actionRoute, /identityKind: actor\.identityKind/);
});

test("guest flowers expire after 24 hours and account transfer clears that expiry", () => {
  assert.match(migration, /action_time \+ interval '24 hours'/i);
  assert.match(migration, /guest_expires_at = null/i);
  assert.match(migration, /guest_expires_at <= statement_timestamp\(\)/i);
});

test("guest-to-account reconciliation is idempotent and preserves one newest-100 footprint", () => {
  assert.match(migration, /on conflict \(actor_key, activity_date\) do update/i);
  assert.match(migration, /on conflict \(actor_key, plant_id\) do update/i);
  assert.match(migration, /row_number\(\) over \(order by created_at, id\)/i);
  assert.match(migration, /overflow_count := greatest\(ordinary_count - 100, 0\)/i);
  assert.match(migration, /where contributor_key = p_account_actor_key\s+and heritage_at is null/i);
});

test("Heritage Flowers remain outside the ordinary footprint and guests cannot promote one", () => {
  assert.match(migration, /plant\.contributor_kind <> ''guest''/i);
  assert.match(migration, /guest_expires_at = null/i);
  assert.match(migration, /and heritage_at is null/i);
});
