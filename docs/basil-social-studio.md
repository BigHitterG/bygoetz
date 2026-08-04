# Basil Social Studio

Basil Social Studio is an approval-first daily editorial workflow. It combines product truth, creator feedback, platform observations, and Basil's field guide into two distinct daily videos plus one game-accurate diagram. The working repertoire includes narrated Basil mechanics/gameplay explainers, elegant silent botanical lifecycle videos, and live production-garden diagrams. Videos receive Instagram, YouTube, and Reddit adaptations; the static diagram receives Instagram and Reddit adaptations before a private review link is emailed to `info@bygoetz.com`.

Opening the email link never publishes content. The final review token is carried in the URL fragment, removed from browser history immediately, and submitted only through same-origin POST requests. Supabase stores only a SHA-256 hash of the token.

## Daily workflow

1. Vercel calls `/api/cron/basil-social` at 10:55 UTC, which is 5:55 a.m. Chicago daylight time, to create the private daily digest without emailing. The local Codex production task begins at 6:45 a.m., renders and uploads the validated package, and then consumes a one-time `notify` capability to send the private review email.
2. The route reads the last fourteen days of GitHub commits and calls `get_basil_social_stats()` for aggregate, non-identifying garden totals.
3. `socialContent.ts` creates exactly three factual bulletin packets: Visual payoff video, How Basil works video, and Live garden map. The current defaults use `builder-mode`, `watering-how-to`, and `community-grid-diagram`. Videos receive YouTube Short, Instagram Reel, and selective Reddit adaptations. The live map receives Instagram and Reddit image-post adaptations only.
4. If `OPENAI_API_KEY` is configured, the selected drafts are refined through the Responses API using strict structured output. Failure falls back to the curated drafts rather than failing the daily run.
5. The digest, story, three channel variants, evidence, vertical production brief, and private approval state are stored in Supabase. TikTok is not part of the current daily workflow.
6. Resend sends one idempotent review email.
7. The reviewer edits copy, approves each mixed-media package from the top of its card, requests revisions, and records published variants in `/community-garden/social-studio`.

Each story separates the two deliverables clearly:

- **Ready image/video:** the actual file available through **Download image** or **Download video**.
- **Download versus preview:** preview links stream private media in the browser. Download links use a separate, short-lived signed attachment URL with a clean filename so mobile and desktop browsers can save every current or future Studio asset to the device.
- **Video manifest:** the objective, visible scene, audience, hypothesis, truth checks, and alternate hooks for the finished video shown directly beside it.

**Copy text** puts the headline, caption, and hashtags on the clipboard. It does not copy the media file; the adjacent download action supplies that upload-ready file.

The same cron also prepares the existing monthly Garden Letter when it is due. This keeps the project within the two-job Vercel Hobby limit.

## Vertical visual policy

Every video includes a 9:16 production brief with a hook, deterministic gameplay sequence, target duration, payoff, and fallback visual. Every diagram includes a 4:5 concept brief, supported truth claims, and deterministic game-geometry requirements.

Visual preference order:

1. Actual Basil screen recording in a deterministic test garden.
2. Actual gameplay screenshot with motion, crops, labels, and captions.
3. A clearly labeled Basil explanatory diagram rendered from the real game renderer and integer grid coordinates.
4. An AI-assisted illustration only when it clarifies something gameplay cannot show cleanly and cannot be mistaken for game physics.

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

- Complete: clean 1080x1920 capture surface, real renderer footage, local H.264/AAC MP4, poster, calm neural narration, word-boundary captions, quiet original garden-loop music, private Supabase delivery, phone playback, per-bulletin approval, and revision feedback.
- Executable today: Basil-renderer video scenes `builder-mode`, `watering-how-to`, and `garden-status`; the generic `botanical-lifecycle` companion pipeline; and the 4:5 static `community-grid-diagram`. Builder paths obey the implemented orthogonal adjacency rule. The lifecycle pipeline loads a species profile from `content/basil-social/botanical-species/`, creates eleven locked-camera AI keyframes without burned-in text, joins adjacent stages with ten 1Ã¢â‚¬â€œ2 second aligned transitions, and adds only a high-end centered script stage name and approximate age range during local rendering. It is silent and has no narration, music, bulletin title, Basil label, footer, compass, box, or counter. Pollination must precede petal fall, fruit/seed development must follow it, and eventual plant death must remain distinct from seasonal fruiting for perennial species. The static route requires the current production garden snapshot and never falls back to a seeded promotional garden.
- Still to build: `my-garden-transformation`, `shared-garden-day-change`, `plant-first-flower`, `weed-cleanup`, `habitat-discovery`, `heritage-flower-reveal`, `garden-before-after`, and `two-design-choices`, plus multi-opening re-edits and automated gameplay checkpoint analysis for those scenes.
- Assisted, not API-autonomous: browser posting to YouTube, Instagram, and Reddit after approval. OAuth platform adapters and automatic performance ingestion are not implemented.

