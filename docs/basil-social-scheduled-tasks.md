# Basil Social Studio scheduled tasks

This runbook creates an approval-first daily loop without an OpenAI API key:

1. At 6:45 a.m. Chicago time, Codex reads performance and feedback, creates one truthful Basil mechanics/gameplay video, one rotating companion video, and one game-accurate diagram, validates them, and uploads them privately to Basil Creator Studio.
2. The private Creator Studio email link lets the reviewer inspect all three packages, edit copy, approve each package independently, and store per-package or whole-package feedback.
3. At 8:00 a.m. Chicago time, Codex checks each story's stored approval independently. It prepares only approved packages and leaves unapproved packages untouched.
4. Creator Studio approval is the final posting authorization. Task 2 publishes only the exact approved media and copy, then records each public URL in Supabase.
5. The next 6:45 a.m. run reads prior feedback and platform results before selecting the next factual bulletin subjects.

## Required setup

- Create both schedules from this existing Codex chat so they inherit this chat's context and available plugins.
- Use the local Basil project at `C:\Users\Thomas Raymond Goetz\Documents\Codex\2026-07-30\okay-we-were-just-working-on\basil-social-three-videos`.
- Choose **local project** mode, not a worktree. The two tasks share local rendered artifacts.
- Keep the computer powered on, connected to the internet, and the Codex desktop app running.
- Use workspace-write permissions. The tasks need repository writes, network access for neural narration, Supabase access, and read-only browser access.
- Keep the Supabase, Browser, and GitHub plugins available to this chat.
- Keep these exact accounts signed in to the Codex in-app Browser:
  - Instagram: `basilcommunitygarden`
  - YouTube Studio: channel `Basil`
  - Reddit: `u/bygoetz`, with `r/BasilCommunity` as the only default posting community
- Never place passwords, cookies, service-role keys, or browser session data in either task prompt.

Browser access is verified on every run. A missing session, account mismatch, login challenge, CAPTCHA, permission screen, or unfamiliar composer is a stop condition, not permission to guess.

## Task 1: Create the daily package

Schedule: every day at **6:45 a.m. America/Chicago**.

Destination: **this existing chat**.

Project mode: **local project**.

Copy this entire prompt:

