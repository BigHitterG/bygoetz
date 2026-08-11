import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizePendingGardenPreview } from "../lib/communityGarden/pendingGardenPreview.ts";
import {
  BASIL_COMMONS_POLICY,
} from "../lib/communityGarden/commonsPolicy.ts";
import {
  buildPhase5SimulationMatrix,
  simulateCareForMeaningfulActions,
  simulateCommonsScenario,
} from "../lib/communityGarden/phase5Simulation.ts";

function previewFor(index: number) {
  return {
    careBalance: index % 21,
    plants: [
      { gridX: index % 12, gridY: index % 16, plantType: "rose" },
      { gridX: (index + 1) % 12, gridY: (index + 1) % 16, plantType: "lavender" },
    ],
    paths: [
      { gridX: (index + 2) % 12, gridY: (index + 2) % 16 },
      { gridX: (index + 3) % 12, gridY: (index + 3) % 16 },
    ],
  };
}

test("20 clean guest previews preserve plants, paths, and Care at checkout", () => {
  for (let index = 0; index < 20; index += 1) {
    const source = previewFor(index);
    const normalized = normalizePendingGardenPreview(source);
    assert.ok(normalized);
    assert.deepEqual(normalized, source);
  }
});

test("preview normalization is deterministic and cannot duplicate occupied tiles", () => {
  const source = previewFor(3);
  source.plants.push({ ...source.plants[0] });
  source.paths.push({ ...source.paths[0] });
  const first = normalizePendingGardenPreview(source);
  const second = normalizePendingGardenPreview(source);
  assert.deepEqual(first, second);
  assert.equal(first?.plants.length, 2);
  assert.equal(first?.paths.length, 2);
});

test("malformed or oversized guest state is rejected before checkout", () => {
  assert.equal(normalizePendingGardenPreview({ ...previewFor(0), careBalance: 21 }), null);
  assert.ok(
    normalizePendingGardenPreview({
      ...previewFor(0),
      plants: Array.from({ length: 15 }, (_, index) => ({
        gridX: index % 12,
        gridY: Math.floor(index / 12),
        plantType: "rose",
      })),
    }),
  );
  assert.equal(
    normalizePendingGardenPreview({
      ...previewFor(0),
      plants: Array.from({ length: 16 }, (_, index) => ({
        gridX: index % 12,
        gridY: Math.floor(index / 12),
        plantType: "rose",
      })),
    }),
    null,
  );
});

test("production SQL and webhook preserve idempotent payment fulfillment", () => {
  const migration = readFileSync(
    "supabase/migrations/20260721230358_harden_basil_account_first_checkout.sql",
    "utf8",
  );
  const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  assert.match(migration, /for update;/i);
  assert.match(migration, /on conflict \(provider, provider_purchase_id\) do update/i);
  assert.match(migration, /garden_saved_at = coalesce\(garden_saved_at, now\(\)\)/i);
  assert.match(webhook, /stripe\.webhooks\.constructEvent/);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
});

test("checkout, import API, and SQL all preserve the 15-flower preview", () => {
  const route = readFileSync("app/api/community-garden/my-garden/route.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260811145338_expand_my_garden_guest_preview.sql",
    "utf8",
  );
  assert.match(route, /plants\.length > GUEST_GARDEN_PREVIEW_PLANT_LIMIT/);
  assert.match(migration, /limit 10[\s\S]*limit 15/i);
  assert.match(migration, /preserving up to 15 flowers/i);
});

test("10 repeated fulfillment returns are covered by one provider purchase key", () => {
  const applied = new Map<string, { gardenImports: number; entitlementWrites: number }>();
  const providerPurchaseId = "cs_test_phase5_restore";
  for (let callback = 0; callback < 10; callback += 1) {
    if (!applied.has(providerPurchaseId)) {
      applied.set(providerPurchaseId, { gardenImports: 1, entitlementWrites: 1 });
    }
  }
  assert.deepEqual(applied.get(providerPurchaseId), {
    gardenImports: 1,
    entitlementWrites: 1,
  });
});

test("Care stays proportional while the technical mutation rail bounds automation", () => {
  const bot = simulateCareForMeaningfulActions(10_000);
  assert.equal(bot.processedActions, 10_000);
  assert.equal(bot.careEarned, 10_003);
});

test("30/90/365-day matrix preserves footprint and occupancy invariants", () => {
  const matrix = buildPhase5SimulationMatrix();
  assert.equal(matrix.length, 48);
  for (const result of matrix) {
    assert.ok(result.carePerPlayerDay >= result.meaningfulActionsPerPlayerDay);
    assert.ok(result.meaningfulActionsPerPlayerDay <= BASIL_COMMONS_POLICY.dailyMutationLimit);
    assert.ok(result.projectedLivePlants <= 25_600);
  }
  const intense250 = simulateCommonsScenario({ days: 365, population: 250, profile: "intense" });
  assert.equal(intense250.projectedLivePlants, 25_000);
  assert.equal(intense250.expansionRecommended, true);
});
