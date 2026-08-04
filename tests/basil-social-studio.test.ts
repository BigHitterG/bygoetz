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

test("daily social drafts always produce the three factual bulletin lanes", () => {
  const drafts = buildDailyStoryDrafts(date, [{
    sha: "a".repeat(40),
    title: "Improve My Garden builder layout preview",
    url: "https://github.com/BigHitterG/bygoetz/commit/example",
    committedAt: date.toISOString(),
  }], stats, 3);
  assert.equal(drafts.length, 3);
  assert.deepEqual(drafts.map((draft) => draft.creativeBrief.bulletinType), ["garden_discovery", "how_it_works", "garden_diagram"]);
  assert.ok(drafts.some((draft) => draft.sourceType === "repository"));
});

test("the daily package contains two cross-channel videos and one Instagram/Reddit diagram", () => {
  const drafts = buildDailyStoryDrafts(date, [], stats, 5);
  assert.equal(drafts.length, 3);
  for (const draft of drafts.slice(0, 2)) {
    assert.equal(draft.reelPlan.shots.length, 3);
    assert.ok(draft.reelPlan.targetSeconds >= 10 && draft.reelPlan.targetSeconds <= 30);
    assert.match(draft.reelPlan.fallbackVisual, /diagram|explainer/i);
    assert.deepEqual(new Set(draft.variants.map((variant) => variant.channel)), new Set(SOCIAL_CHANNELS));
    assert.match(draft.assetUrl, /^\/community-garden\/social-captures\//);
    assert.equal(draft.creativeBrief.family, "basil-bulletin");
  }
  const diagram = drafts[2];
  assert.equal(diagram.assetKind, "image");
  assert.equal(diagram.creativeBrief.videoFormat, "diagram_explainer");
  assert.equal(diagram.creativeBrief.scene, "community-grid-diagram");
  assert.deepEqual(new Set(diagram.variants.map((variant) => variant.channel)), new Set(["instagram", "reddit"]));
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
  assert.match(studio, /downloadUrl/);
  assert.match(server, /createSignedUrl\(asset\.object_path, 60 \* 60, \{ download: filename \}\)/);
  assert.match(server, /supplementalDownload/);
  assert.match(studio, /finished, game-accurate 4:5 image/i);
  assert.match(studio, /loading="eager"/);
  assert.match(server, /resendLatestSocialDigest/);
  assert.match(server, /basil-social-resend-/);
  assert.match(server, /previousToken/);
  assert.match(cron, /Bearer \$\{secret\}/);
  const videoMigration = readFileSync(new URL("../supabase/migrations/20260731143000_basil_social_video_packages.sql", import.meta.url), "utf8");
  assert.match(videoMigration, /basil-social-assets/);
  assert.match(videoMigration, /public\.basil_social_feedback/);
  assert.match(studio, /Approve video \+ 3 posts/);
  assert.match(studio, /Approve diagram \+ 2 posts/);
  assert.match(server, /approve_basil_social_story/);
  assert.match(studio, /Save feedback for the next run/);
});

test("Vercel keeps two cron jobs while adding the daily social run", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.equal(config.crons.length, 2);
  assert.ok(config.crons.some((cron) => cron.path === "/api/cron/basil-social" && cron.schedule === "55 10 * * *"));
});

