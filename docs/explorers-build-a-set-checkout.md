# Explorers gallery-wall checkout

The /explorers/build-a-set page supports one artwork or a discounted set of three.
All amounts are calculated from the server-owned catalog in
lib/explorers/buildASet.ts; browser-supplied prices are never trusted.

## Current catalog

| Option | One | Set of 3 |
| --- | ---: | ---: |
| 8x10 print | $29 | $73.95 |
| 8x10 framed, no mat | $65 | $165.75 |
| 8x10 framed with mat | $79 | $201.45 |
| 11x14 print | $39 | $99.45 |
| 11x14 framed, no mat | $89 | $226.95 |
| 11x14 framed with mat | $119 | $303.45 |

Sets of three receive 15% off. Framed orders offer natural, black, or white frames
and use optical-grade clear acrylic instead of glass.

## Stripe

Checkout uses Stripe-hosted Checkout and creates server-side price_data from the
catalog above. Dedicated Price IDs are not required. The Checkout Session and Payment
Intent metadata include:

- artwork names and slugs
- quantity
- artwork and finished dimensions
- print or framed format
- mat choice
- frame color
- acrylic specification

Required environment variables:

    STRIPE_SECRET_KEY
    STRIPE_EXPLORERS_SET_SHIPPING_RATE_ID
    STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES

If no shipping-rate ID is supplied, checkout uses
STRIPE_EXPLORERS_SET_SHIPPING_CENTS or defaults to $12 standard shipping.
Allowed countries default to US.

## Explorer-only Meta Pixel and Conversions API

Explorer commerce tracking is intentionally isolated from Basil. Do not reuse the
Basil Pixel ID, token, enable switches, event IDs, or delivery ledger.

Configure the dedicated Explorer dataset with:

    NEXT_PUBLIC_EXPLORERS_META_PIXEL_ID
    NEXT_PUBLIC_EXPLORERS_META_TRACKING_ENABLED=true
    EXPLORERS_META_CONVERSIONS_API_ENABLED=true
    EXPLORERS_META_CONVERSIONS_API_TOKEN
    EXPLORERS_META_GRAPH_API_VERSION=v25.0

During Events Manager verification only, set `EXPLORERS_META_TEST_EVENT_CODE` to
the code displayed by the Explorer dataset's Test Events screen. Remove it after
verification.

The Explorer Pixel is mounted only inside `/explorers`. Browser calls use
`trackSingle`/`trackSingleCustom` with the dedicated Pixel ID. Stripe checkout and
Purchase events are also delivered through the dedicated Explorer CAPI token, using
shared Explorer-prefixed event IDs for browser/server deduplication.

Tracked funnel events are PageView, ViewContent, CustomizeProduct,
InitiateCheckout, verified Purchase, and supporting builder interaction events.
Purchase is authoritative only after Stripe reports a paid physical Explorer order.

