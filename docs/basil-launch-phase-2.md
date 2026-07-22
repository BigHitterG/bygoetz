# Basil Launch Phase 2: trust, privacy, support, and deletion

Implementation date: July 21, 2026  
Launch scope: United States web test  
Status: implemented; policy language remains subject to owner approval and optional legal review

## Audited data map

| Area | Data handled | System | Account-linked? | Current retention/control |
| --- | --- | --- | --- | --- |
| Community Garden | Plant/tile actions, timestamps, anonymous garden session, reward receipts | Supabase | No public identity or email on canonical plants | Canonical garden data may remain after account deletion |
| Private account | Email, password credential hash, verification and session records | Supabase Auth | Yes | Until account deletion; sessions revoked during deletion |
| My Garden | Plants, paths, objects, Care balance/ledger, expansion state | Supabase | Yes, through `garden_stewards` | Cascades when the Auth user is deleted |
| Feedback | Category, message, review status | Supabase | Yes | Cascades when the account is deleted |
| Membership | Entitlement, Stripe object IDs, amount, currency, purchase status/time | Supabase and Stripe | Yes | Basil entitlement cascades; Stripe retains payment records under its own obligations |
| Checkout recovery | Guest preview, email, claim hash, Stripe IDs, hashed request address | Supabase and a secure cookie | Temporarily | Seven-day expiry; matching rows are deleted during account deletion |
| Account email | Destination email and delivery status | Resend | Yes | Provider delivery records; Basil rate-limit hashes are cleaned after approximately seven days |
| Launch funnel | Random launch session, first-touch UTM/referrer/landing data, `fbclid` when present, allowlisted milestones, device class | Supabase and browser storage | No email/account join | Browser session 90 days; raw server funnel 180 days |
| Health/security | Coarse device/action/failure counts, latency, request/browser/network logs, hashed rate-limit keys | Supabase and Vercel | Not exposed as player history | Operational need and provider settings |

Meta Pixel and Conversions API are not active in Phase 2. The UI component now requires both a Pixel ID and the explicit `NEXT_PUBLIC_META_TRACKING_ENABLED=true` switch, which is intentionally not enabled. Existing first-party funnel analytics remain active.

## Account deletion boundary

The signed-in player must:

1. Enter the current password again, producing a newly issued Supabase access token.
2. Type `DELETE MY GARDEN` exactly.
3. Submit a same-origin deletion request within five minutes of reauthentication.

The server then:

1. Creates a server-only deletion audit using an irreversible HMAC fingerprint, not the email or raw user ID.
2. Removes matching pending checkout/preview rows.
3. Globally revokes Supabase refresh sessions.
4. Hard-deletes the Auth user. Existing `ON DELETE CASCADE` relationships remove the steward, entitlement, feedback, My Garden, progress, and private Care ledger records. Care receipts become anonymous through `ON DELETE SET NULL`.
5. Checks the canonical Community Garden plant count before and after the request and records a coarse warning if the count changed during the request.
6. Clears the pending checkout cookie and the client clears private account/preview browser storage.

`community_garden_plants` has no account/steward foreign key and is never targeted by deletion. Anonymous public contributions therefore remain part of the shared landscape.

If a server step fails, the endpoint returns a recovery reference. The audit retains only the HMAC fingerprint, stage, and coarse error code so Support can identify a retry without retaining deleted identity data.

## Public routes

- `/community-garden/privacy`
- `/community-garden/terms`
- `/community-garden/refunds`
- `/community-garden/support`
- `/community-garden/delete-account`

The routes are linked from the Garden menu, Account experience, membership/signup offer, and every policy-page footer. Their public URLs can be reused in future app-store listings.

## Validation record

- TypeScript: passed
- ESLint: passed with one pre-existing Explorers ref-cleanup warning
- Next.js production build: passed; all five public routes prerendered and deletion API compiled
- Public policy routes: HTTP 200; draft notice and complete policy navigation present
- Signed-out deletion request: HTTP 401 with recovery guidance
- Cross-origin deletion request: HTTP 403
- Meta network markup: absent with the Phase 2 activation flag disabled
- Supabase migration: applied; RLS enabled; `anon` and `authenticated` have no table privileges; `service_role` has server access
- Database relationship audit: private garden/account relationships cascade; reward receipts anonymize; canonical community plants have no account relationship
- Supabase security/performance advisors: no new actionable error. Expected informational notices exist for intentionally server-only RLS tables and newly unused indexes.

## Manual owner gate

Before paid ads, the owner should:

- approve or revise every policy page and obtain legal review if desired;
- confirm the preferred public support channel;
- create a disposable, non-owner Basil test account, place My Garden content and feedback, delete it, then confirm sign-in fails and Community Garden totals remain healthy;
- confirm a real refund request can be received through the published Support path.

Headless Chrome could not start inside the restricted Windows sandbox, so the responsive
CSS and static output were reviewed locally but the owner-visible mobile pass remains an
explicit manual gate rather than being represented as complete.
