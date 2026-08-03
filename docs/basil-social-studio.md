# Basil Social Studio

Basil Social Studio is an approval-first, vertical-content-first daily editorial workflow centered on Wren, Basil's transparent AI-directed garden steward. It combines real action provenance, product truth, creator feedback, platform observations, and Basil's field guide into three distinct daily videos. Each video receives Instagram, YouTube, and Reddit adaptations before a private review link is emailed to `info@bygoetz.com`.

Opening the email link never publishes content. The final review token is carried in the URL fragment, removed from browser history immediately, and submitted only through same-origin POST requests. Supabase stores only a SHA-256 hash of the token.

## Daily workflow

1. Vercel calls `/api/cron/basil-social` at 10:55 UTC, which is 5:55 a.m. Chicago daylight time, to create the private daily digest without emailing. The local Codex production task begins at 6:45 a.m., renders and uploads the validated package, and then consumes a one-time `notify` capability to send the private review email.
2. The route reads the last fourteen days of GitHub commits and calls `get_basil_social_stats()` for aggregate, non-identifying garden totals.
3. `socialContent.ts` creates three safe Wren starter packets. The 6:45 a.m. scheduled Codex planner replaces them with fresh, evidence-backed packages selected against Wren's recent missions, real action traces, feedback, topic history, hook history, layout history, and available results. The default lanes are Agent diary, Field footage, and Experiment/discovery; a materially changed Garden status or founder-context story may replace one.
4. No OpenAI API key or paid text-generation API is required. Scheduled Codex is the active creative planner. A future live model adapter is present but disabled; enabling it later does not grant direct game, database, or publishing authority.
5. The digest, story, three channel variants, evidence, vertical production brief, and private approval state are stored in Supabase. TikTok is not part of the current daily workflow.
6. Resend sends one idempotent review email.
7. The reviewer edits copy, approves each video-and-three-post package from the top of its card, requests revisions, and records manually published variants in `/community-garden/social-studio`.

Each story separates the two deliverables clearly:

- **Ready image/video:** the actual file available through **Download image** or **Download video**.
- **Video manifest:** the objective, visible scene, audience, hypothesis, truth checks, and alternate hooks for the finished video shown directly beside it.

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

### Cover and thumbnail policy

Each approved video may also receive an original portrait marketing cover. The cover is intentionally separate from the validated gameplay poster: the poster proves what the video contains, while the cover makes the subject legible at small phone sizes. Covers use one clear focal point, roughly three to six large high-contrast words, and a center-safe composition. Mary and Basil's duck may appear when they fit the demonstrated subject. Generated art must match the approved video's promise, remain recognizably Basil, avoid third-party characters and logos, and never be labeled as gameplay.

Instagram's desktop Reel composer accepts a cover image, so Task 2 uses the generated cover and falls back to the validated poster only when generation or upload is unavailable. YouTube Studio desktop does not accept a separate custom thumbnail for Shorts; it tells creators to change the thumbnail in the YouTube mobile app. Task 2 therefore publishes the validated vertical Short with a complete title and description, preserves the generated cover as an optional mobile handoff, and never reports a desktop thumbnail upload that did not occur.

## Required configuration

- Apply `supabase/migrations/20260730184500_basil_social_studio.sql`.
- Configure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Configure `RESEND_API_KEY` and verify the domain used in `BASIL_SOCIAL_FROM`.
- Configure `CRON_SECRET` in production.
- Keep `BASIL_SOCIAL_REVIEW_EMAILS=info@bygoetz.com`, or provide a comma-separated private reviewer list.

GitHub ingestion works against the public `BigHitterG/bygoetz` repository without authentication. Configure `GITHUB_TOKEN` for private access or higher API limits.

Scheduled Codex is the current path for genuinely new daily creative decisions: it reads Wren's persistent records and the creative brief, writes `content/basil-social/today.json` plus the second and third recipes, runs the local renderer, validates the files, uploads the package, and invokes the existing email/review flow. See `docs/basil-wren-agent.md` for the autonomy and future-connector boundary.

## Phase 1 video package

Phase 1 now has a clean vertical capture route at `/community-garden/social-capture`. With `captureMode=live_gameplay`, it mounts Basil's production `GardenCanvas` on a true 1080x1920 surface, uses Wren's permanent sprite, follows Wren with the gameplay camera, and loads the real garden state. Browser chrome, navigation, map UI, compass, the north marker, scroll position, and responsive desktop cropping are excluded from the source frame. The default low-compute path records the game canvas directly with the browser's `MediaRecorder`, retains that raw recording for alternate hooks, and performs one final H.264/AAC encode; deterministic frame capture remains a fallback. The default `captions_only` treatment removes permanent brand, fact-card, and AI-label boxes from the video itself so the garden remains clean; Wren's identity and provenance stay explicit in narration when relevant, platform copy, Studio, and the manifest. A validated `playbackSpeed` from 1x through 4x supports real-time walks or timelapse diaries while narration and word captions remain on their normal timeline.

