# Basil launch roadmap

Last audited: July 21, 2026  
Launch scope: US-only web launch, one-time Garden Membership at $6.99  
Owner-approved initial Meta research cap: $150
Phase 0 rule: documentation and launch decisions only; no gameplay or production behavior changes

## Launch status

Basil is live and suitable for controlled external testing, but paid advertising must wait for the Phase 0 manual gate and the measurement, policy, and reliability gates below. The owner has approved a $150 initial ad-research cap and accepts that this is research money, not forecast profit.

Phase 0 has established the technical baseline. The owner selected the portfolio-owned ByGoetz Ads Manager account `555175360336933` for the launch. Account `67385321` is the owner's personal ad account and is not the Basil launch account. Phase 0 remains manually open until the owner confirms domain ownership and dashboard access for every production dependency in [the launch checklist](./basil-launch-checklist.md).

## Production baseline

| Item | Baseline |
| --- | --- |
| Public Basil URL | `https://www.bygoetz.com/community-garden` |
| Live response | HTTP 200 on July 21, 2026 |
| Git repository | `BigHitterG/bygoetz` |
| Production branch | `main` |
| Pre-launch production commit | `373d0dc4bd22abb87666a1f2a27b1c397a41e95c` (`Refine Basil onboarding guidance`) |
| Vercel deployment | `dpl_CYrSjFxAwUnCh1fy4BbBVvyhcjg2` |
| Deployment URL | `https://bygoetz-onzebeloj-bighittergs-projects.vercel.app` |
| Deployment state | `READY`, production, Git source |
| Deployment created | July 21, 2026 at 16:36:14 UTC |
| Vercel project | `bygoetz` / `prj_MXqx7eJDGtvK0XOOB80zVSUnTxdo` |
| Vercel team | `team_MfQH6rtXU5fa0YuFEjcK0e65` |
| Runtime | Next.js, Node.js 24.x, primary function region `iad1` |
| Current aliases | `www.bygoetz.com`, `bygoetz.com`, and Vercel project aliases |
| Supabase project | `bygoetz` / `qripkmzrujarmmbgewub`, `ACTIVE_HEALTHY`, `us-east-1` |
| Shared map at audit | 1,546 canonical plant rows; snapshot endpoint healthy |
| Membership records at audit | 2 steward records and 2 active entitlement records; these may include test purchases and are not evidence of external conversion |

`basilcommunitygarden.com` was available through Vercel for $11.25 for one year when checked on July 21, 2026. Availability is not ownership. Phase 0 does not purchase, attach, redirect, or advertise the domain.

## Current architecture

```text
Guest browser
  |-- GET /community-garden ----------------------> Vercel / Next.js
  |-- GET /api/community-garden/snapshot --------> cached 10-minute snapshot
  |-- POST /api/community-garden/action ----------> server validation + Supabase RPC
  |-- local guest preview ------------------------> sessionStorage + 7-day localStorage transfer
  |
  `-- membership path
       |-- account form --------------------------> /api/community-garden/auth/email
       |                                             Supabase Auth admin link
       |                                             Resend branded email
       |-- email link ----------------------------> /community-garden?steward=confirm-account
       |                                             Supabase verifyOtp + browser session
       |-- POST /api/community-garden/checkout ---> Stripe Checkout, one-time $6.99 USD
       |-- payment success -----------------------> /api/community-garden/claim
       |                                             plus signed Stripe webhook backup
       |-- entitlement ---------------------------> garden_stewards + garden_entitlements
       `-- preview import ------------------------> persistent My Garden + Care in Supabase
```

### Public Community Garden

- The world is a 160 by 160 logical map with 25,600 possible tiles. Supabase stores only occupied plant tiles.
- A complete sparse canonical snapshot is generated in ten-minute rounds and served through `/api/community-garden/snapshot` with version-aware CDN/browser caching.
- The browser keeps the snapshot locally while the player moves; walking does not issue a database read per tile.
- Planting and watering submit immediately to `/api/community-garden/action`. Each request has a client-generated UUID idempotency key and is processed by the server-side `perform_idempotent_community_garden_action` RPC.
- A signed, HTTP-only anonymous session cookie supports per-actor and per-network rate limits without storing a raw IP address or public identity.
- The initiating browser immediately overlays a successful action locally. The next canonical snapshot can reconcile conflicts.
- The current system uses HTTP snapshots and action requests, not a broad Supabase Realtime subscription.
- Health pulses, action outcomes, snapshot outcomes, latency, and coarse device class feed the private Basil health panel.

