import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the frontier evaluator is scheduled and remains server-authorized", () => {
  const cron = readFileSync(
    new URL("../app/api/cron/basil-frontier/route.ts", import.meta.url),
    "utf8",
  );
  const schedule = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as { crons: Array<{ path: string; schedule: string }> };

  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /if \(!secret\) return false/);
  assert.doesNotMatch(cron, /vercel-cron\/1\.0/);
  assert.match(cron, /evaluateCommunityGardenFrontier/);
  assert.ok(
    schedule.crons.some(
      (entry) =>
        entry.path === "/api/cron/basil-frontier" &&
        entry.schedule.split(" ").length === 5,
    ),
  );
  assert.equal(
    schedule.crons.some((entry) => entry.path.includes("mode=first")),
    false,
  );
});

test("owner health exposes shadow quorum without making the dashboard brittle", () => {
  const health = readFileSync(
    new URL("../lib/communityGarden/health.ts", import.meta.url),
    "utf8",
  );
  const panel = readFileSync(
    new URL("../app/community-garden/components/GardenHealthPanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(health, /get_community_garden_frontier_dashboard_v1/);
  assert.match(health, /frontier: CommunityGardenFrontierHealth \| null/);
  assert.match(health, /frontierError/);
  assert.match(panel, /Quorum frontier/);
  assert.match(panel, /Shadow measurement only/);
  assert.match(panel, /No land\s+opens automatically/);
});
