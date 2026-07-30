import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  mergeHeritageMomentQueue,
  parseHeritageMoment,
  parseHeritageMoments,
} from "../app/community-garden/lib/heritageNotifications.ts";

const planter = {
  id: "11111111-1111-4111-8111-111111111111",
  event_id: "22222222-2222-4222-8222-222222222222",
  plant_id: "33333333-3333-4333-8333-333333333333",
  plant_type: "rose",
  grid_x: 8,
  grid_y: -4,
  became_heritage_at: "2026-07-25T18:00:00.000Z",
} as const;

test("Heritage notifications normalize durable server payloads", () => {
  assert.deepEqual(parseHeritageMoment(planter, "planter"), {
    notificationId: planter.id,
    eventId: planter.event_id,
    plantId: planter.plant_id,
    plantType: "rose",
    gridX: 8,
    gridY: -4,
    role: "planter",
    becameHeritageAt: planter.became_heritage_at,
  });

  assert.equal(
    parseHeritageMoment({ ...planter, plant_type: "not-a-flower" }, "planter"),
    null,
  );
  assert.equal(
    parseHeritageMoment({ ...planter, grid_x: 1.5 }, "planter"),
    null,
  );
});

test("the celebration queue is ordered and idempotent", () => {
  const parsed = parseHeritageMoments([planter], "planter");
  assert.equal(parsed.length, 1);
  assert.strictEqual(mergeHeritageMomentQueue(parsed, parsed), parsed);
  const helper = parseHeritageMoment(
    {
      eventId: "44444444-4444-4444-8444-444444444444",
      plantId: "55555555-5555-4555-8555-555555555555",
      plantType: "lavender",
      gridX: 9,
      gridY: -4,
      role: "helper",
      becameHeritageAt: "2026-07-25T18:01:00.000Z",
    },
  );
  assert.ok(helper);
  assert.deepEqual(
    mergeHeritageMomentQueue(parsed, [helper]).map((moment) => moment.role),
    ["planter", "helper"],
  );
});

test("Heritage news is explicit, private, and integrated without modal overlap", () => {
  const app = readFileSync(
    new URL("../app/community-garden/components/CommunityGardenApp.tsx", import.meta.url),
    "utf8",
  );
  const canvas = readFileSync(
    new URL("../app/community-garden/components/GardenCanvas.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../app/api/community-garden/heritage-notifications/route.ts", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL("../lib/communityGarden/publicGardenServer.ts", import.meta.url),
    "utf8",
  );

  assert.match(app, /onHeritageMoments=\{queueHeritageMoments\}/);
  assert.match(app, /<HeritageFlowerCelebration/);
  assert.match(
    app,
    /visibleHeritageMoment \|\|\s+visibleHeritageEncounter \|\|\s+careBlossomFound/,
  );
  assert.match(app, /goToGridPosition\(current\.gridX, current\.gridY\)/);
  assert.match(canvas, /heritagePlantIds/);
  assert.match(canvas, /onHeritageMomentsRef\.current\?\.\(heritageMoments\)/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /hasAllowedBasilRequestOrigin/);
  assert.match(route, /\.slice\(0, 20\)/);
  assert.match(server, /reconcile_community_garden_actor_v3/);
  assert.doesNotMatch(server, /registrationError/);
});
