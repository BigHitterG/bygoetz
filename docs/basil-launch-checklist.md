# Basil launch checklist

Companion document: [Basil launch roadmap](./basil-launch-roadmap.md)  
Last updated: July 21, 2026  
Current phase: Phase 1 - First-party funnel measurement

Use this file as the manual source of truth. Mark an item complete only when its owner has verified it and add evidence that does not contain secrets. Never record passwords, private API keys, payment details, verification tokens, or service-role credentials here.

## Launch decisions

- [x] Initial advertised market is US-only.
- [x] Garden Membership price is frozen at a one-time $9.99 for the first measured test.
- [x] Owner accepts an initial Meta research budget capped at $150.
- [x] Owner accepts that the initial budget is research money and is not guaranteed profit.
- [x] No app-store launch is included in the first web test.
- [x] No unrelated gameplay work is included in Phase 0.

## External ownership and access

| System | Status | Evidence or non-secret identifier | Owner / next action |
| --- | --- | --- | --- |
| `basilcommunitygarden.com` | Attached to the existing `bygoetz` project; SSL generation started July 22. | Vercel nameservers `ns1.vercel-dns.com` and `ns2.vercel-dns.com` | Confirm both certificates become valid after deployment. |
| Meta Business Portfolio | Confirmed read-only in Meta Business settings | `Thomas R Goetz` / `314343197818474` | Full-access owner account was visible. Keep this as the proposed Basil business owner. |
| Facebook Page for Basil or By Goetz | Confirmed read-only | `Goetz` / `156574785247266`, owned by `Thomas R Goetz` | Proposed launch Page. `GetzLab` is also accessible but is not the proposed Basil identity. |
| Meta ad account | Owner-selected | ByGoetz Ads Manager account `67385321`. Portfolio-owned alternative `555175360336933` is not selected. | Confirm billing and Page/Pixel permissions before Phase 3. |
| Meta Events Manager dataset/Pixel | Active portfolio Pixel confirmed; separate inactive dataset also found | Proposed: `ByGoetz Website Pixel` / `1421445296116963`, receiving Meta Pixel and Conversions API events. Separate: `Codex Connection` / `28293873963551687`, inactive and never received an event. | Use the active portfolio Pixel for Basil unless Phase 3 identifies a measured reason to create a dedicated Basil dataset. |
| Stripe production account | Runtime is configured; dashboard access not manually confirmed in this audit | Account label/ID suffix: `_____` | Owner confirms live-mode, webhook, refund, and dispute access. |
| Vercel project | Confirmed | `bygoetz`, `prj_MXqx7eJDGtvK0XOOB80zVSUnTxdo` | Keep owner/admin and rollback access current. |
| Supabase project | Confirmed healthy | `bygoetz`, `qripkmzrujarmmbgewub` | Keep database/Auth access current. |
| Resend account | Runtime email integration exists; dashboard access not manually confirmed in this audit | Account/domain: `send.bygoetz.com` | Owner confirms sender-domain and delivery-log access. |
| GitHub repository | Confirmed | `BigHitterG/bygoetz` | Keep repository/admin access current. |

The Meta assets above were inspected read-only in the owner's signed-in Meta session on July 21, 2026. No campaigns, drafts, billing, permissions, Pages, datasets, or tracking settings were changed. The owner selected current ByGoetz Ads Manager account `67385321` for launch; account `555175360336933` remains an unused alternative.

### Meta asset inventory

| Role | Proposed launch asset | Other observed asset | Launch note |
| --- | --- | --- | --- |
| Business owner | `Thomas R Goetz` portfolio (`314343197818474`) | `Tom G. - Design and Artwork` portfolio (`2251374908256334`) | Use the portfolio that owns the Goetz Page and active website Pixel. |
| Facebook identity | `Goetz` Page (`156574785247266`) | `GetzLab` Page was also accessible | Use `Goetz` for the existing By Goetz identity unless a Basil-specific Page is intentionally created later. |
| Advertising account | Selected | ByGoetz Ads Manager account `67385321` | Confirm billing, Page, Pixel, and permissions before launch. |
| Measurement | `ByGoetz Website Pixel` (`1421445296116963`) | `Codex Connection` (`28293873963551687`) was inactive | The proposed Pixel was visibly receiving events through both Meta Pixel and Conversions API. Production Basil still needs Phase 3 implementation and Test Events verification. |

## Phase 0 - Establish the baseline

