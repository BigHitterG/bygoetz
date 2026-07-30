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
const naturalMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727155145_automate_account_heritage_flowers.sql",
    import.meta.url,
  ),
  "utf8",
);

test("the one-per-account Heritage record stays private", () => {
  assert.match(migration, /create table public\.community_garden_heritage_seeds/);
  assert.match(migration, /owner_actor_key text primary key/);
  assert.match(migration, /nominated_plant_id uuid unique/);
  assert.match(migration, /heritage_plant_id uuid unique/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete[\s\S]+to service_role/);
});

test("members naturally grow and can visit their one Heritage Flower", () => {
  assert.doesNotMatch(account, /Choose your Heritage Flower/);
  assert.doesNotMatch(account, /Nominate/);
  assert.doesNotMatch(account, /\/api\/community-garden\/heritage-seed/);
  assert.match(account, /may naturally become Heritage/);
  assert.match(account, /Visit your Heritage Flower/);
  assert.match(account, /cg-heritage-visit-button/);
  assert.match(account, /You do not have a Heritage Flower to visit yet/);
  assert.match(account, /Heritage Gardener/);
});

test("Founding Stewards receive the same single lifetime opportunity", () => {
  assert.match(migration, /owner_kind in \('member', 'founding_steward'\)/);
  assert.match(migration, /insert into public\.community_garden_heritage_seeds[\s\S]+community_garden_founding_stewards/);
  assert.match(naturalMigration, /seed_owner_kind := 'founding_steward'/);
});

test("automatic promotion selects only a qualifying owner flower and is concurrency safe", () => {
  assert.match(naturalMigration, /get_community_garden_heritage_seed_v3/);
  assert.match(naturalMigration, /active paid members and the three private Founding Stewards/);
  assert.match(naturalMigration, /pg_advisory_xact_lock/);
  assert.match(naturalMigration, /redeemed_at is not null/);
  assert.match(naturalMigration, /nominated_plant_id = new\.id/);
  assert.match(naturalMigration, /account-heritage-natural-v1/);
  assert.match(naturalMigration, /where redeemed_at is null/);
  assert.match(naturalMigration, /where plant\.region_x = new\.region_x/);
  assert.doesNotMatch(naturalMigration, /create trigger nominate_founding_steward/);
});