### Private My Garden and membership

- Supabase Auth supplies private email/password accounts and persistent browser sessions. Email is not displayed as an in-game identity.
- Paid access is stored in provider-neutral `garden_entitlements`; the current provider is Stripe.
- My Garden plants, paths, placeable elements, plot progression, Care balance, Care receipts, and the Care ledger are server controlled.
- Browser roles do not directly read or mutate private garden tables. The app authenticates the user, then server routes use the Supabase service role and controlled database functions.
- The upgrade feedback queue is private, member-only input for human review. Feedback never triggers an automatic production change.

## Complete guest-to-purchase funnel

1. A signed-out visitor opens the public Community Garden and receives the current cached snapshot.
2. Contextual onboarding teaches the visitor to open inventory, choose a plant, and place three plants in the Community Garden.
3. The first three unpaid community plantings each award two temporary Care. Later guest actions use the normal steady cadence of one Care per four qualifying actions.
4. After three community plantings, My Garden becomes available. The visitor can enter a temporary private preview using the same game interface.
5. The preview permits free paths. After three personal flowers, a soft membership offer appears; declining keeps the visitor in My Garden and points them toward Community Garden to earn more Care.
6. The temporary Community Garden → Care → My Garden loop continues until ten personal flowers. At ten flowers, further personal planting requires the one-time $6.99 Garden Membership. The preview becomes save-required after 24 hours, while its visible work remains recoverable for purchase.
7. Before leaving Basil, the app keeps its browser backup and sends a strictly validated preview containing remaining Care, up to ten plants, and up to 64 paths to `/api/community-garden/checkout`.
8. The server writes that preview to the RLS-protected, service-role-only `garden_pending_purchases` table with a random claim secret and seven-day expiry, then creates a one-time Stripe-hosted Checkout session for $6.99 USD. Stripe collects the receipt/account email on its hosted page; Basil never handles card details.
9. Stripe metadata connects the checkout to the pending preview without putting the preview or email in metadata. The checkout route also records authoritative paywall and checkout milestones.
10. A paid Stripe webhook or `/api/community-garden/claim` callback validates the signature/session, exact price, currency, payment status, pending record, and claim secret. Conditional activation locking plus provider purchase uniqueness make duplicate callbacks idempotent.
11. After payment, Basil creates or resolves the private Supabase account for the Stripe email, grants the entitlement, imports the preview server-side through `import_my_garden_preview`, and sends a Basil-branded verification/setup email through Resend.
12. Stripe returns the customer to a dedicated payment-complete screen explaining that the garden is safe and verification is the remaining step. The email link can open in another browser, verifies with Supabase `verifyOtp`, and requires the customer to choose their Basil password.
13. After verification, `/api/community-garden/account` loads the already-persistent membership and exact preview garden. Browser storage remains a fallback and is cleared only after the authenticated garden is confirmed. Cancellation returns to the unchanged guest garden.

The pending preview is server-backed before Stripe, so cross-browser email verification does not determine whether the paid garden survives. Active unpaid play lasts 24 hours from the first personal flower; the local checkout recovery copy and private pending purchase use a bounded seven-day recovery window. Pending purchase rows are private and cleanup is not a source of authority for completed entitlements.

## Production dependencies

| Dependency | Current responsibility | Required configuration or access |
| --- | --- | --- |
| Vercel | Hosts Next.js pages and server routes, injects runtime secrets, serves CDN caches, records runtime logs, auto-deploys `main` through Git integration | Project access; production env access; domain/DNS access; deployment rollback access |
| Supabase Database | Canonical public plants, ten-minute snapshots, idempotent action records, health aggregates, memberships, entitlements, Care, My Garden, and feedback | Project access; migrations; `NEXT_PUBLIC_SUPABASE_URL`; public client key; server-only service-role key |
| Supabase Auth | Email/password identity, verification/recovery tokens, sessions | Auth dashboard access; permitted redirect URLs; password/security settings |
| Resend | Sends custom Basil signup, verification, and password-recovery email | `RESEND_API_KEY`; verified `send.bygoetz.com` sender; `BASIL_AUTH_FROM_EMAIL`; optional reply-to |
| Stripe | One-time $6.99 USD Checkout and authoritative paid status | Production account access; `STRIPE_SECRET_KEY`; `STRIPE_WEBHOOK_SECRET`; webhook endpoint; refunds/disputes access |
| Meta | Browser PageView and selected funnel events plus server-authoritative Purchase | Portfolio `Thomas R Goetz` (`314343197818474`), Page `Goetz` (`156574785247266`), active `ByGoetz Website Pixel` (`1421445296116963`), selected portfolio-owned ByGoetz launch ad account `555175360336933`; personal account `67385321` is not selected for this launch |
| GitHub | Source control; pushes to `main` trigger Vercel production | Repository/admin access; branch/deploy discipline |
| Browser storage | Temporary guest preview, verification-pending state, onboarding, camera/zoom/tool restoration | Same browser profile, storage available, seven-day checkout transfer window |