- [x] Audit the repository before changing files.
- [x] Confirm the public URL returns HTTP 200.
- [x] Record the production commit: `373d0dc4bd22abb87666a1f2a27b1c397a41e95c`.
- [x] Record the production deployment: `dpl_CYrSjFxAwUnCh1fy4BbBVvyhcjg2`, `READY`.
- [x] Record Vercel, Supabase, Stripe, Resend, Auth, Meta, and browser-storage dependencies.
- [x] Document the complete guest-to-purchase and restoration funnel.
- [x] Document current Meta events and first-party operational monitoring.
- [x] Record current production risks without changing behavior.
- [x] Create the phased roadmap and this updateable checklist.
- [x] Confirm no gameplay, database, auth, payment, price, or visual behavior changed in Phase 0.
- [ ] Confirm the domain is owned.
- [x] Confirm the exact Meta business, Page, ad account, and dataset/Pixel. Launch ad account: `67385321`.
- [ ] Confirm Stripe, Vercel, Supabase, Resend, and GitHub owner/admin access.
- [x] Enter and accept the $150 initial research budget.
- [x] Confirm the $9.99 price freeze and US-only scope with the launch owner.

Phase 0 completion date: `_____`  
Owner approval: `_____`  
Evidence/notes: `_____`

## Phase 1 - First-party funnel measurement

- [x] Create a stable anonymous launch session ID without PII.
- [x] Preserve UTMs, referrer, landing path, and supported click IDs through verification and Stripe metadata.
- [x] Record allowlisted, idempotent funnel milestones server-side.
- [x] Add aggregated campaign/device funnel counts to the private health panel.
- [x] Add retention and bounded-metadata rules.
- [x] Verify no password, email, token, payment detail, or garden text leaks into event metadata.
- [ ] Verify incognito, refresh, verification, cancel, success, and duplicate callback paths.

Technical verification completed July 21, 2026: live route and endpoint, malformed-event rejection, unauthenticated checkout boundary, first-touch attribution, milestone idempotency, RLS/grants, aggregate RPC, build, and production runtime logs. A clean new-account verification plus real successful payment/restoration remains a manual gate; do not create a live charge solely for an automated analytics test.

Purchase-flow correction prepared July 21, 2026: guest previews are persisted server-side before immediate Stripe-hosted Checkout; payment confirmation provisions the entitlement, imports the preview idempotently, and only then sends the Basil verification/password-setup email. The measured preview now has a soft offer at three flowers, continued temporary play, a hard limit at ten, and a 24-hour active window. Manual gate remains a fresh paid test opened across two browsers, confirming up to ten preview plants, paths, and Care survive exactly once.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 2 - Privacy, terms, refunds, support, deletion

- [x] Publish Basil Privacy Policy.
- [x] Publish Basil Terms.
- [x] Publish one-time digital membership Refund Policy.
- [x] Publish Support/contact page with response owner.
- [x] Publish Account Deletion instructions and implement the secure workflow.
- [x] Link all pages from menu/account/signup/membership/purchase entry.
- [ ] Complete an owner-visible mobile readability pass and disposable signed-in deletion test.

Gate evidence: [Phase 2 audit and validation](./basil-launch-phase-2.md). Owner language approval and a disposable signed-in deletion test remain manual launch gates.
Commit/deployment: `_____`  
Completion date: `2026-07-21`

## Phase 3 - Meta Pixel and Conversions API

- [ ] Confirm the production Pixel/dataset ID.
- [ ] Confirm a server-only CAPI token in Vercel production configuration.
- [ ] Send standard PageView, ViewContent, CompleteRegistration, and InitiateCheckout where accurate.
- [ ] Send Purchase only from authoritative paid fulfillment with `$9.99 USD`.
- [ ] Deduplicate browser/server events with a shared event ID.
- [ ] Preserve selected Basil custom milestones.
- [ ] Confirm canceled, unpaid, refreshed, and duplicate sessions never create a false Purchase.
- [ ] Verify all events in Meta Test Events.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 4 - Dedicated Basil domain

- [x] Attach the apex and `www` hostnames to the existing Vercel project.
- [x] Keep `www.bygoetz.com/community-garden` implemented as a working compatibility route.
- [x] Keep the ByGoetz root/LazyGrid unchanged and route only the Basil hostname root to the game.
- [x] Add a Basil-specific canonical/site URL instead of repurposing global URL behavior.
- [x] Add production-only `NEXT_PUBLIC_BASIL_URL` while preserving `NEXT_PUBLIC_SITE_URL` for ByGoetz.
- [x] Update canonical and social metadata.
- [ ] Update Supabase Auth redirect allowlist.
- [x] Update Resend verification/recovery links and copy.
- [x] Update Stripe success/cancel URLs, cross-domain preview recovery, and strict origin validation.
- [ ] Verify the domain in Meta.
- [ ] Test signup, verification, recovery, cancel, success, fulfillment, and restoration on both entry URLs.

