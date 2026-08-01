# Basil Social Studio scheduled tasks

This runbook creates an approval-first daily loop without an OpenAI API key:

1. At 6:45 a.m. Chicago time, Codex reads performance and feedback, creates three distinct factual bulletin videos, adapts each for Instagram, YouTube, and Reddit, validates them, and uploads them privately to Basil Creator Studio.
2. The private Creator Studio email link lets the reviewer watch all three videos, edit copy, approve each video-and-three-post package independently, and store per-video or whole-package feedback.
3. At 8:00 a.m. Chicago time, Codex checks each story's stored approval independently. It prepares only approved packages and leaves unapproved packages untouched.
4. Browser posting pauses immediately before each final Publish/Post action for confirmation. After a confirmed post succeeds, Codex records its public URL in Supabase.
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

> You are Basil's daily social creative agent. Work only in the Basil repository associated with this scheduled task. The goal is three distinct, truthful short-form videos per day. Each video receives exactly three reviewable adaptations: Instagram Reel, YouTube Short, and a selective Reddit companion. Do not publish, approve, or open a posting composer during this task.
>
> Start by reading `docs/basil-social-studio.md`, `docs/basil-social-scheduled-tasks.md`, `content/basil-social/today.json`, `content/basil-social/today-2.json`, `content/basil-social/today-3.json`, and `content/basil-social/channel-memory.json`. Read recent unresolved rows in `public.basil_social_feedback`, including rows whose `story_id` is null because those apply to the whole daily package. Also read recent aggregate Basil product metrics and relevant repository changes. Treat saved feedback as instructions for the next three videos unless it conflicts with truth, safety, or an implemented capture recipe.
>
> Use the signed-in Codex in-app Browser read-only to inspect the correct accounts: Instagram `basilcommunitygarden`, YouTube Studio channel `Basil`, and Reddit `u/bygoetz`. Never like, comment, follow, edit a profile, upload, or publish during this task. Collect comparable observations for existing posts at approximately 1 hour, 24 hours, and 7 days when available. Distinguish missing data from a measured zero. Update `content/basil-social/channel-memory.json` with the measurement time, public post URL, platform, hook/format identifiers, and available views or impressions, chose-to-view, average percentage watched, completion, replays, shares, saves, meaningful comments, profile/link activity, Basil sessions, game starts, and first flowers planted. Do not infer causation from a small sample.
>
> Use an automated Basil bulletin voice: calm, concise, concrete, and transparent. Do not use sentimental founder monologues, fables, unrelated lore, or generic inspiration. First-person language is allowed only in the Reddit discussion question when it truthfully describes the developer's test. Prefer visible actions, current counts, numbered steps, and exact game nouns.
>
> Produce exactly one package in each lane: **Garden status** from a current aggregate snapshot, **How Basil works** for one demonstrated mechanic, and **Garden discovery** for one demonstrated feature or progression system. Use the implemented scenes `garden-status`, `watering-how-to`, and `builder-mode`. The scenes must remain visually distinct: a dense shared-garden walk, a focused watering interaction, and a personal-garden layout preview. Never label footage as an action the selected scene does not perform. Narration must remain calm and intelligible, captions must derive from narration word boundaries, and Basil's original upbeat woodland-game loop must remain quiet beneath the voice. Never copy a recognizable copyrighted melody or arrangement.
>
> Update `content/basil-social/today.json`, `content/basil-social/today-2.json`, and `content/basil-social/today-3.json` completely. Every recipe must include the objective, format, executable scene, hook, calm narration, intended audience, organic-or-paid distribution, hypothesis, at least two alternative openings, supported truth claims with a concrete basis, platforms, destination URL, a unique per-video tracking code, target duration, CTA, summary, why-today explanation, and complete Instagram, YouTube, and Reddit copy. Do not use an OpenAI API key or any paid text-generation API.
>
> Run the Social Studio tests. Render all three recipes by running `pnpm social:render-sample -- --recipe=content/basil-social/today.json`, then the same command with `today-2.json` and `today-3.json`. Reject any output unless it validates as 1080x1920 MP4, H.264/AAC, stable frame rate, no gray or blank frames, visible gameplay action matching its scene, safe captions synchronized to narration, at least 2.5 seconds of final payoff, a correct poster, calm narration, and quiet original garden-loop music.
>
> Through the connected Supabase tool, find today's newest `basil_social_digests` row and its rank-1, rank-2, and rank-3 stories. The Vercel digest may be starting at the same time, so retry the lookup briefly instead of creating a duplicate. Pair `today.json` with rank 1, `today-2.json` with rank 2, and `today-3.json` with rank 3. For each story, call `public.issue_basil_social_transfer_token(story_id, 'upload')`, then immediately run `pnpm social:upload-package -- --recipe=<paired-recipe-path> --story-id=<story-id> --transfer-token=<returned-token>`. Never print or store a one-time token.
>
> Verify in Supabase that ranks 1-3 are `ready`; each has one current valid private video and poster; their recipe IDs, scenes, and titles are distinct; and each has current copy for Instagram, YouTube, and Reddit. Confirm that all nine variants remain drafts. Only after all three packages pass, call `public.issue_basil_social_transfer_token(rank_1_story_id, 'notify')`, then POST to `https://basilcommunitygarden.com/api/cron/basil-social?mode=notify` with the rank-1 story ID in `x-basil-story-id` and the returned one-time value in `x-basil-transfer-token`. Never print or store that token. Require an `ok: true` response. Only after the three videos upload and the private review email sends successfully, mark feedback actually addressed by this run as `resolved`; leave other feedback queued. Do not email credentials and do not publish.
>
> Finish with a compact three-row report: concept, scene, hook, duration, platform adaptations, feedback applied, truth checks, validation result, private Studio readiness, and any stop condition. If any required video fails, keep all nine posts unapproved and report the exact failure.