The repository currently references these environment variable names without committing their values:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `BASIL_AUTH_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `BASIL_ADMIN_EMAILS`
- `NEXT_PUBLIC_META_PIXEL_ID`

## Current analytics and Meta events

### First-party operational monitoring

Basil has a restricted account-menu health panel for configured admin emails. Server-only Supabase tables record coarse sessions, device class, health pulses, snapshot/action counts, failures, durations, and the complete anonymous launch funnel. A random launch-session ID preserves first-touch UTM and available Meta click attribution through account verification and Stripe without storing account email in the funnel records.

The project does not currently include Vercel Web Analytics or Speed Insights packages.

### Meta implementation in source

Phase 3 scopes the conditional Meta Pixel to the exact Basil game route. It maps PageView, ViewContent, CompleteRegistration, InitiateCheckout, Purchase, and four selected gameplay milestones. Conversions API Purchase originates only after verified Stripe fulfillment and uses the same opaque event ID as the browser for deduplication. A private Supabase delivery ledger prevents duplicate webhook, claim, refresh, and retry delivery. The production Pixel ID, explicit browser/server flags, and server-only access token are configured; the remaining activation gate is Meta Test Events verification described in `docs/basil-launch-phase-3.md`.

## Known production risks

Ordered by launch impact:

1. **Meta activation is not yet end-to-end verified.** Production Pixel/CAPI credentials and server-authoritative Purchase code are configured, but the Meta Test Events gate and one controlled paid-flow check must be completed before ads start.
2. **Required customer-facing policies are incomplete.** Basil needs specific Privacy, Terms, Refund, Support, and Account Deletion surfaces before ads direct strangers into account creation and payment.
3. **External conversion is not validated.** The two current membership records may be owner/test records; they do not establish cold-audience conversion or support readiness.
4. **Historical action errors need a clean observation window.** Seven-day Vercel history includes 33 `Unknown error` community-action failures across three estimated users on an older deployment and two `23505` planting conflicts on another older deployment. The current baseline deployment had no error-level runtime logs at audit time, but it had been live for less than one hour.
5. **Guest restoration is device-local.** Cross-device verification works for the account, but the original preview is recoverable only from the browser profile that stored it unless a later phase adds a server-side temporary session.
6. **Auth hardening is incomplete.** Supabase's leaked-password protection advisor is currently disabled. The app requires ten characters but does not yet have the additional compromised-password check.
7. **Capacity targets are estimates, not load-test results.** The cached-snapshot architecture is designed for many readers, but the current Supabase plan and true action throughput have not been validated at launch traffic levels.
8. **Operational ownership is not fully resolved.** Meta Business, Page, Pixel, and launch ad account are recorded; domain ownership, remaining dashboard access, support ownership, and incident contacts still require manual confirmation.
9. **The repository has two deployment stories.** Vercel Git integration is the real dynamic production host, while a GitHub Pages static-export workflow and README remain in the repository. This can confuse release ownership and is unsuitable for Basil API routes.
10. **No independent client-performance analytics.** The private health system observes server operations but does not yet report real-user Core Web Vitals or client rendering failures.
11. **The dedicated domain is not owned or configured.** Basil metadata, auth return links, Resend copy, Stripe returns, and canonical URLs all currently use `bygoetz.com`.

Supabase security advisors also report informational `RLS enabled, no policy` notices for server-only tables. In the current design this is deliberate: browser grants are revoked and only the service role is granted table access. Those notices should be rechecked whenever access patterns change.

## Remaining launch phases

### Phase 1 - First-party funnel measurement

Create a privacy-conscious, idempotent funnel event pipeline with an anonymous launch session ID, UTM/referrer persistence, device/campaign aggregates, and a private launch-health view. Do not send raw passwords, verification tokens, payment details, or unnecessary PII.

Gate: an incognito guest-to-purchase test preserves attribution across verification and Stripe; milestone events do not duplicate; the private panel reports the funnel; no PII appears in event metadata.

### Phase 2 - Customer trust and account control

Publish Basil-specific Privacy, Terms, Refund, Support, and Account Deletion pages; link them from account creation, membership, checkout entry, and the menu. Implement a recoverable deletion workflow that removes private account/My Garden data while defining how anonymous public contributions are retained.

Gate: every page is public, accurate, mobile-readable, and linked; support/refund ownership is confirmed; a test account can be deleted without exposing or orphaning private data.

### Phase 3 - Meta measurement

Activate the production Pixel and Conversions API. Map useful browser milestones, use a shared event ID for deduplication, and send `Purchase` only from authoritative paid fulfillment with value `6.99` and currency `USD`.

Gate: Meta Test Events shows PageView, key funnel milestones, InitiateCheckout, CompleteRegistration, and exactly one deduplicated Purchase for a test order; canceled/unpaid sessions never purchase.

### Phase 4 - Dedicated domain

Attach the owned domain to the existing Vercel project without creating a second app or database. Keep the current URL working. Add a Basil-specific canonical base URL and update metadata, Supabase redirects, Resend links/copy, Stripe returns, origin validation, Meta domain verification, and policy links.

Gate: the full guest, verification, sign-in, cancel, purchase, fulfillment, and restoration path succeeds on the new domain; the old route remains safe; unknown redirect origins are rejected.

### Phase 5 - Reliability and device verification

Add automated guest-onboarding and paid-funnel tests, structured failure monitoring, and focused phone/tablet/desktop checks. Test clean storage, slow networks, cross-tab verification, duplicate callbacks, cancel/success returns, snapshot reconciliation, and temporary disconnects. Use local or disposable load environments instead of burdening the production Supabase free tier.

Gate: 20 clean automated guest runs, 10 complete test payment flows, and 72 hours without unexplained critical errors on the candidate deployment.

### Phase 6 - Uncoached external beta

Invite approximately 20 unrelated testers through ordinary social channels. Observe behavior without coaching and record the funnel instead of adding features mid-test.

Gate: at least 15 load successfully, 12 plant once, 8 complete three community plants, 6 enter My Garden, 4 reach the paywall, no more than one person encounters a blocking failure, and at least one unrelated voluntary purchase is the preferred proof point.

### Phase 7 - Ad package

Produce three honest gameplay-first creative concepts in 9:16, 4:5, and 1:1 formats with controlled UTMs. Prepare one campaign, one ad set, and a written stop/continue rule. Do not imply features that are not live.

Gate: every creative lands on the verified domain, attribution survives the full funnel, copy matches the $6.99 one-time offer, and technical/policy checks pass.

### Phase 8 - First Meta research test

Run a US-only Meta Sales campaign optimized for the authoritative Purchase event, broad Advantage+ audience/placements, ages 24-54, all genders, one ad set, and three to four creatives. Spend $10-15 per day with the owner-approved hard total cap of $150.

Gate: spend never exceeds the owner-approved cap; purchases reconcile between Stripe, Supabase, first-party events, and Meta; pause immediately for duplicate purchases, broken verification, lost guest work, entitlement failures, or major device breakage.

### Phase 9 - Improve one measured bottleneck

Change only the largest measured drop-off: creative click-through, first load, first plant, tutorial completion, My Garden entry, paywall comprehension, account verification, checkout, or return restoration.

Gate: one hypothesis, one change set, and a before/after measurement. Do not bundle unrelated gameplay additions into launch optimization.

### Phase 10 - PWA and stores, after web proof

First add a careful installable PWA if retention warrants it. Do not cache authenticated mutations or checkout as offline writes. Evaluate Steam after the web loop supports meaningful repeat sessions; evaluate Apple/Google stores only after web demand justifies native billing, review, privacy, and maintenance obligations.

Gate: retained web users and measured demand justify the platform cost. App-store work is not part of the initial launch.

## Change-control rule

Until the first measured ad test is complete, a launch phase may fix a blocker discovered by its gate, but it should not introduce unrelated gameplay, economy, map, art, or monetization changes. Update [the launch checklist](./basil-launch-checklist.md) after each phase with the date, owner, evidence, commit, deployment, and outstanding blockers.
