import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260812155442_garden_house_accolades.sql",
  "utf8",
);
const model = readFileSync(
  "app/community-garden/lib/gardenHouse.ts",
  "utf8",
);
const server = readFileSync("lib/communityGarden/gardenHouse.ts", "utf8");
const accountRoute = readFileSync(
  "app/api/community-garden/account/route.ts",
  "utf8",
);
const inspectRoute = readFileSync(
  "app/api/community-garden/accolades/route.ts",
  "utf8",
);
const interior = readFileSync(
  "app/community-garden/components/GardenHouseInterior.tsx",
  "utf8",
);
const app = readFileSync(
  "app/community-garden/components/CommunityGardenApp.tsx",
  "utf8",
);
const canvas = readFileSync(
  "app/community-garden/components/GardenCanvas.tsx",
  "utf8",
);
const styles = readFileSync(
  "app/community-garden/community-garden.css",
  "utf8",
);

test("Hall of Growth records are private, constrained, and cascade with the steward", () => {
  assert.match(migration, /primary key \(steward_id, display_key\)/i);
  assert.match(migration, /references public\.garden_stewards\(id\) on delete cascade/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all[^;]+public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[^;]+service_role/i);
  for (const key of [
    "stewardship",
    "tasks",
    "habitats",
    "heritage",
    "collections",
    "calendar",
    "property",
    "community",
    "worms",
  ]) {
    assert.match(migration, new RegExp(`'${key}'`));
    assert.match(model, new RegExp(`"${key}"`));
  }
});

test("the server rebuilds displays retroactively from the established game history", () => {
  for (const source of [
    "garden_stewardship_active_days",
    "garden_stewardship_accolades",
    "garden_stewardship_categories",
    "community_garden_account_actors",
    "community_garden_heritage_notifications",
    "community_garden_actions",
  ]) {
    assert.match(server, new RegExp(source));
  }
  assert.match(server, /response_payload->contribution->>gardenWorm/);
  assert.match(server, /livingGardenDiscoveries/);
  assert.match(server, /completionLifetimeCareRequired/);
  assert.match(server, /parcel\.source === "freeform"/);
  assert.match(server, /reclaimCandidates/);
  assert.match(server, /garden_house_accolades/);
  assert.match(server, /onConflict: "steward_id,display_key"/);
  assert.match(accountRoute, /getGardenHouse/);
  assert.match(accountRoute, /house,/);
});

test("inspection is authenticated and persists the seen timestamp", () => {
  assert.match(inspectRoute, /getGardenUser\(request\)/);
  assert.match(inspectRoute, /getGardenStewardByUserId\(user\.id\)/);
  assert.match(inspectRoute, /isGardenHouseDisplayKey/);
  assert.match(server, /inspected_at: inspectedAt/);
  assert.match(app, /\/api\/community-garden\/accolades/);
  assert.match(app, /isGardenHouseDisplayUnread/);
});

test("the existing house opens an immediately available walkable interior", () => {
  assert.match(canvas, /onOpenGardenHouse/);
  assert.match(canvas, /Opening the Hall of Growth/);
  assert.match(canvas, /gridX >= 5/);
  assert.match(canvas, /gridY >= -1/);
  assert.match(app, /<GardenHouseInterior/);
  assert.match(app, /buildGuestGardenHouseState\(myGarden\)/);
  assert.doesNotMatch(interior, /125[,_]000/);
  assert.match(app, /onOpenGardenHouse=\{openGardenHouse\}/);
  assert.match(interior, /onPointerDown/);
  assert.match(interior, /ArrowLeft/);
  assert.match(interior, /ArrowRight/);
  assert.match(interior, /ArrowUp/);
  assert.match(interior, /ArrowDown/);
  assert.match(interior, /Exit to My Garden/);
});

test("the fixed room includes nine earned displays, silhouettes, and a future pedestal", () => {
  for (const label of [
    "Stewardship",
    "Garden Work",
    "Living Garden",
    "Heritage Flowers",
    "Garden Collections",
    "Garden Calendar",
    "Garden Map",
    "Community Projects",
    "Garden Worms",
  ]) {
    assert.match(model, new RegExp(label));
  }
  assert.match(interior, /is-silhouette/);
  assert.match(interior, /Something still to come/);
  assert.match(interior, /role="dialog"/);
  assert.match(interior, /aria-modal="true"/);
  assert.match(styles, /\.cg-house-room/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
