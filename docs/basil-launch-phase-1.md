# Basil launch Phase 1: first-party funnel measurement

Implemented: July 21, 2026  
Scope: anonymous first-touch measurement only; no gameplay, paywall, price, or Meta Conversions API changes

## Session and attribution model

Each browser profile receives a random UUID `launch_session_id`. It is separate from Basil's signed public-garden actor cookie and is never displayed. The browser stores it in `localStorage` for 90 days, so it survives refreshes, account creation, email verification, Stripe Checkout, and return to the garden in the same browser profile.

First-touch attribution is captured once:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`
- `fbclid`, stored as the available Meta click identifier
- referring hostname only
- original landing pathname only
- first arrival timestamp

The client and server reject control characters and email-like attribution. No query string beyond the allowlisted UTM and Meta fields is stored.

## Event dictionary

| Event | Meaning |
| --- | --- |
| `session_started` | A new or returning anonymous launch session opened Basil. |
| `garden_loaded` | The garden reached a usable loaded state. |
| `inventory_opened` | The inventory was opened. |
| `plant_selected` | A plant type was selected. |
| `first_community_plant` | The onboarding/community planting count reached one. |
| `third_community_plant` | The onboarding/community planting count reached three. |
| `my_garden_entered` | The visitor entered My Garden. |
| `first_personal_plant` | The visitor planted the first preview flower. |
| `preview_limit_reached` | The three-flower preview limit was reached. |
| `paywall_viewed` | The existing Garden Membership offer became visible. |
| `signup_started` | The private account signup form was submitted. |
| `verification_sent` | Basil accepted a verification or resend request. |
| `verification_completed` | Supabase verified the email link and returned a session. |
| `checkout_started` | Basil began creating a Stripe Checkout session. |
| `checkout_canceled` | Stripe returned to Basil through the cancel path. |
| `purchase_completed` | Authoritative Stripe fulfillment confirmed a paid $6.99 membership. |
| `garden_restoration_failed` | A saved guest preview could not yet be imported. |
| `garden_action_failed` | A public or personal garden action failed. |

All milestones are unique per launch session. The two failure events are repeatable so reliability totals remain useful. Client-generated event UUIDs and database uniqueness make refreshes, retries, webhook/claim duplication, and repeated callbacks idempotent. Stripe fulfillment also uses a unique `stripe:{checkout_session_id}` source key.

## Privacy and access controls

- No name, email, password, account ID, verification token, card detail, Stripe customer/payment ID, garden coordinate, free-form text, or public plant identity is accepted.
- Failure metadata permits only `failure_stage` and `error_code`, each capped at 80 characters.
- The endpoint body is capped at 4 KB and accepts only the event allowlist.
- Database writes are capped at 40 browser events per launch session per minute.
- All four funnel tables have RLS enabled, no browser policies, and no `anon` or `authenticated` table grants.
- Only the server-side `service_role` can execute the recording and aggregate dashboard functions.
- The health dashboard exposes aggregate counts only; it cannot browse individual sessions.

## Retention

The browser rotates the anonymous launch session after 90 days. Raw database sessions and events are retained for 180 days. The recording function claims a daily maintenance lock, deletes rate buckets older than two hours, and deletes launch sessions not seen for 180 days; their events cascade. This avoids requiring `pg_cron` on the current Supabase free project.

## Dashboard

The existing owner-only Garden Health panel now includes a rolling 30-day funnel with:

- unique sessions and ten conversion steps
- conversion percentage from each prior step
- device-class totals
- campaign and creative totals with purchases
- garden action, restoration, and checkout-cancel failures

The existing admin-email authorization remains unchanged.

## Verification record

- Migration: `basil_launch_funnel_measurement`
- Database transaction test: milestones insert once; repeatable failures insert more than once; all synthetic rows rolled back.
- Unsafe/free-form metadata is rejected by the server function and table constraints.
- RLS/grant query: `anon` and `authenticated` cannot select; `service_role` can select.
- Aggregate RPC returns the expected object and ten ordered steps.
- Supabase advisors were rerun after DDL. The four new `RLS enabled, no policy` INFO notices are intentional because these are server-only tables with browser grants revoked. New-index `unused_index` INFO notices are expected before launch traffic.

The production test must never complete a real card charge merely to verify analytics. `purchase_completed` is covered by the authoritative, idempotent Stripe fulfillment path and database transaction tests; a real test order remains part of the later launch-reliability gate.

