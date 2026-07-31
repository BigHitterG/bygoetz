import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDailyStoryDrafts,
  parseSocialStats,
  SOCIAL_CHANNELS,
} from "../lib/communityGarden/socialContent.ts";

const date = new Date("2026-07-30T15:00:00.000Z");
const stats = parseSocialStats({
  measuredAt: date.toISOString(),
  communityFlowers: 42,
  roses: 21,
  gardenMembers: 7,
  livingGardenDiscoveries: 3,
});

test("daily social drafts prioritize recent matching product work", () => {
  const drafts = buildDailyStoryDrafts(date, [{
    sha: "a".repeat(40),
    title: "Give Living Garden visitors unique artwork",
    url: "https://github.com/BigHitterG/bygoetz/commit/example",
    committedAt: date.toISOString(),
  }], stats, 3);
  assert.equal(drafts.length, 3);
  assert.ok(drafts.some((draft) => draft.key === "living-garden" || draft.key === "goldfinch-field-guide"));
  assert.ok(drafts.some((draft) => draft.sourceType === "repository"));
});

test("every story is a complete vertical-first cross-channel packet", () => {
  const drafts = buildDailyStoryDrafts(date, [], stats, 5);
  assert.equal(drafts.length, 5);
  for (const draft of drafts) {
    assert.equal(draft.reelPlan.shots.length, 3);
    assert.ok(draft.reelPlan.targetSeconds >= 10 && draft.reelPlan.targetSeconds <= 30);
    assert.match(draft.reelPlan.fallbackVisual, /diagram|explainer/i);
    assert.deepEqual(new Set(draft.variants.map((variant) => variant.channel)), new Set(SOCIAL_CHANNELS));
    assert.match(draft.assetUrl, /^\/community-garden\/social-captures\//);
    assert.ok(["transformation-timelapse", "narrated-gameplay", "companion-post"].includes(draft.creativeBrief.family));
  }
});

test("Social Studio migration keeps drafts private and approvals explicit", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730184500_basil_social_studio.sql", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../app/community-garden/social-studio/SocialStudio.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../lib/communityGarden/socialStudio.ts", import.meta.url), "utf8");
  const cron = readFileSync(new URL("../app/api/cron/basil-social/route.ts", import.meta.url), "utf8");
  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /revoke all on table public\.basil_social_variants from public, anon, authenticated/i);
  assert.match(migration, /approval_token_hash/);
  assert.match(studio, /Opening the Studio never publishes/i);
  assert.match(studio, /window\.confirm/);
  assert.match(studio, /Download \{story\.assetKind\}/);
  assert.match(studio, /production plan, not a finished video/i);
  assert.match(studio, /loading="eager"/);
  assert.match(server, /resendLatestSocialDigest/);
  assert.match(server, /basil-social-resend-/);
  assert.match(server, /previousToken/);
  assert.match(cron, /Bearer \$\{secret\}/);
  const videoMigration = readFileSync(new URL("../supabase/migrations/20260731143000_basil_social_video_packages.sql", import.meta.url), "utf8");
  assert.match(videoMigration, /basil-social-assets/);
  assert.match(videoMigration, /public\.basil_social_feedback/);
  assert.match(studio, /Approve today&apos;s 3 posts/);
  assert.match(server, /\.in\("channel", \["youtube", "instagram", "reddit"\]\)/);
  assert.match(server, /\.in\("status", \["draft", "failed"\]\)/);
  assert.doesNotMatch(server, /\.in\("status", \["draft", "failed", "rejected"\]\)/);
  assert.match(studio, /Request revision/);
});

test("Vercel keeps two cron jobs while adding the daily social run", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.equal(config.crons.length, 2);
  assert.ok(config.crons.some((cron) => cron.path === "/api/cron/basil-social" && cron.schedule === "0 11 * * *"));
});

test("video packages derive captions from narration and replay real watering effects", () => {
  const renderer = readFileSync(new URL("../scripts/basil-render-social-video.mjs", import.meta.url), "utf8");
  const narrator = readFileSync(new URL("../scripts/basil-edge-tts.py", import.meta.url), "utf8");
  const piano = readFileSync(new URL("../scripts/basil-generate-piano.py", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../app/community-garden/social-capture/SocialCaptureScene.tsx", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  assert.match(renderer, /basil-edge-tts\.py/);
  assert.match(narrator, /boundary="WordBoundary"/);
  assert.match(renderer, /basil-generate-piano\.py/);
  assert.match(renderer, /amix=inputs=2/);
  assert.match(renderer, /backgroundMusicProvider/);
  assert.match(renderer, /implementedScenes/);
  assert.match(renderer, /truth claim must be explicitly supported/i);
  assert.match(piano, /Cmaj7, Am7, Fmaj7, G6/);
  assert.match(renderer, /setCaptionCues/);
  assert.match(renderer, /refusing to render an unsynchronized package/);
  assert.match(renderer, /BASIL_CAPTION_TIMINGS/);
  assert.doesNotMatch(renderer, /text2wav/);
  assert.doesNotMatch(packageJson, /@echristian\/edge-tts/);
  assert.doesNotMatch(packageJson, /text2wav/);
  assert.match(scene, /kind: "spray"/);
  assert.match(scene, /kind: "water"/);
  assert.match(scene, /kind: "care"/);
  assert.match(scene, /activeWord/);
});

test("approved publishing queue is explicit and cannot include unapproved drafts", () => {
  const prepare = readFileSync(new URL("../scripts/basil-prepare-approved-posts.mjs", import.meta.url), "utf8");
  const record = readFileSync(new URL("../scripts/basil-mark-social-published.mjs", import.meta.url), "utf8");
  assert.match(prepare, /eq\("status", "manual_ready"\)/);
  assert.match(prepare, /approved_not_published/);
  assert.match(record, /Only an explicitly approved Social Studio variant/);
  assert.match(record, /eq\("status", "manual_ready"\)/);
});

test("one-time transfer capabilities preserve private storage without local service keys", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260731170000_basil_social_one_time_transfers.sql", import.meta.url), "utf8");
  const edge = readFileSync(new URL("../supabase/functions/basil-social-transfer/index.ts", import.meta.url), "utf8");
  const upload = readFileSync(new URL("../scripts/basil-upload-social-package.mjs", import.meta.url), "utf8");
  const prepare = readFileSync(new URL("../scripts/basil-prepare-approved-posts.mjs", import.meta.url), "utf8");
  assert.match(migration, /used_at is null/);
  assert.match(migration, /now\(\) \+ interval '15 minutes'/);
  assert.match(migration, /record_basil_social_publication/);
  assert.match(migration, /status = 'manual_ready'/);
  assert.match(edge, /claim_basil_social_transfer_token/);
  assert.match(edge, /allowedChannels = \["youtube", "instagram", "reddit"\]/);
  assert.match(edge, /validationStatus !== "valid"/);
  assert.match(upload, /--transfer-token/);
  assert.match(prepare, /--transfer-token/);
});

test("database approval guard limits bulk approval to the primary validated video", () => {
  const guard = readFileSync(new URL("../supabase/migrations/20260731180000_basil_social_approval_guard.sql", import.meta.url), "utf8");
  assert.match(guard, /old\.channel not in \('youtube', 'instagram', 'reddit'\)/);
  assert.match(guard, /story\.rank = 1/);
  assert.match(guard, /asset\.validation_status = 'valid'/);
  assert.match(guard, /return null/);
});
