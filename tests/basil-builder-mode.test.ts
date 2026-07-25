import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getBuilderAppendResult,
  getBuilderDirectionalCell,
  MY_GARDEN_BUILDER_MAX_TILES,
} from "../app/community-garden/lib/myGardenBuilder.ts";

test("Builder screen taps extend one square in the dominant direction", () => {
  const head = { gridX: 5, gridY: 5 };
  const screen = { width: 400, height: 800 };

  assert.deepEqual(
    getBuilderDirectionalCell(head, { ...screen, x: 390, y: 410 }),
    { gridX: 6, gridY: 5 },
  );
  assert.deepEqual(
    getBuilderDirectionalCell(head, { ...screen, x: 10, y: 390 }),
    { gridX: 4, gridY: 5 },
  );
  assert.deepEqual(
    getBuilderDirectionalCell(head, { ...screen, x: 210, y: 10 }),
    { gridX: 5, gridY: 4 },
  );
  assert.deepEqual(
    getBuilderDirectionalCell(head, { ...screen, x: 190, y: 790 }),
    { gridX: 5, gridY: 6 },
  );
});

test("Builder chains append orthogonally and let the player undo", () => {
  const cells = [
    { gridX: 0, gridY: 0 },
    { gridX: 1, gridY: 0 },
  ];
  assert.deepEqual(
    getBuilderAppendResult(cells, { gridX: 1, gridY: 1 }),
    { kind: "append" },
  );
  assert.deepEqual(
    getBuilderAppendResult(cells, { gridX: 0, gridY: 0 }),
    { kind: "undo" },
  );
});

test("Builder chains reject gaps, crossings, and more than ten squares", () => {
  const cells = Array.from(
    { length: MY_GARDEN_BUILDER_MAX_TILES },
    (_, gridX) => ({ gridX, gridY: 0 }),
  );
  assert.equal(
    getBuilderAppendResult(cells, { gridX: 11, gridY: 0 }).kind,
    "invalid",
  );
  assert.equal(
    getBuilderAppendResult(cells.slice(0, 3), { gridX: 0, gridY: 0 }).kind,
    "invalid",
  );
  assert.equal(
    getBuilderAppendResult(cells.slice(0, 2), { gridX: 4, gridY: 0 }).kind,
    "invalid",
  );
});

test("Builder migration is member-only, atomic, idempotent, and one-tile", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260725151823_add_my_garden_builder_mode.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /product_key = 'basil_founding_gardener'/);
  assert.match(migration, /cell_count < 1 or cell_count > 10/);
  assert.match(migration, /on conflict \(action_id\) do nothing/);
  assert.match(migration, /item_width <> 1 or item_height <> 1/);
  assert.match(
    migration,
    /revoke execute on function public\.apply_my_garden_builder_action[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.apply_my_garden_builder_action[\s\S]*to service_role/,
  );
});
