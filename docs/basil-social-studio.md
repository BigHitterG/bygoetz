# Basil Social Studio

Basil Social Studio is an approval-first, vertical-content-first daily editorial workflow. It watches recent repository activity, combines it with aggregate garden statistics and a curated factual story library, creates one core video with three platform adaptations, and emails a private review link to `info@bygoetz.com` by default.

Opening the email link never publishes content. The final review token is carried in the URL fragment, removed from browser history immediately, and submitted only through same-origin POST requests. Supabase stores only a SHA-256 hash of the token.

## Daily workflow

1. Vercel calls `/api/cron/basil-social` at 11:00 UTC, which is 6:00 a.m. Chicago daylight time, to create the private daily digest and email link. The local Codex production task also begins at 6:00 a.m.; rendering takes long enough for the digest to exist before upload, and the task must retry the digest lookup briefly if the two jobs race.
2. The route reads the last fourteen days of GitHub commits and calls `get_basil_social_stats()` for aggregate, non-identifying garden totals.
3. `socialContent.ts` scores factual Basil story cards against recent work and selects one primary packet by default. The publishing queue takes at most three approved adaptations from its validated core video: YouTube Short, Instagram Reel, and a selective Reddit companion.
4. If `OPENAI_API_KEY` is configured, the selected drafts are refined through the Responses API using strict structured output. Failure falls back to the curated drafts rather than failing the daily run.
5. The digest, story, channel variants, evidence, vertical production brief, and private approval state are stored in Supabase. TikTok remains an individually reviewed future channel and is excluded from the three-post daily approval.
6. Resend sends one idempotent review email.
7. The reviewer edits, copies, approves, skips, and marks manually published variants in `/community-garden/social-studio`.

Each story separates the two deliverables clearly:

- **Ready image/video:** the actual file available through **Download image** or **Download video**.
- **Reel production brief:** a shot list for creating a future short. A brief is not presented as a finished video.

**Copy text** puts the headline, caption, and hashtags on the clipboard. It does not copy the media file; the adjacent download action supplies that upload-ready file.

The same cron also prepares the existing monthly Garden Letter when it is due. This keeps the project within the two-job Vercel Hobby limit.

## Vertical visual policy

Every story includes a 9:16 production brief with a hook, screen-record sequence, target duration, payoff, and fallback visual.

Visual preference order:

1. Actual Basil screen recording in a deterministic test garden.
2. Actual gameplay screenshot with motion, crops, labels, and captions.
3. A clearly labeled Basil-style explanatory diagram using real game assets where possible.
4. An AI-assisted illustration or diagram only when it clarifies something gameplay cannot show cleanly.

Generated explanatory imagery must never be described as gameplay. The daily starter assets are actual mobile gameplay captures supplied for Basil.

## Required configuration

- Apply `supabase/migrations/20260730184500_basil_social_studio.sql`.
- Configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Configure `RESEND_API_KEY` and verify the domain used in `BASIL_SOCIAL_FROM`.
- Configure `CRON_SECRET` in production.
- Keep `BASIL_SOCIAL_REVIEW_EMAILS=info@bygoetz.com`, or provide a comma-separated private reviewer list.

GitHub ingestion works against the public `BigHitterG/bygoetz` repository without authentication. Configure `GITHUB_TOKEN` for private access or higher API limits.

OpenAI API refinement is optional. Without it, the server workflow remains usable with its curated editorial library. A Codex scheduled task is the no-separate-API path for genuinely new daily creative decisions: Codex reads the brief and data in the repository, writes `content/basil-social/today.json`, runs the local renderer, validates the files, uploads the package, and then invokes the existing email/review flow.

## Phase 1 video package

Phase 1 now has a deterministic vertical capture route at `/community-garden/social-capture`. It calls Basil's real `renderGarden` function directly on a 1080x1920 canvas. Browser chrome, scroll position, live-account state, and responsive page crops are not part of the source frame.

Implementation status is intentionally strict:

- Complete: clean 1080x1920 capture surface, real renderer footage, local H.264/AAC MP4, poster, calm neural narration, word-boundary captions, quiet original piano, private Supabase delivery, phone playback, Approve All, and revision feedback.
- Executable today: `water-chain`. The renderer rejects any manifest that names a scene not actually implemented, so it cannot silently substitute unrelated footage.
- Still to build: `my-garden-transformation`, `shared-garden-day-change`, `plant-first-flower`, `weed-cleanup`, `habitat-discovery`, `heritage-flower-reveal`, `garden-before-after`, and `two-design-choices`, plus multi-opening re-edits and automated gameplay checkpoint analysis for those scenes.
- Assisted, not API-autonomous: browser posting to YouTube, Instagram, and Reddit after approval. OAuth platform adapters and automatic performance ingestion are not implemented.

The first two content families are:

1. **Transformation timelapse** — the default performance format. Begin on a readable before-state, accelerate planting/building, hold the completed garden, and end on one concrete invitation.
2. **Narrated gameplay** — the Minecraft-parkour analogue for Basil. Mary performs a continuous, recognizable game task while an original, fact-checked plant story, farm fable, garden history, or founder observation provides the curiosity loop. The current deterministic recipe walks a lush garden, selects flowers, sprays the real watering effect, updates watered state, and awards the real Care effect without touching a production garden.