Implementation status is intentionally strict:

- Complete: clean 1080x1920 capture surface, production GardenCanvas footage, Wren sprite and disclosure, controlled walking/camera/checkpoint hooks, local H.264/AAC MP4, poster, calm neural narration, word-boundary captions, quiet original garden-loop music, private Supabase delivery, phone playback, per-package approval, revision feedback, and per-story Instagram cover generation with poster fallback.
- Complete: private Wren profile, scheduled Tier-2 missions, allowlisted decisions, capped non-player Care budget, persistent My Garden, real action traces, before/after snapshots, draft diary continuity, public transparency page, and a disabled future external-planner adapter.
- Executable today: live walks through the real Community Garden, Wren field footage, status/diary/experiment narratives, and the existing deterministic recipe library as a clearly labeled fallback. The renderer rejects unsupported manifests rather than silently substituting unrelated footage.
- Next depth layer: replay individual completed My Garden actions through the production canvas with exact action timing, multi-opening re-edits from one trace, and automated visual checkpoint recognition for transformations.
- Assisted, not API-autonomous: browser posting to YouTube, Instagram, and Reddit after approval. OAuth platform adapters are not implemented. The normalized metric persistence hook is implemented, while the scheduled task still reads signed-in platform statistics through the browser.

The three default daily lanes are:

1. **Agent diary** — what Wren actually attempted, learned, finished, or could not finish, grounded in mission and action IDs.
2. **Field footage** — satisfying real gameplay with a strong visual opening; narration is optional when music and captions carry it better.
3. **Experiment or discovery** — a verified garden choice, mechanic, habitat, result, or current fact with a stated creative hypothesis.

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
- an original locally generated upbeat woodland-game loop, mixed quietly beneath narration;
- a structured JSON manifest;
- a decode-validation result before the package is accepted.

The prototype narration provider uses the maintained Python `edge-tts` client with a calm Microsoft Edge neural voice and does not require an OpenAI API key. It is an online dependency, so a machine rendering the package needs network access. Basil never falls back to the old unintelligible local synthesizer: a failed neural generation fails the package instead. The client requests `WordBoundary` metadata from the same stream that writes the MP3, so captions track the spoken audio. Every recipe carries a versioned `voiceProfile`; `BASIL_SOCIAL_TTS_VOICE`, `BASIL_SOCIAL_TTS_RATE`, `BASIL_SOCIAL_TTS_PITCH`, and `BASIL_SOCIAL_TTS_VOLUME` remain local overrides. The active `wren-clear-v1` profile intentionally keeps the current clear voice. A later `wren-robot-v1` experiment should begin with another intelligible neural voice and add only a subtle character treatment, then be A/B reviewed in Creator Studio before becoming Wren's default.

The renderer also creates a deterministic, original 112 BPM woodland-game loop locally and mixes it at a low level under the narration. Its motif and arrangement are original; it does not download, quote, or imitate a recognizable copyrighted melody. Set `BASIL_BACKGROUND_MUSIC` to a licensed local audio file when a different track is preferred; narration remains the dominant channel.

A preferred founder recording or licensed voice can replace the prototype by setting `BASIL_NARRATION_AUDIO`. The matching narration-derived timing JSON is mandatory in `BASIL_CAPTION_TIMINGS`; supplying audio without timing fails validation. This keeps captions aligned even when the voice, pacing, or provider changes. ElevenLabs can later use its text-to-speech-with-timestamps response to satisfy the same contract without changing the video renderer.

## Private storage and phone review

Migration `20260731143000_basil_social_video_packages.sql` creates the private asset and feedback records. Migration `20260731170000_basil_social_one_time_transfers.sql` adds 15-minute, single-use transfer capabilities. Migration `20260731180000_basil_social_approval_guard.sql` creates the database approval guard. Migration `20260731213853_basil_social_three_video_review.sql` extends that guard to three validated videos and permits whole-package feedback with a null `story_id`. Migration `20260801203117_basil_social_story_package_approval.sql` adds the service-role-only atomic approval function for one video, poster, and its three channel drafts. Unsupported channels and unvalidated assets remain blocked independently of the Studio client.

The bucket is private and capped at 100 MB per object. Metadata and feedback tables have RLS enabled; `public`, `anon`, and `authenticated` have no grants. After the existing digest token is verified, the server creates one-hour signed URLs for the MP4 and poster. The phone receives only the deployed Studio link from the email, so video playback, per-bulletin approval, and revision requests work without remote-desktop access to the computer.

The computer does not need a local Supabase service-role key. The scheduled Codex task uses the connected Supabase tool to mint a short-lived one-time capability, then passes it to the upload script:

```powershell
pnpm social:upload-package -- --story-id=<story-uuid> --transfer-token=<one-time-token>
```

