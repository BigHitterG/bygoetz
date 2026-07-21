# Basil launch checklist

Companion document: [Basil launch roadmap](./basil-launch-roadmap.md)  
Last updated: July 21, 2026  
Current phase: Phase 0 - Establish the launch baseline

Use this file as the manual source of truth. Mark an item complete only when its owner has verified it and add evidence that does not contain secrets. Never record passwords, private API keys, payment details, verification tokens, or service-role credentials here.

## Launch decisions

- [x] Initial advertised market is US-only.
- [x] Garden Membership price is frozen at a one-time $6.99 for the first measured test.
- [x] Owner accepts an initial Meta research budget capped at $150.
- [x] Owner accepts that the initial budget is research money and is not guaranteed profit.
- [x] No app-store launch is included in the first web test.
- [x] No unrelated gameplay work is included in Phase 0.

## External ownership and access

| System | Status | Evidence or non-secret identifier | Owner / next action |
| --- | --- | --- | --- |
| `basilcommunitygarden.com` | Not confirmed owned. Available for $11.25/year through Vercel at audit time. | `https://vercel.com/domains/search?q=basilcommunitygarden.com` | Owner purchases at normal price; do not attach or redirect yet. |
| Meta Business Portfolio | Not verified | Business name/ID: `_____` | Owner confirms administrator access. |
| Facebook Page for Basil or By Goetz | Not verified | Page name/ID: `_____` | Owner chooses the launch identity and confirms access. |
| Meta ad account | Not verified | Ad account name/ID: `_____` | Owner confirms billing/admin access. |
| Meta Events Manager dataset/Pixel | Not verified and not visibly active on production | Dataset/Pixel name/ID: `_____` | Owner confirms access; Phase 3 activates and tests it. |
| Stripe production account | Runtime is configured; dashboard access not manually confirmed in this audit | Account label/ID suffix: `_____` | Owner confirms live-mode, webhook, refund, and dispute access. |
| Vercel project | Confirmed | `bygoetz`, `prj_MXqx7eJDGtvK0XOOB80zVSUnTxdo` | Keep owner/admin and rollback access current. |
| Supabase project | Confirmed healthy | `bygoetz`, `qripkmzrujarmmbgewub` | Keep database/Auth access current. |
| Resend account | Runtime email integration exists; dashboard access not manually confirmed in this audit | Account/domain: `send.bygoetz.com` | Owner confirms sender-domain and delivery-log access. |
| GitHub repository | Confirmed | `BigHitterG/bygoetz` | Keep repository/admin access current. |

The owner reported that Meta Ads is open in the ChatGPT browser. That confirms a session is available to the owner, but Phase 0 remains open until the exact Portfolio, Page, ad account, and dataset/Pixel above are identified.

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
- [ ] Confirm the exact Meta business, Page, ad account, and dataset/Pixel.
- [ ] Confirm Stripe, Vercel, Supabase, Resend, and GitHub owner/admin access.
- [x] Enter and accept the $150 initial research budget.
- [x] Confirm the $6.99 price freeze and US-only scope with the launch owner.

Phase 0 completion date: `_____`  
Owner approval: `_____`  
Evidence/notes: `_____`

## Phase 1 - First-party funnel measurement

- [ ] Create a stable anonymous launch session ID without PII.
- [ ] Preserve UTMs, referrer, landing path, and supported click IDs through verification and Stripe.
- [ ] Record allowlisted, idempotent funnel milestones server-side.
- [ ] Add aggregated campaign/device funnel counts to the private health panel.
- [ ] Add retention and bounded-metadata rules.
- [ ] Verify no password, email, token, payment detail, or garden text leaks into event metadata.
- [ ] Verify incognito, refresh, verification, cancel, success, and duplicate callback paths.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 2 - Privacy, terms, refunds, support, deletion

- [ ] Publish Basil Privacy Policy.
- [ ] Publish Basil Terms.
- [ ] Publish one-time digital membership Refund Policy.
- [ ] Publish Support/contact page with response owner.
- [ ] Publish Account Deletion instructions and implement the secure workflow.
- [ ] Link all pages from menu/account/signup/membership/purchase entry.
- [ ] Test mobile readability and deletion recovery/failure behavior.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 3 - Meta Pixel and Conversions API

- [ ] Confirm the production Pixel/dataset ID.
- [ ] Confirm a server-only CAPI token in Vercel production configuration.
- [ ] Send standard PageView, ViewContent, CompleteRegistration, and InitiateCheckout where accurate.
- [ ] Send Purchase only from authoritative paid fulfillment with `$6.99 USD`.
- [ ] Deduplicate browser/server events with a shared event ID.
- [ ] Preserve selected Basil custom milestones.
- [ ] Confirm canceled, unpaid, refreshed, and duplicate sessions never create a false Purchase.
- [ ] Verify all events in Meta Test Events.

Gate evidence: `_____`  
Commit/deployment: `_____`  
Completion date: `_____`

## Phase 4 - Dedicated Basil domain

- [ ] Attach the owned domain to the existing Vercel project.
- [ ] Keep `www.bygoetz.com/community-garden` working.
- [ ] Add a Basil-specific canonical/site URL instead of repurposing global URL behavior.
- [ ] Update canonical and social metadata.
- [ ] Update Supabase Auth redirect allowlist.
- [ ] Update Resend links and copy.
- [ ] Update Stripe success/cancel URLs and origin validation.
- [ ] Verify the domain in Meta.
- [ ] Test signup, verification, recovery, cancel, success, fulfillment, and restoration on both entry URLs.

Gate evidence: `_____`  
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
- [ ] Prepare honest one-time-$6.99-offer creative.
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
Approved campaign/ad account: `_____`