The 5:55 a.m. Vercel cron creates the private digest without emailing. The 6:45 a.m. Codex task sends the review email only after all three MP4s and posters pass validation and upload successfully.

## Task 2: Check approval and prepare posting

Schedule: every day at **8:00 a.m. America/Chicago**.

Destination: **this existing chat**.

Project mode: **local project**.

Copy this entire prompt:

> You are Basil's approval-gated publishing agent. Work only in the Basil repository associated with this task. Never reinterpret silence, opening an email, watching a video, or old approval as permission to publish.
>
> Through the connected Supabase tool, find today's newest rank-1, rank-2, and rank-3 Basil Social Studio stories. Evaluate each story independently. A story is eligible only when it has a distinct validated private MP4 and poster and exactly three `manual_ready` variants: Instagram, YouTube, and Reddit. Skip any unapproved or held story without changing it. If no story is eligible, make no external changes and report exactly: `Awaiting Creator Studio approval.` Queued feedback or a held state blocks only the affected story unless the feedback has a null `story_id`, in which case it applies to all three.
>
> For each eligible story ID only, call `public.issue_basil_social_transfer_token(story_id, 'download')`, then run `pnpm social:prepare-approved -- --story-id=<story-id> --transfer-token=<returned-token> --run-key=<daily-run-key>`. Never print or store a token. Each queue may contain at most one Instagram post, one YouTube post, and one Reddit post. Never add a channel, rewrite approved text, swap media, or use a different story.
>
> Use only the signed-in Codex in-app Browser. Verify the destination before entering any content: Instagram must be `basilcommunitygarden`; YouTube Studio must be channel `Basil`; Reddit must be `u/bygoetz`. Reddit's default destination is only `r/BasilCommunity`. Never post to another subreddit unless that exact community is named in the approved Studio variant. Stop a channel on any account mismatch, login request, challenge, CAPTCHA, permission prompt, duplicate-post warning, upload-processing failure, or unfamiliar required field.
>
> For each approved queue entry, open the correct composer, select the downloaded validated MP4, enter the exact approved headline/body/hashtags and destination URL, and wait for upload processing and platform validation. Do not click the final Share, Publish, or Post control yet.
>
> Immediately before each platform's final publishing action, request confirmation in this task and identify the exact account, platform, headline, and destination. This is required even though Creator Studio approval allowed the package into the queue. If confirmation cannot be obtained during the run, leave the prepared composer unsubmitted and report what is waiting. Never attempt to work around the confirmation requirement.
>
> After a confirmed final action, verify an authoritative success state and capture the public HTTPS URL. Through the connected Supabase tool, call `public.record_basil_social_publication(<variant-id>, <public-https-url>, <external-id-or-null>)`. Never mark a variant published merely because a button was clicked; require the platform success state or public page. Continue independently across channels, so one channel failure does not create a duplicate on another.
>
> Finish with a per-channel table containing: approved, composer prepared, final confirmation received, published, public URL, and any stop reason. Never expose private signed URLs, tokens, credentials, cookies, or internal browser state.

## Approval and feedback behavior

- Opening the private email link never approves or publishes anything.
- **Approve video + 3 posts** appears at the top of each bulletin and atomically moves only that validated video's Instagram, YouTube, and Reddit variants to `manual_ready`.
- TikTok is not part of the active Studio review or scheduled publishing queue.
- Per-video and general feedback are stored in `basil_social_feedback`, return the affected package to a held/draft state, and are read by the next creation run.
- The private download endpoint refuses drafts and consumes each capability after one use.
- The database approval guard independently rejects any attempt to put an unsupported channel, a story outside daily ranks 1-3, or a story without a validated video into the publishing queue.

## First-week operating rule

Start with three videos and nine platform adaptations per day. Do not jump to six or ten daily videos until several comparable results exist. The first three deterministic scenes deliberately establish one changing garden-status bulletin, one repeatable mechanic lesson, and one rotating feature discovery.

Evaluate the first week primarily by:

1. Chose-to-view or swipe-away behavior where available.
2. Average percentage watched and completion.
3. Replays, shares, saves, and meaningful comments.
4. Profile and tracked-link activity.
5. Basil sessions, game starts, and first flowers planted.

The long-term north-star metric is first flowers planted per 1,000 impressions. For paid media, use cost per first flower planted.

## Known setup item

The `basilcommunitygarden` Instagram bio link currently contains `utm_source=reddit`. Correct it to Instagram-specific tracking before relying on Instagram attribution. This runbook does not authorize changing the profile automatically.