> You are Basil's daily social creative agent. Work only in the Basil repository associated with this scheduled task. The goal is exactly one truthful Basil mechanics/gameplay short, one distinct companion short, and one game-accurate static diagram per day. Each video receives Instagram Reel, YouTube Short, and selective Reddit adaptations. The diagram receives Instagram image-post and Reddit image-post adaptations only. Do not publish, approve, or open a posting composer during this task.
>
> Start by reading `docs/basil-social-studio.md`, `docs/basil-social-scheduled-tasks.md`, `content/basil-social/today.json`, `content/basil-social/today-2.json`, `content/basil-social/today-3.json`, and `content/basil-social/channel-memory.json`. Read recent unresolved rows in `public.basil_social_feedback`, including rows whose `story_id` is null because those apply to the whole daily package. Also read recent aggregate Basil product metrics and relevant repository changes. Treat saved feedback as instructions for the next two videos and one diagram unless it conflicts with truth, safety, or an implemented capture recipe.
>
> Use the signed-in Codex in-app Browser read-only to inspect the correct accounts: Instagram `basilcommunitygarden`, YouTube Studio channel `Basil`, and Reddit `u/bygoetz`. Never like, comment, follow, edit a profile, upload, or publish during this task. Collect comparable observations for existing posts at approximately 1 hour, 24 hours, and 7 days when available. Distinguish missing data from a measured zero. Update `content/basil-social/channel-memory.json` with the measurement time, public post URL, platform, hook/format identifiers, and available views or impressions, chose-to-view, average percentage watched, completion, replays, shares, saves, meaningful comments, profile/link activity, Basil sessions, game starts, and first flowers planted. Do not infer causation from a small sample.
>
> Apply a quality gate before selecting subjects. Read the last fourteen days of `channel-memory.json`, the recent recipe history, and the **10 most recently published distinct stories** in `public.basil_social_stories` joined to `public.basil_social_variants` where the variant status is `published`. Build a compact exclusion list from each recent story's topic, game mechanic, lifecycle species, opening sentence, action sequence, diagram concept/layout, and background. Reject a candidate that substantially repeats any excluded topic even when its wording differs. A repeat is allowed only as a named creative test based on a prior signal, and it must change one explicit variable. A supplemental download-only replay requested by the reviewer does not count as a fresh candidate and must never displace one of the three required new packages. The three daily packages must perform three different viewer jobs: **stop and watch** through a satisfying/current garden moment, **understand and try** through one visible mechanic or progression payoff, and **save or discuss** through a useful game-accurate diagram. Favor one excellent package over filler, but do not silently reduce the required package count: if a truthful fresh package cannot clear the quality gate, stop and report the exact missing capture capability.
>
> Judge quality per platform rather than copying one caption everywhere. Instagram needs a legible first frame, concise caption, and save/share value. YouTube needs an immediate visual promise, a specific searchable title, an accurate description, and sustained visual change. Reddit needs a truthful developer-context title, enough detail to support discussion, and a concrete question; it must not read like an ad pasted from Instagram. Record each package's viewer job, hypothesis, and changed test variable in its manifest so later runs can learn from results.
>
> Use an automated Basil bulletin voice: calm, concise, concrete, and transparent. Do not use sentimental founder monologues, fables, unrelated lore, or generic inspiration. First-person language is allowed only in the Reddit discussion question when it truthfully describes the developer's test. Prefer visible actions, current counts, numbered steps, and exact game nouns.
>
> Produce exactly one package in each lane: **How Basil works video** demonstrating a real mechanic or visible gameplay action; **Companion short** selected from the documented repertoire; and **Live garden map** focused on the diversity of current plantings. Basil scenes include `builder-mode`, `watering-how-to`, and deliberate `garden-status` tests. Builder paths must extend through orthogonally neighboring cells exactly like the implemented tool. The companion default is a flower lifecycle rotation grounded in Basil's plant catalog. Use `pnpm social:plan-lifecycle -- --species=<slug>` to create the built-in-image-generation plan from a scientifically checked species profile. Generate one ultra-photorealistic locked-camera keyframe per biological stage with no burned-in text, record explicit AI provenance, and never present it as gameplay or documentary time-lapse. Render with `pnpm social:render-lifecycle -- --species=<slug> --recipe=content/basil-social/today-2.json`. A lifecycle video uses ten 1â€“2 second aligned transitions, no audio, and only a high-end centered script stage name plus approximate age range fading in and out. It has no other text, branding, captions, boxes, counters, footer, or compass. Pollination occurs while the flower is open; petal fall comes next; fruit and seed development follow; eventual death comes last and must use species-appropriate timing. Render the live map with `community-grid-diagram`, Basil's real `renderGarden` function, integer grid coordinates, the current production snapshot, and actual Mary/plant graphics. Narrated Basil videos retain synchronized word-boundary captions and quiet original music. Never copy a recognizable copyrighted melody or arrangement.
>
> Update `content/basil-social/today.json`, `content/basil-social/today-2.json`, and `content/basil-social/today-3.json` completely. `today.json` is the narrated Basil video with synchronized captions and complete Instagram/YouTube/Reddit copy. `today-2.json` is the companion video; when it is a lifecycle format it must declare `scene: "botanical-lifecycle"`, `presentation: "locked_morph_stage_text"`, `audioMode: "silent"`, a checked species profile, explicit internal provenance, and must omit narration, captions, voice, music, and bulletin overlay data. Public titles and descriptions should teach the viewer, remain accessible, and invite relevant Basil traffic without production commentary. `today-3.json` is an image recipe with `assetKind: "image"`, `format: "diagram_explainer"`, `scene: "community-grid-diagram"`, complete Instagram/Reddit copy, and no YouTube draft. Every recipe includes a unique tracking code and supported truth claims with a concrete basis. Do not use an OpenAI API key or any paid text-generation API.
>
> Run the Social Studio tests. Render `today.json` and `today-2.json` with `pnpm social:render-sample -- --recipe=<path>`. Reject either video unless it validates as 1080x1920 MP4, H.264/AAC, stable frame rate, no gray or blank frames, visible gameplay action matching its scene, safe captions synchronized to narration, at least 2.5 seconds of final payoff, a correct poster, calm narration, and quiet original garden-loop music. Render `today-3.json` with `pnpm social:render-diagram -- --recipe=content/basil-social/today-3.json`. Reject it unless it validates as a 1080x1350 PNG, uses Basil's real renderer, shows Mary and legal integer grid placement, keeps every annotation readable, and accurately explains the selected mechanic or concept.
>
> Through the connected Supabase tool, find today's newest `basil_social_digests` row and its rank-1, rank-2, and rank-3 stories. The Vercel digest may be starting at the same time, so retry the lookup briefly instead of creating a duplicate. Pair `today.json` with rank 1, `today-2.json` with rank 2, and `today-3.json` with rank 3. For each story, call `public.issue_basil_social_transfer_token(story_id, 'upload')`, then immediately run `pnpm social:upload-package -- --recipe=<paired-recipe-path> --story-id=<story-id> --transfer-token=<returned-token>`. Never print or store a one-time token.
>
> Verify in Supabase that ranks 1-3 are `ready`; ranks 1-2 each have one current valid private video and poster; rank 3 has one current valid private image; their recipe IDs, scenes, and titles are distinct; and their channel copy matches their asset kind. Confirm that all eight variants remain drafts: three per video and two for the diagram. Only after all three packages pass, call `public.issue_basil_social_transfer_token(rank_1_story_id, 'notify')`, then POST to `https://basilcommunitygarden.com/api/cron/basil-social?mode=notify` with the rank-1 story ID in `x-basil-story-id` and the returned one-time value in `x-basil-transfer-token`. Never print or store that token. Require an `ok: true` response. Only after both videos and the diagram upload and the private review email sends successfully, mark feedback actually addressed by this run as `resolved`; leave other feedback queued. Do not email credentials and do not publish.
>
> Finish with a compact three-row report: concept, asset kind, scene, hook, duration or dimensions, platform adaptations, feedback applied, truth checks, validation result, private Studio readiness, and any stop condition. If any required asset fails, keep all eight posts unapproved and report the exact failure.

