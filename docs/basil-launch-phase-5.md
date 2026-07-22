# Basil Launch Phase 5 - reliability evidence

Date: July 22, 2026  
Status: local reliability work complete; external gates remain open

## What was added

- The production guest-garden checkout normalizer is now isolated in a dependency-free module so the exact storage boundary can be tested without Supabase or Stripe credentials.
- `tests/basil-phase5-reliability.test.ts` exercises 20 valid guest previews, duplicate-tile normalization, malformed payload rejection, payment-fulfillment SQL contracts, ten repeated fulfillment returns, Care limits, and the 30/90/365-day commons matrix.
- `scripts/basil-load-test.mjs` is a production-blocked load harness. Its default safe mode uses an in-process target; remote use requires an explicit disposable-project acknowledgement. It will always refuse Basil and ByGoetz production hostnames.
- `scripts/basil-browser-check.mjs` checks clean Edge contexts at phone, tablet portrait, tablet landscape, and desktop sizes.

No production database rows, paid Stripe sessions, customer emails, or live Meta events are created by these tests.

## Local results

### Reliability contracts

- 7 of 7 Phase 5 reliability tests passed.
- All 20 guest preview cases preserved plants, paths, and Care.
- Duplicate plant/path coordinates were normalized deterministically.
- Invalid or oversized preview payloads were rejected.
- The authoritative webhook still verifies the Stripe signature.
- The database fulfillment path still locks the pending purchase, upserts the unique provider purchase, and preserves the first `garden_saved_at` timestamp.
- Ten modeled repeat returns converged on one provider purchase and one garden import.

The repeated-return case is a deterministic contract test of the production uniqueness rules. It is not a claim that ten live Stripe charges were created.

### Time-compressed commons matrix

The matrix covers 30, 90, and 365 days; 10, 50, 250, and 1,000 persistent contributors; and casual, regular, intense, and bot-like action patterns. All 48 scenarios maintained:

- no more than 600 Care awarded per player-day;
- no more than 3,000 processed mutations per anonymous actor-day;
- no more than 25,600 occupied map tiles;
- a long-run 100-plant public footprint per persistent contributor.

At 250 persistent contributors, the long-run footprint projection is 25,000 plants, so the existing 65% expansion warning is intentionally reached well before physical capacity. This is a conservative steady-state projection; it does not measure database latency.

One useful finding: 3,000 ordinary one-Care actions currently produce about 500 Care because the final 400-to-600 tier requires one Care per 20 actions. The 600 setting is a ceiling reachable faster through legitimate multi-flower/special rewards, not a promise that ordinary single-target play always reaches 600.

### Safe load-harness validation

| Workers | Requests/second | P95 | Errors | Duplicate replay checks |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 50.02 | 16.29 ms | 0 | 5 |
| 20 | 193.52 | 32.61 ms | 0 | 20 |
| 50 | 432.90 | 56.70 ms | 0 | 50 |

These numbers validate the runner and its idempotent mock target only. They are not Supabase capacity numbers and must not be used in advertising or production sizing.

### Device first render

Fresh browser contexts passed at 390x844, 820x1180, 1180x820, and 1440x1000. In every case Basil, Inventory, and My Garden controls were present after a refresh, no framework error overlay appeared, no unexpected horizontal overflow was detected, and no product console error remained. This used headless Microsoft Edge/Chromium. Real iPad Safari and desktop Safari remain manual gates.

## Remaining completion gates

The following require an external test environment, time, a real browser/device, or a real payment and are intentionally not represented as completed:

1. Run the load harness against a disposable Supabase/Vercel test deployment at 5, 20, and 50 workers while watching database CPU, connections, slow queries, snapshot latency, and action P95.
2. Run 20 complete uncoached UI onboarding flows, not just guest-state boundary tests.
3. Run 10 complete Stripe test-mode checkout, fulfillment, and restoration flows against a non-production stack.
4. Confirm one real $9.99 Meta Test Events purchase creates one deduplicated Purchase.
5. Test real iPad Safari, desktop Safari, cross-tab email verification, slow network, temporary disconnect, checkout cancel, and successful return.
6. Observe the release candidate for 72 hours without an unexplained critical error.

Do not upgrade Supabase merely to run the local suite. Upgrade or create the disposable environment immediately before the measured database load run so paid time is not wasted.
