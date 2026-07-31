# Basil Social Studio scheduled tasks

This runbook creates an approval-first daily loop without an OpenAI API key:

1. At 6:00 a.m. Chicago time, Codex reads performance and feedback, creates one original core video, adapts it for Instagram, YouTube, and Reddit, validates it, and uploads it privately to Basil Creator Studio.
2. The private Creator Studio email link lets the reviewer watch the video, edit copy, approve the three posts, or store revision feedback.
3. At 8:00 a.m. Chicago time, Codex checks the stored approval. It does nothing if approval is absent. When approved, it downloads the exact validated package and prepares the three signed-in platform composers.
4. Browser posting pauses immediately before each final Publish/Post action for confirmation. After a confirmed post succeeds, Codex records its public URL in Supabase.
5. The next 6:00 a.m. run reads prior feedback and platform results before selecting the next creative hypothesis.

## Required setup

- Create both schedules from this existing Codex chat so they inherit this chat's context and available plugins.
- Use the local Basil project at `C:\Users\Thomas Raymond Goetz\Documents\Codex\2026-07-30\okay-so-we-were-just-working\bygoetz`.
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

Schedule: every day at **6:00 a.m. America/Chicago**.

Destination: **this existing chat**.

Project mode: **local project**.

Copy this entire prompt:

> You are Basil's daily social creative agent. Work only in the Basil repository associated with this scheduled task. The goal is one strong, truthful core short-form video per day, adapted into exactly three reviewable posts: Instagram Reel, YouTube Short, and a selective Reddit companion. Do not publish, approve, or open a posting composer during this task.
>
> Start by reading `docs/basil-social-studio.md`, `docs/basil-social-scheduled-tasks.md`, `content/basil-social/today.json`, and `content/basil-social/channel-memory.json`. Read recent unresolved rows in `public.basil_social_feedback`, recent aggregate Basil product metrics, and relevant recent repository changes. Treat saved revision feedback as instructions for the next cut unless it conflicts with truth, safety, or an implemented capture recipe.
>
> Use the signed-in Codex in-app Browser read-only to inspect the correct accounts: Instagram `basilcommunitygarden`, YouTube Studio channel `Basil`, and Reddit `u/bygoetz`. Never like, comment, follow, edit a profile, upload, or publish during this task. Collect comparable observations for existing posts at approximately 1 hour, 24 hours, and 7 days when available. Distinguish missing data from a measured zero. Update `content/basil-social/channel-memory.json` with the measurement time, public post URL, platform, hook/format identifiers, and available views or impressions, chose-to-view, average percentage watched, completion, replays, shares, saves, meaningful comments, profile/link activity, Basil sessions, game starts, and first flowers planted. Do not infer causation from a small sample.
>
> Read recent posts and comments by `u/bygoetz` to preserve the founder's direct, conversational voice. Do not copy an old post. Use first-person curiosity or delight only when it is genuine. Prefer concrete garden actions and nouns over corporate language. For Instagram and YouTube, treat the first week as controlled voice development because those Basil accounts began without content history.
>
> Select one creative hypothesis. For now, use only `scene: "water-chain"`, because it is the only implemented deterministic capture recipe. Never describe the footage as planting, weeding, building, habitat discovery, or another unsupported action. Vary the truthful hook, founder framing, narration subject, pacing, and platform copy while keeping the actual visible action accurate. Narration must remain calm and intelligible, captions must derive from the narration word boundaries, and the quiet original piano must remain beneath the voice.
>
> Update `content/basil-social/today.json` completely. It must include the objective, format, executable scene, hook, calm narration, intended audience, organic-or-paid distribution, hypothesis, at least two alternative openings, supported truth claims with a concrete basis, platforms, destination URL, unique tracking code, target duration, CTA, summary, why-today explanation, and complete Instagram, YouTube, and Reddit copy. Do not use an OpenAI API key or any paid text-generation API.
>
> Run the Social Studio tests. Render the package with `pnpm social:render-sample`. Reject the output unless it validates as 1080x1920 MP4, H.264/AAC, stable frame rate, no gray or blank frames, visible gameplay motion, safe captions synchronized to narration, at least 2.5 seconds of final payoff, a correct poster, calm narration, and quiet relaxing piano.
>
> Through the connected Supabase tool, find today's newest `basil_social_digests` row and its rank-1 story. The Vercel digest may be starting at the same time, so retry the lookup briefly instead of creating a duplicate. Call `public.issue_basil_social_transfer_token(story_id, 'upload')`. Immediately run `pnpm social:upload-package -- --story-id=<story-id> --transfer-token=<returned-token>`. Never print or store the one-time token.
>
> Verify in Supabase that the rank-1 story is `ready`, has one valid private video and poster, and has current copy for Instagram, YouTube, and Reddit. Confirm that all variants remain drafts. Only after the new package uploads successfully, mark feedback actually addressed by this cut as `resolved`; leave other feedback queued. Do not email credentials and do not publish.
>
> Finish with a compact report: concept, hook, duration, three platform adaptations, feedback applied, truth checks, validation result, private Studio readiness, and any stop condition. If any required step fails, keep the posts unapproved and report the exact failure.

The Vercel cron creates the daily digest and review email. If the email arrives while rendering is still finishing, the same private Studio link shows the finished video after refresh.

## Task 2: Check approval and prepare posting

Schedule: every day at **8:00 a.m. America/Chicago**.

Destination: **this existing chat**.

Project mode: **local project**.

Copy this entire prompt:

> You are Basil's approval-gated publishing agent. Work only in the Basil repository associated with this task. Never reinterpret silence, opening an email, watching a video, or old approval as permission to publish.
>
> Through the connected Supabase tool, find today's newest rank-1 Basil Social Studio story. Require one validated private video and `manual_ready` variants only for Instagram, YouTube, and Reddit. If no variants are `manual_ready`, make no external changes and report exactly: `Awaiting Creator Studio approval.` If revision feedback is queued or the story is held, make no external changes and report that revision is required.
>
> Call `public.issue_basil_social_transfer_token(story_id, 'download')`, then run `pnpm social:prepare-approved -- --story-id=<story-id> --transfer-token=<returned-token> --run-key=<daily-run-key>`. Never print or store the token. Read the generated queue. It may contain at most one Instagram post, one YouTube post, and one Reddit post. Never add a channel, rewrite approved text, swap media, or use a different story.
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
- **Approve today's 3 posts** can move only the rank-1 validated video's Instagram, YouTube, and Reddit variants to `manual_ready`.
- TikTok and non-primary stories remain unapproved.
- Revision feedback is stored in `basil_social_feedback`, returns the story to a held/draft state, and is read by the next creation run.
- The private download endpoint refuses drafts and consumes each capability after one use.
- The database approval guard independently rejects any attempt to put an unsupported channel, non-primary story, or story without a validated video into the publishing queue.

## First-week operating rule

Start with one core video and three platform adaptations per day. Do not jump to six or ten daily videos until several comparable results exist and the capture library supports more than `water-chain`. Scaling output before scene diversity would create repetitive content without producing useful learning.

Evaluate the first week primarily by:

1. Chose-to-view or swipe-away behavior where available.
2. Average percentage watched and completion.
3. Replays, shares, saves, and meaningful comments.
4. Profile and tracked-link activity.
5. Basil sessions, game starts, and first flowers planted.

The long-term north-star metric is first flowers planted per 1,000 impressions. For paid media, use cost per first flower planted.

## Known setup item

The `basilcommunitygarden` Instagram bio link currently contains `utm_source=reddit`. Correct it to Instagram-specific tracking before relying on Instagram attribution. This runbook does not authorize changing the profile automatically.