The upload is transactional at the asset level: if metadata insertion fails, the newly uploaded object is removed. Supabase stores only the token hash, consumes the token once, and keeps the service-role key inside the Edge Function. The same model downloads an approved package at 8:00 a.m.; a draft cannot be downloaded by the publishing queue.

## Scheduled Codex handoff

The repository side of both scheduled tasks is ready. The final schedules are created in the desktop app's **Scheduled** view; Codex CLI does not provide that management UI. Both tasks must use this checkout in local-project mode, not an isolated worktree, because the render and the 8:00 a.m. publishing handoff share local artifacts.

Create a daily 6:45 a.m. Chicago-time task with this prompt:

> Use the complete 6:45 a.m. three-video creation prompt in `docs/basil-social-scheduled-tasks.md`. That runbook is the durable source of truth for repository paths, feedback consumption, bulletin selection, rendering, Supabase upload capabilities, validation, and review-email delivery.

Create a second daily 8:00 a.m. Chicago-time task with this prompt:

> Use the complete 8 a.m. approval-gated publishing prompt in `docs/basil-social-scheduled-tasks.md`. It evaluates each story independently, downloads only approved story packages, and preserves the final-action confirmation requirement for external publication.

The desktop must be signed in to Codex, awake, and running with access to this checkout for both local tasks. The phone workflow is email -> private deployed Studio -> Watch / Edit / Approve video + 3 posts / Request revision. Approval is stored in Supabase, so the 8:00 a.m. computer task can see it without the phone connecting to the local machine. Scheduled run notifications are available in the desktop/web **Scheduled** inbox; phone delivery should rely on the email and Studio link rather than assuming a Codex mobile task inbox.

The protected route still supports `prepare`, `notify`, and normal scheduled modes for server-side use. The no-extra-API Codex workflow uses connected Supabase capabilities instead, so no production secret needs to be copied onto the computer. Upload and email notification use separate one-time capabilities; the email is sent only after the finished private video is verified.

## Social API connection boundary

The current release intentionally stops at manual approval and copy-ready content. Connector environment variables are reserved in `.env.example`, and the Studio reports whether each platform is manual or ready for an OAuth hookup.

API credentials are not required for assisted posting. When the creator is signed into YouTube, Instagram, and Reddit in Chrome, the 8:00 a.m. Codex task can use the approved queue and downloaded asset through each platform's normal interface. This is less robust than official APIs: login challenges, UI changes, upload processing, or account selectors can stop a run. APIs remain the better option for fully unattended schedules, metric collection, and high-volume publishing.

When a platform adapter is added, keep these invariants:

- An approval action is distinct from opening the review URL.
- Publishing uses a channel-specific idempotency key derived from the variant UUID.
- OAuth refresh tokens remain encrypted and server-only.
- A provider response is stored as a normalized external ID and public URL, not as an unrestricted raw payload.
- Reddit communities outside `r/basilcommunity` remain manual and individually reviewed.
- YouTube and Instagram initially upload privately or as drafts until the relevant app review/audit is complete. Reddit remains manually reviewed per community.

## Data model

- `basil_social_digests`: daily run, source snapshot, email delivery, and token-hash state.
- `basil_social_stories`: factual story, evidence, source, asset, and editorial rank.
- `basil_social_variants`: editable channel copy and manual approval/publication status.
- `basil_social_metrics`: normalized 1-hour, 24-hour, and 7-day performance snapshots for future learning.
- `basil_agent_profiles`: Wren's private system identity, disclosure, appearance, autonomy tier, and active planner mode.
- `basil_agent_missions` and `basil_agent_decisions`: scheduled goals and ordered, policy-reviewed proposed actions.
- `basil_agent_action_traces`: replay-safe evidence for completed real actions and source provenance.
- `basil_agent_garden_snapshots`: persistent before/after My Garden state.
- `basil_agent_diary_entries`: evidence-backed continuity drafts linked to missions and source actions.
- `basil_agent_care_ledger`: idempotent daily non-player maintenance grants with an eight-Care hard cap.

All social and Wren runtime tables have RLS enabled and are inaccessible to `public`, `anon`, and `authenticated`. Only server-side service-role code can access them. The public Wren page exposes a deliberately reduced view assembled by server code; it does not open those tables to the Data API.

## Adding a capture recipe

New capture recipes should prefer the production `GardenCanvas` and a completed Wren action trace. Each recipe specifies:

- `captureMode=live_gameplay`, garden scope, and source action IDs;
- viewport `1080x1920`, Wren's initial position, camera zoom, and controlled walk path;
- expected action and visual checkpoints;
- whether the footage is live observation or a labeled deterministic replay;
- a safe retake that never repeats a production mutation;
- payoff hold, poster frame, caption-safe zones, and output names.

The renderer fails the asset when the manifest lacks Wren's disclosure, uses an unsupported scene, cannot prove an action claim, or misses its checkpoint. Generated scenes remain fallback illustrations and must never be called gameplay.
