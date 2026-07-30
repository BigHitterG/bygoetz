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
});

test("Vercel keeps two cron jobs while adding the daily social run", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.equal(config.crons.length, 2);
  assert.ok(config.crons.some((cron) => cron.path === "/api/cron/basil-social" && cron.schedule === "15 13 * * *"));
});