test("video packages derive captions from narration and replay real watering effects", () => {
  const renderer = readFileSync(new URL("../scripts/basil-render-social-video.mjs", import.meta.url), "utf8");
  const narrator = readFileSync(new URL("../scripts/basil-edge-tts.py", import.meta.url), "utf8");
  const music = readFileSync(new URL("../scripts/basil-generate-garden-loop.py", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../app/community-garden/social-capture/SocialCaptureScene.tsx", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  assert.match(renderer, /basil-edge-tts\.py/);
  assert.match(narrator, /boundary="WordBoundary"/);
  assert.match(narrator, /en-US-JennyNeural/);
  assert.match(renderer, /basil-generate-garden-loop\.py/);
  assert.match(renderer, /amix=inputs=2/);
  assert.match(renderer, /backgroundMusicProvider/);
  assert.match(renderer, /implementedScenes/);
  assert.match(renderer, /truth claim must be explicitly supported/i);
  assert.match(music, /BPM = 112\.0/);
  assert.match(music, /Original four-bar garden loop/);
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

test("mixed-media review adds two video scenes, a deterministic diagram, and per-story approval", () => {
  const renderer = readFileSync(new URL("../scripts/basil-render-social-video.mjs", import.meta.url), "utf8");
  const diagramRenderer = readFileSync(new URL("../scripts/basil-render-social-diagram.mjs", import.meta.url), "utf8");
  const diagramScene = readFileSync(new URL("../app/community-garden/social-diagram/SocialDiagramScene.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../app/community-garden/social-capture/SocialCaptureScene.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../app/community-garden/social-studio/SocialStudio.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../lib/communityGarden/socialStudio.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260803194823_basil_social_mixed_media_packages.sql", import.meta.url), "utf8");
  assert.match(renderer, /--recipe/);
  assert.match(renderer, /garden-status/);
  assert.match(renderer, /watering-how-to/);
  assert.match(renderer, /rose-life-cycle/);
  assert.match(renderer, /stage_word_only/);
  assert.match(renderer, /exactly four single-word stage labels/);
  assert.match(diagramRenderer, /community-grid-diagram/);
  assert.match(diagramRenderer, /1080x1350 PNG delivery contract/);
  assert.match(diagramScene, /renderGarden/);
  assert.match(diagramScene, /gridToWorld/);
  assert.match(diagramScene, /loadSnapshot/);
  assert.match(diagramRenderer, /basilcommunitygarden\.com\/api\/community-garden\/snapshot/);
  assert.match(diagramScene, /LIVE COMMUNITY GARDEN/);
  assert.match(diagramScene, /WHERE WOULD YOU PLANT NEXT/);
  assert.match(scene, /kind: "plant"/);
  assert.match(scene, /kind: "water"/);
  assert.match(scene, /Today's shared garden/);
  assert.match(scene, /My Garden builder mode/);
  assert.match(scene, /Dormant seed/);
  assert.match(scene, /orthogonally neighboring cell/);
  assert.match(studio, /const CHANNEL_ORDER: Channel\[\] = \["instagram", "youtube", "reddit"\]/);
  assert.match(studio, /Save daily feedback/);
  assert.match(studio, /Approve video \+ 3 posts/);
  assert.match(studio, /Approve diagram \+ 2 posts/);
  assert.match(server, /approveSocialStory/);
  assert.match(migration, /approve_basil_social_story/);
  assert.match(migration, /story\.rank between 1 and 3/);
  assert.match(migration, /asset\.kind = 'poster'/);
  assert.match(migration, /asset\.kind = 'image'/);
  assert.match(migration, /array\['instagram', 'reddit'\]/);
  assert.match(migration, /grant execute.*service_role/i);
});

test("Task 1 excludes the ten most recently published topics before choosing new subjects", () => {
  const runbook = readFileSync(new URL("../docs/basil-social-scheduled-tasks.md", import.meta.url), "utf8");
  assert.match(runbook, /10 most recently published distinct stories/i);
  assert.match(runbook, /Reject a candidate that substantially repeats/i);
  assert.match(runbook, /supplemental download-only replay/i);
});

test("botanical lifecycle pipeline is species-driven, locked-camera, and biologically ordered", () => {
  const planner = readFileSync(new URL("../scripts/basil-plan-botanical-lifecycle.mjs", import.meta.url), "utf8");
  const renderer = readFileSync(new URL("../scripts/basil-render-botanical-lifecycle.mjs", import.meta.url), "utf8");
  const profile = JSON.parse(readFileSync(new URL("../content/basil-social/botanical-species/rose.json", import.meta.url), "utf8"));
  const recipe = JSON.parse(readFileSync(new URL("../content/basil-social/today-2.json", import.meta.url), "utf8"));
  assert.equal(profile.template, "flowering-plant-v1");
  assert.equal(profile.stages.length, 11);
  assert.equal(profile.stages.at(-1).endSeconds, 24);
  assert.ok(profile.stages.findIndex((stage: { id: string }) => stage.id === "pollination") < profile.stages.findIndex((stage: { id: string }) => stage.id === "petals-fall"));
  assert.ok(profile.stages.findIndex((stage: { id: string }) => stage.id === "petals-fall") < profile.stages.findIndex((stage: { id: string }) => stage.id === "fruit-and-seed"));
  assert.ok(profile.stages.findIndex((stage: { id: string }) => stage.id === "fruit-and-seed") < profile.stages.findIndex((stage: { id: string }) => stage.id === "plant-death"));
  assert.equal(recipe.scene, "botanical-lifecycle");
  assert.equal(recipe.audioMode, "silent");
  assert.equal(recipe.narration, undefined);
  assert.match(planner, /--species/);
  assert.match(planner, /identical camera, lens, framing/);
  assert.match(renderer, /local-aligned-keyframe-blend-v1/);
  assert.match(renderer, /blend=all_expr/);
  assert.match(renderer, /pollination before petal fall and fruit development afterward/);
  assert.match(renderer, /voiceProvider: "none"/);
  assert.match(renderer, /VIVALDII\.TTF/);
  assert.match(renderer, /backgroundMusicProvider: "none"/);
  assert.doesNotMatch(renderer, /basil-generate-garden-loop\.py/);
});
test("evergreen archive preserves lifecycle sources and only finished reusable social assets", () => {
  const archive = JSON.parse(readFileSync(new URL("../content/basil-social/evergreen-archive.json", import.meta.url), "utf8"));
  const uploader = readFileSync(new URL("../scripts/basil-archive-evergreen-assets.mjs", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260804145541_basil_social_evergreen_archive.sql", import.meta.url), "utf8");
  const runbook = readFileSync(new URL("../docs/basil-social-scheduled-tasks.md", import.meta.url), "utf8");
  const rose = archive.collections.find((entry: { collectionKey: string }) => entry.collectionKey === "botanical/rose-v1");
  const sunflower = archive.collections.find((entry: { collectionKey: string }) => entry.collectionKey === "botanical/sunflower-v1");
  const diagram = archive.collections.find((entry: { collectionType: string }) => entry.collectionType === "diagram");
  const mechanic = archive.collections.find((entry: { collectionType: string }) => entry.collectionType === "game_mechanic");
  assert.ok(rose?.lifecycleProfile);
  assert.ok(sunflower?.lifecycleProfile);
  assert.ok(rose.assets.some((asset: { assetRole: string }) => asset.assetRole === "alternate_keyframe"));
  assert.ok(diagram.assets.some((asset: { assetRole: string }) => asset.assetRole === "diagram"));
  assert.deepEqual(new Set(mechanic.assets.map((asset: { assetRole: string }) => asset.assetRole)), new Set(["final_video", "poster", "caption_timing", "production_manifest"]));
  assert.match(uploader, /profile\.stages\.map/);
  assert.match(uploader, /basil-social-evergreen-transfer/);
  assert.match(migration, /'basil-social-evergreen'[\s\S]*false/);
  assert.match(migration, /enable row level security/g);
  assert.match(runbook, /Preserve every reusable finished package/);
});

test("notification capability sends the review email only after the video upload", () => {
  const notifyMigration = readFileSync(new URL("../supabase/migrations/20260731190000_basil_social_notify_capability.sql", import.meta.url), "utf8");
  const cron = readFileSync(new URL("../app/api/cron/basil-social/route.ts", import.meta.url), "utf8");
  const studioServer = readFileSync(new URL("../lib/communityGarden/socialStudio.ts", import.meta.url), "utf8");
  assert.match(notifyMigration, /'upload', 'download', 'notify'/);
  assert.match(cron, /createDailySocialDigest\(now, \{ sendEmail: false \}\)/);
  assert.match(cron, /x-basil-transfer-token/);
  assert.match(studioServer, /p_purpose: "notify"/);
  assert.match(studioServer, /invalid, expired, or already used/i);
  assert.match(studioServer, /capability-notify-\$\{story\.digest_id\}-\$\{tokenHash\(token\)\.slice\(0, 24\)\}/);
});

test("private trial asset cleanup is story-scoped and one-time", () => {
  const transferFunction = readFileSync(
    new URL("../supabase/functions/basil-social-transfer/index.ts", import.meta.url),
    "utf8",
  );
  const cleanupMigration = readFileSync(
    new URL("../supabase/migrations/20260801213000_basil_social_cleanup_capability.sql", import.meta.url),
    "utf8",
  );
  assert.match(transferFunction, /request\.method === "DELETE"/);
  assert.match(transferFunction, /\.eq\("story_id", storyId\)/);
  assert.match(transferFunction, /supabase\.storage\.from\(bucket\)\.remove\(paths\)/);
  assert.match(cleanupMigration, /'cleanup'/);
  assert.match(cleanupMigration, /grant execute[\s\S]*to service_role/);
});

