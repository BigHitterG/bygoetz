import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const app = read("app/community-garden/components/CommunityGardenApp.tsx");
const shareUi = read("app/community-garden/components/GardenShare.tsx");
const canvas = read("app/community-garden/components/GardenCanvas.tsx");
const collectionRoute = read("app/api/community-garden/shares/route.ts");
const revokeRoute = read(
  "app/api/community-garden/shares/[shareId]/route.ts",
);
const imageRoute = read(
  "app/api/community-garden/shares/[shareId]/image/route.ts",
);
const shareStore = read("lib/communityGarden/shares.ts");
const deletionRoute = read(
  "app/api/community-garden/account/delete/route.ts",
);
const publicPage = read("app/garden/[shareId]/page.tsx");
const migration = read(
  "supabase/migrations/20260725173626_add_member_garden_sharing.sql",
);

test("sharing is visible only inside a paid member's My Garden", () => {
  assert.match(
    app,
    /world === "personal" && session && accountChecked && memberGarden/,
  );
  assert.match(app, /<GardenShare/);
  assert.match(collectionRoute, /getGardenStewardByUserId\(user\.id\)/);
  assert.match(collectionRoute, /An active Garden Membership is required/);
  assert.match(revokeRoute, /getGardenStewardByUserId\(user\.id\)/);
});

test("the generated social card excludes live UI and account data", () => {
  assert.match(canvas, /scope === "whole"/);
  assert.match(canvas, /scope === "whole"[\s\S]*sourceCanvas\.width/);
  assert.match(canvas, /mary: hiddenCharacter/);
  assert.match(canvas, /duck: hiddenCharacter/);
  assert.match(canvas, /shareOnly: true/);
  assert.match(canvas, /getVisibleCanvasBounds/);
  assert.match(canvas, /nextExpansion: null/);
  assert.doesNotMatch(canvas, /email/i);
  assert.doesNotMatch(publicPage, /care balance/i);
  assert.match(publicPage, /Shared Garden/);
});

test("share uploads are origin checked, bounded, and exact Basil PNG cards", () => {
  const originCheck = collectionRoute.indexOf(
    "hasAllowedBasilRequestOrigin",
  );
  const memberCheck = collectionRoute.indexOf("if (!steward)");
  const formParse = collectionRoute.indexOf("request.formData()");
  assert.ok(originCheck >= 0);
  assert.ok(memberCheck > originCheck);
  assert.ok(formParse > memberCheck);
  assert.match(collectionRoute, /GARDEN_SHARE_MAX_BYTES/);
  assert.match(collectionRoute, /PNG_SIGNATURE/);
  assert.match(collectionRoute, /width < GARDEN_SHARE_MIN_WIDTH/);
  assert.match(collectionRoute, /height < GARDEN_SHARE_MIN_HEIGHT/);
  assert.match(collectionRoute, /width > GARDEN_SHARE_MAX_DIMENSION/);
});

test("public links expose only active token-addressed images", () => {
  assert.match(shareStore, /randomBytes\(24\)\.toString\("base64url"\)/);
  assert.match(shareStore, /\.is\("revoked_at", null\)/);
  assert.match(imageRoute, /getPublicGardenShare\(shareId\)/);
  assert.match(imageRoute, /private, no-store/);
  assert.match(imageRoute, /x-content-type-options/);
  assert.doesNotMatch(publicPage, /steward_id|user_id|email/i);
});

test("members can use native share, save an image, copy, and revoke", () => {
  assert.match(shareUi, /navigator\.share/);
  assert.match(shareUi, /navigator\.canShare/);
  assert.match(shareUi, /navigator\.clipboard/);
  assert.match(shareUi, /download = "basil-my-garden\.png"/);
  assert.match(shareUi, /Stop Sharing/);
  assert.match(revokeRoute, /revokeGardenShare\(steward\.id, shareId\)/);
});

test("share records and private files are covered by account deletion", () => {
  assert.match(deletionRoute, /removeGardenShareAssetsForUser\(user\.id\)/);
  assert.match(migration, /references public\.garden_stewards\(id\)/);
  assert.match(migration, /on delete cascade/);
  assert.match(migration, /'basil-garden-shares'/);
  assert.match(migration, /public,\s*anon,\s*authenticated/i);
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.garden_public_snapshots[\s\S]*to service_role/,
  );
  assert.match(migration, /enable row level security/);
});