The three daily bulletin lanes are:

1. **Visual payoff** Ã¢â‚¬â€ a clear garden change or completed action, currently a Builder Mode empty-to-planned transformation.
2. **How Basil works** Ã¢â‚¬â€ one numbered input-to-result mechanic demonstration, beginning with the two-tap watering loop.
3. **Live garden map** Ã¢â‚¬â€ a saveable current view using the production community-garden coordinates, Mary, Basil's actual graphics, and a light annotation layer focused on real planting diversity.

The daily creative contract lives in `content/basil-social/today.json`. It contains the objective, format, executable scene, hook, narration, audience, hypothesis, alternative openings, truth claims and their basis, platform list, tracked destination, target duration, and CTA. `content/basil-social/channel-memory.json` is the durable cross-run channel memory: it stores read-only platform baselines, the founder's observed Reddit language, experiment notes, and comparable result windows. Caption timings are not hand-authored there. Narration is generated first, exact word boundaries are returned with that audio, and only then are the frames captured. The capture recipe remains deterministic; Codex changes the creative brief rather than editing the renderer each morning.

Render the current brief locally:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-social.txt
$env:CI='true'
pnpm run social:render-sample
pnpm run social:render-diagram -- --recipe=content/basil-social/today-3.json
```

The video renderer produces these files in `artifacts/basil-social-studio/`:

- a 1080x1920 H.264/AAC MP4 with fast-start metadata;
- a 1080x1920 JPEG poster;
- a neural MP3 narration track;
- narration-derived word and phrase timing JSON;
- an original locally generated upbeat woodland-game loop, mixed quietly beneath narration;
- a structured JSON manifest;
- a decode-validation result before the package is accepted.

The diagram renderer produces a validated 1080x1350 PNG and structured manifest. It calls Basil's real `renderGarden` function, places plants only on integer grid cells, and uses the production Mary and plant graphics. Generative imagery is not used to decide the diagram's geometry or physics.
The prototype narration provider uses the maintained Python `edge-tts` client with a calm Microsoft Edge neural voice and does not require an OpenAI API key. It is an online dependency, so a machine rendering the package needs network access. Basil never falls back to the old robotic local voice: a failed neural generation fails the package instead. The client requests `WordBoundary` metadata from the same stream that writes the MP3, so captions track the spoken audio. `BASIL_SOCIAL_TTS_VOICE`, `BASIL_SOCIAL_TTS_RATE`, `BASIL_SOCIAL_TTS_PITCH`, and `BASIL_SOCIAL_TTS_VOLUME` tune the prototype voice.

The renderer also creates a deterministic, original 112 BPM woodland-game loop locally and mixes it at a low level under the narration. Its motif and arrangement are original; it does not download, quote, or imitate a recognizable copyrighted melody. Set `BASIL_BACKGROUND_MUSIC` to a licensed local audio file when a different track is preferred; narration remains the dominant channel.

A preferred founder recording or licensed voice can replace the prototype by setting `BASIL_NARRATION_AUDIO`. The matching narration-derived timing JSON is mandatory in `BASIL_CAPTION_TIMINGS`; supplying audio without timing fails validation. This keeps captions aligned even when the voice, pacing, or provider changes. ElevenLabs can later use its text-to-speech-with-timestamps response to satisfy the same contract without changing the video renderer.

## Private storage and phone review

### Evergreen production archive

Reusable source media is preserved separately from the short-lived daily review package. Migration `20260804145541_basil_social_evergreen_archive.sql` creates the private `basil-social-evergreen` bucket and a service-role-only catalog for lifecycle collections, diagrams, and final game-mechanic productions. Objects use immutable content-addressed paths; a repeated upload with the same asset key and SHA-256 is idempotent, while a changed asset becomes a new version and the prior version remains available.

`content/basil-social/evergreen-archive.json` is the repository index. Botanical collections expand the species profile into individually cataloged stage keyframes and also retain the profile, final MP4, poster, production manifest, and useful alternate frames. Diagram collections retain the finished PNG and manifest. Game-mechanic collections retain the finished MP4, poster, caption timing, and manifest without preserving disposable capture intermediates.

The scheduled task obtains a short-lived collection-scoped upload capability through the connected Supabase tool, then runs:

```powershell
pnpm social:archive-evergreen -- --collection-key=<key> --collection-id=<uuid> --transfer-token=<one-time-token>
```

The local computer never needs a Supabase service-role key, the token is limited by collection, upload count, and expiration, and the upload function calculates the authoritative SHA-256 before cataloging each object.

Migration `20260731143000_basil_social_video_packages.sql` creates the private asset and feedback records. Migration `20260731170000_basil_social_one_time_transfers.sql` adds 15-minute, single-use transfer capabilities. Migration `20260731180000_basil_social_approval_guard.sql` creates the database approval guard. Migration `20260731213853_basil_social_three_video_review.sql` extends that guard to daily ranks 1-3 and permits whole-package feedback with a null `story_id`. Migration `20260801203117_basil_social_story_package_approval.sql` adds service-role-only atomic approval. Migration `20260803194823_basil_social_mixed_media_packages.sql` makes the guard asset-aware: videos require MP4, poster, and three drafts; diagrams require PNG and exactly two drafts. Unsupported channels and unvalidated assets remain blocked independently of the Studio client.

The bucket is private and capped at 100 MB per object. Metadata and feedback tables have RLS enabled; `public`, `anon`, and `authenticated` have no grants. After the existing digest token is verified, the server creates one-hour signed URLs for the MP4/poster or PNG. The phone receives only the deployed Studio link from the email, so video playback, diagram review, per-bulletin approval, and revision requests work without remote-desktop access to the computer.

The computer does not need a local Supabase service-role key. The scheduled Codex task uses the connected Supabase tool to mint a short-lived one-time capability, then passes it to the upload script:

```powershell
pnpm social:upload-package -- --story-id=<story-uuid> --transfer-token=<one-time-token>
```

The upload is transactional at the asset level: if metadata insertion fails, the newly uploaded object is removed. Supabase stores only the token hash, consumes the token once, and keeps the service-role key inside the Edge Function. The same model downloads an approved package at 8:00 a.m.; a draft cannot be downloaded by the publishing queue.

## Scheduled Codex handoff

The repository side of both scheduled tasks is ready. The final schedules are created in the desktop app's **Scheduled** view; Codex CLI does not provide that management UI. Both tasks must use this checkout in local-project mode, not an isolated worktree, because the render and the 8:00 a.m. publishing handoff share local artifacts.

Create a daily 6:45 a.m. Chicago-time task with this prompt:

> Use the complete 6:45 a.m. two-video-plus-one-diagram creation prompt in `docs/basil-social-scheduled-tasks.md`. That runbook is the durable source of truth for repository paths, feedback consumption, bulletin selection, rendering, Supabase upload capabilities, validation, and review-email delivery.

Create a second daily 8:00 a.m. Chicago-time task with this prompt:

> Use the complete 8 a.m. approval-gated publishing prompt in `docs/basil-social-scheduled-tasks.md`. It evaluates each story independently, downloads only approved story packages, and preserves the final-action confirmation requirement for external publication.

The desktop must be signed in to Codex, awake, and running with access to this checkout for both local tasks. The phone workflow is email -> private deployed Studio -> Watch or inspect / Edit / Approve package / Request revision. Approval is stored in Supabase and is final authorization for Task 2 to publish the exact approved asset and copy; no second confirmation is required. Scheduled run notifications are available in the desktop/web **Scheduled** inbox; phone delivery should rely on the email and Studio link rather than assuming a Codex mobile task inbox.

The protected route still supports `prepare`, `notify`, and normal scheduled modes for server-side use. The no-extra-API Codex workflow uses connected Supabase capabilities instead, so no production secret needs to be copied onto the computer. Upload and email notification use separate one-time capabilities; the email is sent only after the finished private video is verified.

## Social API connection boundary

The current release intentionally stops at manual approval and copy-ready content. Connector environment variables are reserved in `.env.example`, and the Studio reports whether each platform is manual or ready for an OAuth hookup.

API credentials are not required for assisted posting. When the creator is signed into YouTube, Instagram, and Reddit in Chrome, the 8:00 a.m. Codex task can use the approved queue and downloaded asset through each platform's normal interface. This is less robust than official APIs: login challenges, UI changes, upload processing, or account selectors can stop a run. APIs remain the better option for fully unattended schedules, metric collection, and high-volume publishing.

### Platform-specific audio and covers

- Instagram Reels use a 9:16 video crop and a dedicated cover at Instagram's recommended 1:1.55 ratio (420x654 or a higher-resolution equivalent). The full approved caption and hashtags must be present in the final caption field.
- Instagram-library audio is selected only inside Instagram. The desktop composer does not always expose its audio picker; in that case the Instagram variant remains `manual_ready` for mobile completion instead of publishing silently or with substitute audio.
- YouTube Shorts may use a separately rendered, approved original music mix. The mix must be created for Basil or otherwise licensed; it must not imitate or extract the requested Instagram track.
- Reddit receives the approved core video unless the package explicitly defines another approved adaptation.

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


