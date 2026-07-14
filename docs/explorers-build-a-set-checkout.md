# Explorers Build-a-Set checkout configuration

The `/explorers/build-a-set` experience intentionally remains in preview mode until dedicated Stripe configuration exists. It must never reuse an individual artwork Price ID because fulfillment needs one set product and the selected artwork metadata.

## Stripe setup

Create one Stripe product for each of the four existing three-print options. Keep the existing per-print pricing and product details:

- Three 8x10 unmatted prints: $105 total
- Three 8x10 matted prints: $150 total
- Three 11x14 unmatted prints: $195 total
- Three 11x14 matted prints: $285 total

Add these Vercel environment variables:

```text
STRIPE_EXPLORERS_SET_8X10_PRINT_PRICE_ID
STRIPE_EXPLORERS_SET_8X10_MATTED_PRICE_ID
STRIPE_EXPLORERS_SET_11X14_PRINT_PRICE_ID
STRIPE_EXPLORERS_SET_11X14_MATTED_PRICE_ID
STRIPE_EXPLORERS_SET_SHIPPING_RATE_ID
STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES
```

`STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES` is a comma-separated list of countries the business already ships to, such as `US`. Do not add countries until the shipping policy is confirmed. The shipping rate must likewise reflect the real policy.

The only code-level Stripe mapping is in `lib/explorers/buildASetStripe.ts`. After adding the variables, redeploy Vercel. Checkout sessions will include the selected artwork names and slugs in both Checkout Session and Payment Intent metadata.

## Meta Pixel setup

Add the existing Meta Pixel ID as:

```text
NEXT_PUBLIC_META_PIXEL_ID
```

The implementation tracks PageView, ViewContent, ArtworkSelection, InitiateCheckout, and verified Purchase. Purchase only fires on the success page after the server retrieves a paid Stripe Checkout Session.

