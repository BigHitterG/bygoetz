import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const route = readFileSync(
  join(root, "app/api/community-garden/feedback/route.ts"),
  "utf8",
);
const reports = readFileSync(
  join(root, "lib/communityGarden/stewards.ts"),
  "utf8",
);
const app = readFileSync(
  join(root, "app/community-garden/components/CommunityGardenApp.tsx"),
  "utf8",
);
const reporter = readFileSync(
  join(root, "app/community-garden/components/GardenBugReporter.tsx"),
  "utf8",
);
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260725135402_add_anonymous_member_reports.sql",
  ),
  "utf8",
);

test("the quiet reporter is rendered only for a verified member garden", () => {
  assert.match(app, /session && accountChecked && memberGarden/);
  assert.match(app, /GardenBugReporter accessToken=\{session\.access_token\}/);
  assert.match(reporter, /Report a bug or share an idea/);
  assert.match(reporter, /Your name and email are not attached/);
});

test("the server verifies origin and active membership before parsing a report", () => {
  const originCheck = route.indexOf("hasAllowedBasilRequestOrigin");
  const membershipCheck = route.indexOf("if (!steward)");
  const multipartParsing = route.indexOf('startsWith("multipart/form-data")');
  assert.ok(originCheck >= 0);
  assert.ok(membershipCheck > originCheck);
  assert.ok(multipartParsing > membershipCheck);
  assert.match(route, /claimAnonymousGardenReportSlot\(user!\.id\)/);
  assert.match(route, /status: 429/);
});

test("anonymous reports store neither the user nor the steward", () => {
  assert.match(reports, /steward_id: null/);
  assert.match(reports, /submission_kind: `anonymous_\$\{input\.kind\}`/);
  assert.match(reports, /reports\/\$\{reportId\}/);
  assert.doesNotMatch(reports, /attachment\.name/);
});

test("screenshots are private, bounded, and cleaned up after a failed insert", () => {
  assert.match(reports, /public: false/);
  assert.match(reports, /GARDEN_REPORT_MAX_ATTACHMENT_BYTES = 2_500_000/);
  assert.match(reports, /allowedMimeTypes/);
  assert.match(reports, /\.remove\(\[attachmentPath\]\)/);
  assert.match(reporter, /basil-screenshot\.\$\{extension\}/);
});

test("the migration preserves RLS and enforces anonymous identity separation", () => {
  assert.match(migration, /alter column steward_id drop not null/i);
  assert.match(migration, /garden_feedback_identity_check/i);
  assert.match(migration, /submission_kind in \('anonymous_bug', 'anonymous_idea'\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(
    migration,
    /revoke all on table public\.garden_feedback from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.garden_feedback to service_role/i,
  );
  assert.match(migration, /claim_garden_feedback_report_slot/i);
  assert.match(migration, /submission_count < 10/i);
  assert.match(migration, /window_start < now\(\) - interval '48 hours'/i);
});