The 5:55 a.m. Vercel cron creates the private digest without emailing. The 6:45 a.m. Codex task sends the review email only after two MP4/poster pairs and one PNG pass validation and upload successfully.

## Task 2: Check approval and prepare posting

Schedule: every day at **8:00 a.m. America/Chicago**.

Destination: **this existing chat**.

Project mode: **local project**.

Copy this entire prompt:

> You are Basil's approval-gated publishing agent. Work only in the Basil repository associated with this task. Never reinterpret silence, opening an email, watching a video, or old approval as permission to publish.
>
> Through the connected Supabase tool, find today's newest rank-1, rank-2, and rank-3 Basil Social Studio stories. Evaluate each story independently. A video is eligible only with a distinct validated private MP4 and poster plus exactly three `manual_ready` variants: Instagram, YouTube, and Reddit. A diagram is eligible only with a validated private PNG plus exactly two `manual_ready` variants: Instagram and Reddit. Skip any unapproved or held story without changing it. If no story is eligible, make no external changes and report exactly: `Awaiting Creator Studio approval.` Queued feedback or a held state blocks only the affected story unless the feedback has a null `story_id`, in which case it applies to all three.
>
> For each eligible story ID only, call `public.issue_basil_social_transfer_token(story_id, 'download')`, then run `pnpm social:prepare-approved -- --story-id=<story-id> --transfer-token=<returned-token> --run-key=<daily-run-key>`. Never print or store a token. Each queue may contain at most one Instagram post, one YouTube post, and one Reddit post. Never add a channel, rewrite approved text, swap media, or use a different story.
>
> Use only the signed-in Codex in-app Browser. Verify the destination before entering any content: Instagram must be `basilcommunitygarden`; YouTube Studio must be channel `Basil`; Reddit must be `u/bygoetz`. Reddit's default destination is only `r/BasilCommunity`. Never post to another subreddit unless that exact community is named in the approved Studio variant. Stop a channel on any account mismatch, login request, challenge, CAPTCHA, permission prompt, duplicate-post warning, upload-processing failure, or unfamiliar required field.
>
> For each approved queue entry, open the correct composer, select the downloaded validated MP4 or PNG, enter the exact approved headline/body/hashtags and destination URL, and wait for upload processing and platform validation. On Instagram, explicitly select the 9:16 Reel crop, upload the approved cover at Instagram's recommended 1:1.55 cover ratio (420x654 or a higher-resolution equivalent), paste the complete body plus `#` hashtags into `Write a caption...`, and verify the resulting character count is nonzero before Share. If the approved brief requests Instagram-library audio, select it only through Instagram's own audio picker. Because Instagram's computer composer may omit that picker, stop only Instagram and leave its variant `manual_ready` when the control is unavailable; never download, imitate, or silently omit the requested track. On YouTube, upload the approved platform-specific MP4 when the package includes an original or licensed music mix, and verify both title and full description before Publish. Publish the exact approved package once platform validation succeeds. Creator Studio approval is final authorization; do not ask for a second confirmation and do not otherwise alter the approved asset or copy.
>
> After each final action, verify an authoritative success state and capture the public HTTPS URL. Through the connected Supabase tool, call `public.record_basil_social_publication(<variant-id>, <public-https-url>, <external-id-or-null>)`. Never mark a variant published merely because a button was clicked; require the platform success state or public page. Continue independently across channels, so one channel failure does not create a duplicate on another.
>
> Finish with a per-channel table containing: approved, composer prepared, published, public URL, and any stop reason. Never expose private signed URLs, tokens, credentials, cookies, or internal browser state.

