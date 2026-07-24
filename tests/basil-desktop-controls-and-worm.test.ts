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
const celebrationSource = await readFile(
  new URL(
    "../app/community-garden/components/GardenUnlockCelebration.tsx",
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

test("desktop movement stays click-to-walk without WASD movement", () => {
  assert.doesNotMatch(canvasSource, /pressedMovementKeysRef/);
  assert.doesNotMatch(canvasSource, /KeyW|KeyA|KeyS|KeyD/);
  assert.match(canvasSource, /runtime\.target = isWateringSelection/);
});

test("desktop gameplay actions have reachable primary shortcuts and aliases", () => {
  assert.match(appSource, /code === "KeyQ" \|\| code === "KeyI"/);
  assert.match(appSource, /code === "KeyC" \|\| code === "KeyG"/);
  assert.match(appSource, /code === "KeyE"/);
});

test("rapid click and E planting buffers one valid planting intent", () => {
  assert.match(canvasSource, /queuedPlantingRef/);
  assert.match(canvasSource, /canQueueCommunityPlant/);
  assert.match(canvasSource, /queueMicrotask\(\(\) => void performActionRef\.current\(\)\)/);
  assert.match(canvasSource, /selectionStillCurrent/);
});

test("guest Care milestones use the same visible unlock celebration queue", () => {
  assert.match(
    appSource,
    /continuedPreview\.garden\.lifetimeCare,\s*award\.preview\.garden\.lifetimeCare/,
  );
  assert.match(appSource, /temporary=\{!memberGarden\}/);
  assert.match(celebrationSource, /Join to keep this progress/);
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
  assert.match(canvasSource, /surfaceGardenWorm/);
  assert.match(appSource, /basil-garden-worm-discovery-v1/);
});