The daily creative contract lives in `content/basil-social/today.json`. It contains the objective, format, executable scene, hook, narration, audience, hypothesis, alternative openings, truth claims and their basis, platform list, tracked destination, target duration, and CTA. `content/basil-social/channel-memory.json` is the durable cross-run channel memory: it stores read-only platform baselines, the founder's observed Reddit language, experiment notes, and comparable result windows. Caption timings are not hand-authored there. Narration is generated first, exact word boundaries are returned with that audio, and only then are the frames captured. The capture recipe remains deterministic; Codex changes the creative brief rather than editing the renderer each morning.

Render the current brief locally:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-social.txt
$env:CI='true'
pnpm run social:render-sample
```

The renderer produces these files in `artifacts/basil-social-studio/`:

- a 1080x1920 H.264/AAC MP4 with fast-start metadata;
- a 1080x1920 JPEG poster;
- a neural MP3 narration track;
- narration-derived word and phrase timing JSON;
- an original locally generated relaxing piano bed, mixed quietly beneath narration;
- a structured JSON manifest;
- a decode-validation result before the package is accepted.

The prototype narration provider uses the maintained Python `edge-tts` client with a calm Microsoft Edge neural voice and does not require an OpenAI API key. It is an online dependency, so a machine rendering the package needs network access. Basil never falls back to the old robotic local voice: a failed neural generation fails the package instead. The client requests `WordBoundary` metadata from the same stream that writes the MP3, so captions track the spoken audio. `BASIL_SOCIAL_TTS_VOICE`, `BASIL_SOCIAL_TTS_RATE`, `BASIL_SOCIAL_TTS_PITCH`, and `BASIL_SOCIAL_TTS_VOLUME` tune the prototype voice.

The renderer also creates a deterministic, original Cmaj7–Am7–Fmaj7–G6 piano bed locally and mixes it at a low level under the narration. It does not download or reuse a copyrighted song. Set `BASIL_BACKGROUND_MUSIC` to a licensed local audio file when a different track is preferred; narration remains the dominant channel.

A preferred founder recording or licensed voice can replace the prototype by setting `BASIL_NARRATION_AUDIO`. The matching narration-derived timing JSON is mandatory in `BASIL_CAPTION_TIMINGS`; supplying audio without timing fails validation. This keeps captions aligned even when the voice, pacing, or provider changes. ElevenLabs can later use its text-to-speech-with-timestamps response to satisfy the same contract without changing the video renderer.

## Private storage and phone review

Migration `20260731143000_basil_social_video_packages.sql` creates the private `basil-social-assets` bucket, `basil_social_assets`, and `basil_social_feedback`. Migration `20260731170000_basil_social_one_time_transfers.sql` adds 15-minute, single-use upload/download capabilities and a publication-recording function. Migration `20260731180000_basil_social_approval_guard.sql` enforces that only the rank-1 validated video's YouTube, Instagram, and Reddit variants can enter `manual_ready`, even if an older client attempts a broader bulk update. All three have been applied to the `bygoetz` Supabase project, and the `basil-social-transfer` Edge Function is deployed.

The bucket is private and capped at 100 MB per object. Metadata and feedback tables have RLS enabled; `public`, `anon`, and `authenticated` have no grants. After the existing digest token is verified, the server creates one-hour signed URLs for the MP4 and poster. The phone receives only the deployed Studio link from the email, so video playback, Approve All, individual approvals, and revision requests work without remote-desktop access to the computer.

The computer does not need a local Supabase service-role key. The scheduled Codex task uses the connected Supabase tool to mint a short-lived one-time capability, then passes it to the upload script:

```powershell
pnpm social:upload-package -- --story-id=<story-uuid> --transfer-token=<one-time-token>
```

The upload is transactional at the asset level: if metadata insertion fails, the newly uploaded object is removed. Supabase stores only the token hash, consumes the token once, and keeps the service-role key inside the Edge Function. The same model downloads an approved package at 8:00 a.m.; a draft cannot be downloaded by the publishing queue.

## Scheduled Codex handoff

The repository side of both scheduled tasks is ready. The final schedules are created in the desktop app's **Scheduled** view; Codex CLI does not provide that management UI. Both tasks must use this checkout in local-project mode, not an isolated worktree, because the render and the 8:00 a.m. publishing handoff share local artifacts.

Create a daily 6:00 a.m. Chicago-time task with this prompt:

> Work in the Basil repository. Read `docs/basil-social-studio.md`, `content/basil-social/channel-memory.json`, queued revision feedback, the latest aggregate Social Studio metrics, recent Basil repository changes, and `content/basil-social/today.json`. Use the signed-in in-app Browser read-only to inspect recent Instagram, YouTube Studio, and Reddit results; never like, comment, edit, upload, or publish during this task. Update `channel-memory.json` with comparable 1-hour, 24-hour, or 7-day observations when available, clearly distinguishing missing data from zero. Read recent posts and comments by `u/bygoetz` to preserve the founder's direct, conversational language without copying a previous post. Make one original core video concept and three channel adaptations for YouTube Shorts, Instagram Reels, and a selective Reddit companion. Until another deterministic scene is implemented, use only `scene: "water-chain"`; never label unsupported footage as another action. Update every production-manifest field and support every truth claim with Basil source evidence or a reliable source. Do not use an OpenAI API key. Run `pnpm test:social-studio`, render with `pnpm social:render-sample`, and require the validated 1080x1920 H.264/AAC MP4 and poster. Through the connected Supabase tool, find today's newest digest and its rank-1 story; retry briefly if the 6:00 a.m. Vercel digest is still starting. Call `public.issue_basil_social_transfer_token(story_id, 'upload')`, then run `pnpm social:upload-package -- --story-id=<story-id> --transfer-token=<returned-token>`. Do not approve or publish. Confirm that the private Studio package is ready and report any failure plainly.

Create a second daily 8:00 a.m. Chicago-time task with this prompt:

> Work in the Basil repository. Through the connected Supabase tool, find today's newest rank-1 story with a validated video and `manual_ready` variants among YouTube, Instagram, and Reddit. If none exist, do nothing externally and report "awaiting approval." Call `public.issue_basil_social_transfer_token(story_id, 'download')`, then run `pnpm social:prepare-approved -- --story-id=<story-id> --transfer-token=<returned-token> --run-key=<daily-run-key>`. Read its JSON and publish no more than the entries it contains, using the downloaded validated video and exact saved copy. Use the existing signed-in in-app Browser sessions for `basilcommunitygarden` on Instagram, the `Basil` YouTube channel, and `u/bygoetz` on Reddit. Never post outside `r/BasilCommunity` unless that day's approved Reddit copy explicitly names the subreddit. Immediately before each platform's final Publish/Post action, request the user's confirmation because it is an external communication. After each confirmed successful post, capture the public HTTPS URL and call `public.record_basil_social_publication(<variant-id>, <public-https-url>, null)` through the connected Supabase tool. If a platform asks for a login, challenge, account choice, permission, or materially different field, stop that channel without guessing. Never publish a draft, rejected, expired, or unapproved variant.

The desktop must be signed in to Codex, awake, and running with access to this checkout for both local tasks. The phone workflow is email -> private deployed Studio -> Watch / Edit / Approve All / Request revision. Approval is stored in Supabase, so the 8:00 a.m. computer task can see it without the phone connecting to the local machine. Scheduled run notifications are available in the desktop/web **Scheduled** inbox; phone delivery should rely on the email and Studio link rather than assuming a Codex mobile task inbox.

The protected route still supports `prepare`, `notify`, and normal scheduled modes for server-side use. The no-extra-API Codex workflow uses connected Supabase capabilities instead, so no production secret needs to be copied onto the computer. If the email is opened during the few minutes while rendering is still finishing, refreshing the same Studio link reveals the uploaded video.

## Social API connection boundary

The current release intentionally stops at manual approval and copy-ready content. Connector environment variables are reserved in `.env.example`, and the Studio reports whether each platform is manual or ready for an OAuth hookup.

API credentials are not required for assisted posting. When the creator is signed into YouTube, Instagram, and Reddit in Chrome, the 8:00 a.m. Codex task can use the approved queue and downloaded asset through each platform's normal interface. This is less robust than official APIs: login challenges, UI changes, upload processing, or account selectors can stop a run. APIs remain the better option for fully unattended schedules, metric collection, and high-volume publishing.

When a platform adapter is added, keep these invariants:

- An approval action is distinct from opening the review URL.
- Publishing uses a channel-specific idempotency key derived from the variant UUID.
- OAuth refresh tokens remain encrypted and server-only.
- A provider response is stored as a normalized external ID and public URL, not as an unrestricted raw payload.
- Reddit communities outside `r/basilcommunity` remain manual and individually reviewed.
- YouTube, Instagram, and TikTok initially upload privately or as drafts until the relevant app review/audit is complete.

## Data model

- `basil_social_digests`: daily run, source snapshot, email delivery, and token-hash state.
- `basil_social_stories`: factual story, evidence, source, asset, and editorial rank.
- `basil_social_variants`: editable channel copy and manual approval/publication status.
- `basil_social_metrics`: normalized 1-hour, 24-hour, and 7-day performance snapshots for future learning.

All four tables have RLS enabled and are inaccessible to `public`, `anon`, and `authenticated`. Only server-side service-role code can access them.

## Adding a capture recipe

The next capture layer should create deterministic scene recipes instead of recording production accounts. Each recipe should specify:

- route and seeded test account;
- viewport `1080x1920`;
- initial Mary position and camera zoom;
- exact taps or movement path;
- expected visual checkpoint;
- safe fixture reset;
- output still and video names.

The renderer should fail the story asset step when the expected checkpoint is absent. That prevents an outdated or broken feature from becoming a misleading social post.
