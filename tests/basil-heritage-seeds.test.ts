import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727143416_account_heritage_seeds.sql",
    import.meta.url,
  ),
  "utf8",
);
const account = readFileSync(
  new URL("../app/community-garden/components/GardenSteward.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../app/api/community-garden/heritage-seed/route.ts", import.meta.url),
  "utf8",
);
const retryMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727151041_lock_heritage_seed_retries.sql",
    import.meta.url,
  ),
  "utf8",
);

test("a Heritage Seed is private, explicit, retryable, and consumed only by promotion", () => {
  assert.match(migration, /create table public\.community_garden_heritage_seeds/);
  assert.match(migration, /owner_actor_key text primary key/);
  assert.match(migration, /nominated_plant_id uuid unique/);
  assert.match(migration, /heritage_plant_id uuid unique/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /seed\.nominated_plant_id is distinct from new\.id/);
  assert.match(migration, /seed\.redeemed_at is not null/);
  assert.match(migration, /redeemed_at = new\.heritage_at/);
  assert.match(migration, /count\(\*\)::integer[\s\S]+plant\.heritage_at is not null/);
});

test("members can choose, monitor, and visit their one Heritage Flower", () => {
  assert.match(account, /Choose your Heritage Flower/);
  assert.doesNotMatch(account, /Choose a different flower/);
  assert.match(account, /Visit your Heritage Flower/);
  assert.match(account, /Heritage Gardener/);
  assert.match(account, /\/api\/community-garden\/heritage-seed/);
  assert.match(route, /hasAllowedBasilRequestOrigin/);
  assert.match(route, /getGardenUser/);
});

test("Founding Stewards receive the same single lifetime opportunity", () => {
  assert.match(migration, /owner_kind in \('member', 'founding_steward'\)/);
  assert.match(migration, /insert into public\.community_garden_heritage_seeds[\s\S]+community_garden_founding_stewards/);
  assert.match(migration, /nominate_founding_steward_heritage_seed_v1/);
});

test("a failed attempt returns the seed but requires a newly planted flower", () => {
  assert.match(migration, /release_failed_community_garden_heritage_seed_v1/);
  assert.match(migration, /available_since = statement_timestamp\(\)/);
  assert.match(migration, /plant\.planted_at >= seed\.available_since/);
  assert.match(migration, /Heritage Seed is already growing with its nominated flower/);
  assert.match(retryMigration, /guard_community_garden_heritage_nomination_v1/);
  assert.match(retryMigration, /get_community_garden_heritage_seed_v2/);
  assert.match(retryMigration, /candidate\.planted_at < old\.available_since/);
});
