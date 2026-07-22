# Basil Launch Phase 3 — Meta measurement

Status: implementation-aligned operating record. Policy language remains an owner/legal-review draft.

## Scope

Meta tracking is limited to the exact `/community-garden` game route. Other By Goetz pages, Explorers, Basil policy pages, and support pages do not load this Basil Pixel implementation.

Browser events:

- `PageView` once per Basil launch session
- `ViewContent` once when the Community Garden becomes usable
- `CompleteRegistration` once after Supabase verifies the account
- `InitiateCheckout` once after Stripe successfully creates or recovers a Checkout Session
- `Purchase` once on a verified successful return, paired to the server event
- `BasilFirstPlant`
- `BasilCommunityTutorialCompleted`
- `BasilMyGardenEntered`
- `BasilPaywallViewed`

The browser does not send every watering, planting, tile, orientation, restore, or email-delivery event to Meta.

## Authoritative Purchase

Stripe webhook and claim fulfillment both use the same paid-session validation and the same server delivery function. Purchase requires:

- Basil Garden Membership order type
- Stripe `payment_status=paid`
- exactly 699 cents
- `usd`
- successful entitlement/garden persistence

The Purchase `event_id` is a deterministic, opaque hash of the Stripe Checkout Session ID. The browser receives only this event ID after successful fulfillment. Supabase atomically claims a private delivery-ledger row before Conversions API delivery; duplicate webhooks, claim callbacks, return refreshes, and delivery retries cannot create a second logical purchase. A failed delivery remains retryable without blocking paid membership fulfillment.

## Production environment

Public build-time values:

- `NEXT_PUBLIC_META_PIXEL_ID=1421445296116963`
- `NEXT_PUBLIC_META_TRACKING_ENABLED=true`

Server-only values:

- `META_CONVERSIONS_API_ENABLED=true`
- `META_CONVERSIONS_API_TOKEN` — generated in Meta Events Manager; never committed
- `META_GRAPH_API_VERSION=v25.0`
- `META_TEST_EVENT_CODE` — temporary during Test Events validation; remove after validation

The access token must exist only in Vercel Production environment variables. Never prefix it with `NEXT_PUBLIC_`.

## Privacy and matching

Server Purchase sends value/currency, a SHA-256-normalized email hash, an opaque launch-session hash, and an `fbc` value only when a Meta click ID was captured on first arrival. Raw email, Stripe IDs, verification tokens, passwords, cards, garden contents, and arbitrary metadata are not sent to Meta. The private delivery ledger stores no token, email, Meta response body, or payment detail.

## Required Meta Test Events check

1. Open Events Manager for `ByGoetz Website Pixel` (`1421445296116963`).
2. Add its temporary Test Event code to Vercel Production as `META_TEST_EVENT_CODE`.
3. Visit a clean Basil URL with UTM fields and the Test Events browser connection active.
4. Confirm one each of PageView, ViewContent, the four selected tutorial events, CompleteRegistration, and InitiateCheckout.
5. Complete a $6.99 test purchase and confirm browser/server Purchase share the event ID and deduplicate to one purchase.
6. Cancel a separate checkout and confirm no Purchase.
7. Refresh the successful return and confirm no additional Purchase.
8. Remove `META_TEST_EVENT_CODE` and redeploy after validation.
