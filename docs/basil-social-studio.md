# Basil Social Studio

Basil Social Studio is an approval-first, vertical-content-first daily editorial workflow. It watches recent repository activity, combines it with aggregate garden statistics and a curated factual story library, creates three to five cross-channel content packets, and emails a private review link to `info@bygoetz.com` by default.

Opening the email link never publishes content. The final review token is carried in the URL fragment, removed from browser history immediately, and submitted only through same-origin POST requests. Supabase stores only a SHA-256 hash of the token.

## Daily workflow

1. Vercel calls `/api/cron/basil-social` at 13:15 UTC.
2. The route reads the last fourteen days of GitHub commits and calls `get_basil_social_stats()` for aggregate, non-identifying garden totals.
3. `socialContent.ts` scores factual Basil story cards against recent work and rotates evergreen cards into the remaining positions.
4. If `OPENAI_API_KEY` is configured, the selected drafts are refined through the Responses API using strict structured output. Failure falls back to the curated drafts rather than failing the daily run.
5. The digest, stories, four channel variants, evidence, vertical production briefs, and private approval state are stored in Supabase.
6. Resend sends one idempotent review email.
7. The reviewer edits, copies, approves, skips, and marks manually published variants in `/community-garden/social-studio`.

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

OpenAI refinement is optional. Without it, the workflow remains fully usable with its curated editorial library.

## Social API connection boundary

The current release intentionally stops at manual approval and copy-ready content. Connector environment variables are reserved in `.env.example`, and the Studio reports whether each platform is manual or ready for an OAuth hookup.

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