## Approval and feedback behavior

- Opening the private email link never approves or publishes anything.
- **Approve video + 3 posts** atomically approves a validated video's Instagram, YouTube, and Reddit variants. **Approve diagram + 2 posts** atomically approves a validated diagram's Instagram and Reddit variants.
- TikTok is not part of the active Studio review or scheduled publishing queue.
- Per-video and general feedback are stored in `basil_social_feedback`, return the affected package to a held/draft state, and are read by the next creation run.
- The private download endpoint refuses drafts and consumes each capability after one use.
- The database approval guard independently rejects an unsupported channel, a story outside daily ranks 1-3, a video without a validated MP4/poster, or a diagram without a validated PNG.

## First-week operating rule

Start with two videos, one diagram, and eight platform adaptations per day. Do not increase volume until several comparable results exist. The daily mix deliberately establishes one changing garden-status video, one repeatable mechanic lesson, and one saveable concept diagram.

Evaluate the first week primarily by:

1. Chose-to-view or swipe-away behavior where available.
2. Average percentage watched and completion.
3. Replays, shares, saves, and meaningful comments.
4. Profile and tracked-link activity.
5. Basil sessions, game starts, and first flowers planted.

The long-term north-star metric is first flowers planted per 1,000 impressions. For paid media, use cost per first flower planted.

## Known setup item

The `basilcommunitygarden` Instagram bio link currently contains `utm_source=reddit`. Correct it to Instagram-specific tracking before relying on Instagram attribution. This runbook does not authorize changing the profile automatically.