Gate evidence: Local exact-host routing passed for Basil and ByGoetz; unknown checkout Origin returned 403. See `docs/basil-launch-phase-4.md`; Supabase/Meta configuration and live paid-flow verification remain open.
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 5 - Reliability and device verification

- [ ] Run 20 clean automated guest onboarding flows.
- [ ] Run 10 complete test payment/fulfillment/restoration flows.
- [ ] Test phone, tablet portrait/landscape, desktop Chrome, and Safari where available.
- [ ] Test clean storage, slow network, refresh, rotation, cross-tab verification, and temporary disconnect.
- [ ] Test duplicate action IDs, duplicate callbacks, checkout cancel, and snapshot reconciliation.
- [ ] Separate expected tile conflicts from unexplained errors in monitoring.
- [ ] Observe the candidate for 72 hours without unexplained critical errors.
- [ ] Keep synthetic load off the production Supabase free tier; use local/disposable infrastructure.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 6 - Uncoached external beta

- [ ] Recruit approximately 20 unrelated testers through normal social channels.
- [ ] Give only the public URL; do not coach the interaction.
- [ ] At least 15 load successfully.
- [ ] At least 12 plant once.
- [ ] At least 8 complete three community plantings.
- [ ] At least 6 enter My Garden.
- [ ] At least 4 reach the paywall.
- [ ] No more than one blocking failure.
- [ ] At least 2 start account creation.
- [ ] Preferred proof: at least one unrelated voluntary purchase.

Gate evidence: `_____`  
Completion date: `_____`

## Phase 7 - Ad package

- [ ] Prepare shared-world creative.
- [ ] Prepare public-care-to-private-garden creative.
- [ ] Prepare honest one-time-$9.99-offer creative.
- [ ] Export 9:16, 4:5, and 1:1 variants using authentic gameplay.
- [ ] Assign controlled UTM values to each creative.
- [ ] Document one campaign, one ad set, three to four ads, budget, and stop rules.
- [ ] Confirm copy does not promise unavailable features.

Gate evidence: `_____`  
Asset location: `_____`  
Completion date: `_____`

## Phase 8 - First Meta research test

- [ ] Use Sales objective, Website destination, authoritative Purchase optimization.
- [ ] Target US, ages 24-54, all genders, Advantage+ audience/placements.
- [ ] Use one ad set and three to four creatives.
- [ ] Set `$_____/day` and enforce the approved $150 hard total cap.
- [ ] Reconcile spend/click/session/signup/checkout/purchase daily.
- [ ] Reconcile every purchase across Stripe, Supabase, first-party analytics, and Meta.
- [ ] Stop immediately for duplicate purchase, missing entitlement, lost guest state, broken verification, or major device failure.

Results: `_____`  
Completion date: `_____`

## Phase 9 - Improve one bottleneck

- [ ] Identify the largest measured funnel loss.
- [ ] Write one hypothesis and success metric.
- [ ] Implement one focused change set.
- [ ] Compare before/after results.
- [ ] Avoid unrelated gameplay additions during the experiment.

Hypothesis/results: `_____`  
Commit/deployment: `_____`

## Phase 10 - PWA and store decision

- [ ] Review retention and repeat-session data.
- [ ] Decide whether an installable PWA is justified.
- [ ] Ensure no authenticated mutation or checkout action is cached as an offline write.
- [ ] Evaluate Steam only after the web game supports a richer repeat loop.
- [ ] Evaluate Apple/Google stores only after native billing, policy, review, and maintenance costs are justified.

Decision/evidence: `_____`

## Pre-ad go/no-go

Do not spend against cold traffic until every launch-critical row is green.

| Check | State | Evidence |
| --- | --- | --- |
| Phase 0 manual gate complete | RED | `_____` |
| First-party funnel verified | RED | `_____` |
| Public policies/support/deletion live | RED | `_____` |
| Meta browser/server Purchase deduplicated | RED | `_____` |
| Dedicated domain full flow verified | RED | `_____` |
| Reliability gate passed | RED | `_____` |
| Uncoached beta gate passed | RED | `_____` |
| Creative/UTM package approved | RED | `_____` |
| Research budget and stop rule approved | RED | `_____` |

Final go/no-go owner: `_____`  
Decision/date: `_____`  
Approved campaign/ad account: `67385321` (ByGoetz)
