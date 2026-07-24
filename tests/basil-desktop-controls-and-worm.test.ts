import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const canvasSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenCanvas.tsx",
    import.meta.url,
  ),
  "utf8",
);
const appSource = await readFile(
  new URL(
    "../app/community-garden/components/CommunityGardenApp.tsx",
    import.meta.url,
  ),
  "utf8",
);
const serverSource = await readFile(
  new URL("../lib/communityGarden/publicGardenServer.ts", import.meta.url),
  "utf8",
);
const wormMigration = await readFile(
  new URL(
    "../supabase/migrations/20260723234500_garden_worm_rewards.sql",
    import.meta.url,
  ),
  "utf8",
);

test("desktop movement supports held diagonal input without erasing click-to-walk", () => {
  assert.match(canvasSource, /pressedMovementKeysRef/);
  assert.match(canvasSource, /Math\.hypot\(inputX, inputY\)/);
  assert.match(canvasSource, /runtime\.target = isWateringSelection/);
  assert.doesNotMatch(
    canvasSource,
    /if \(inputLength > 0\) \{\s*runtime\.target = null/,
  );
});

test("desktop gameplay actions have reachable primary shortcuts and aliases", () => {
  assert.match(appSource, /code === "KeyQ" \|\| code === "KeyI"/);
  assert.match(appSource, /code === "KeyC" \|\| code === "KeyG"/);
  assert.match(appSource, /code === "KeyE"/);
});

test("Garden Worm rewards are server-authoritative, rare, and idempotent", () => {
  assert.match(
    serverSource,
    /perform_idempotent_community_garden_action_v7/,
  );
  assert.match(wormMigration, /p_action_type = 'plant'/);
  assert.match(wormMigration, /,[\s\S]*64\s*\)\s*=\s*0/);
  assert.match(wormMigration, /care_value = care_value \+ worm_bonus/);
  assert.match(wormMigration, /'\{contribution,gardenWorm\}'/);
  assert.match(
    wormMigration,
    /if coalesce\(\(result_payload #>> '\{contribution,gardenWorm\}'\)::boolean, false\) then/,
  );
});
