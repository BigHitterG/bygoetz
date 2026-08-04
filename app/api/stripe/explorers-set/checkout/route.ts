import { after, NextRequest, NextResponse } from "next/server";
import {
  getExplorersCheckoutMetaEventId,
  sendExplorersInitiateCheckoutConversion,
} from "@/lib/analytics/explorersMetaServer";
import { explorerProducts } from "@/lib/explorers/products";
import {
  explorerOrderQuantities,
  getExplorerOrderPrice,
  getExplorerSetOption,
  type ExplorerFrameColor,
  type ExplorerOrderQuantity,
} from "@/lib/explorers/buildASet";
import { getExplorerSetStripeConfiguration } from "@/lib/explorers/buildASetStripe";
import { EXPLORERS_PHYSICAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequest = {
  selectedSlugs?: unknown;
  optionId?: unknown;
  quantity?: unknown;
  frameColor?: unknown;
};

const frameColors: ExplorerFrameColor[] = ["natural", "black", "white"];

function getClientIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function getSourceUrl(request: NextRequest, origin: string) {
  const fallback = `${origin}/explorers/build-a-set`;
  const referer = request.headers.get("referer");
  if (!referer) return fallback;
  try {
    const url = new URL(referer);
    return url.origin === origin && url.pathname.startsWith("/explorers/")
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  let payload: CheckoutRequest;

  try {
    payload = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const quantity = explorerOrderQuantities.includes(
    payload.quantity as ExplorerOrderQuantity,
  )
    ? (payload.quantity as ExplorerOrderQuantity)
    : null;
  const selectedSlugs = Array.isArray(payload.selectedSlugs)
    ? payload.selectedSlugs.filter((slug): slug is string => typeof slug === "string")
    : [];
  const uniqueSlugs = [...new Set(selectedSlugs)];
  const option =
    typeof payload.optionId === "string"
      ? getExplorerSetOption(payload.optionId)
      : null;
  const selectedProducts = uniqueSlugs
    .map((slug) => explorerProducts.find((product) => product.slug === slug))
    .filter((product): product is (typeof explorerProducts)[number] => Boolean(product));
  const requestedFrameColor = frameColors.includes(
    payload.frameColor as ExplorerFrameColor,
  )
    ? (payload.frameColor as ExplorerFrameColor)
    : "natural";

  if (
    !quantity ||
    uniqueSlugs.length !== quantity ||
    selectedProducts.length !== quantity ||
    !option
  ) {
    return NextResponse.json(
      { error: "Choose one or three valid artworks and one product option." },
      { status: 400 },
    );
  }

  const configuration = getExplorerSetStripeConfiguration();
  if (!configuration.checkoutConfigured) {
    return NextResponse.json(
      { error: "Physical artwork checkout is not configured yet." },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const sourceUrl = getSourceUrl(request, origin);
  const metaFbp = request.cookies.get("_fbp")?.value;
  const metaFbc = request.cookies.get("_fbc")?.value;
  const clientIpAddress = getClientIpAddress(request);
  const clientUserAgent = request.headers.get("user-agent");
  const artworkTitles = selectedProducts.map((product) => product.title);
  const price = getExplorerOrderPrice(option, quantity);
  const frameColor = option.format === "Framed" ? requestedFrameColor : "none";
  const finishDescription =
    option.format === "Framed"
      ? frameColor +
        " frame, " +
        (option.isMatted ? "white mat, " : "no mat, ") +
        "optical-grade clear acrylic"
      : "archival print only, unframed";
  const orderName =
    quantity === 3
      ? "Explorers Gallery Wall - Set of 3"
      : "Explorers Art Print - Single";
  const orderDescription =
    artworkTitles.join(", ") +
    ". " +
    option.artworkSize +
    "; " +
    option.finishedSize +
    "; " +
    finishDescription +
    ".";
  const metadata = {
    order_type: EXPLORERS_PHYSICAL_ORDER_TYPE,
    selected_artworks: artworkTitles.join(" | "),
    selected_slugs: uniqueSlugs.join(","),
    print_option: option.id,
    print_option_label: option.label,
    artwork_size: option.artworkSize,
    finished_size: option.finishedSize,
    format: option.format,
    matted: option.isMatted ? "yes" : "no",
    frame_color: frameColor,
    acrylic: option.format === "Framed" ? "optical-grade clear acrylic" : "none",
    set_size: String(quantity),
    meta_source_url: sourceUrl.slice(0, 500),
    ...(metaFbp ? { meta_fbp: metaFbp } : {}),
    ...(metaFbc ? { meta_fbc: metaFbc } : {}),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: price.totalPriceCents,
          product_data: {
            name: orderName,
            description: orderDescription,
            metadata,
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    shipping_address_collection: {
      allowed_countries: configuration.allowedCountries,
    },
    shipping_options: configuration.shippingRateId
      ? [{ shipping_rate: configuration.shippingRateId }]
      : [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: configuration.shippingAmountCents,
                currency: "usd",
              },
              display_name: "Standard shipping",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 3 },
                maximum: { unit: "business_day", value: 8 },
              },
            },
          },
        ],
    success_url:
      origin +
      "/explorers/build-a-set/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/explorers/build-a-set?checkout=cancelled#builder",
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  const metaEventId = getExplorersCheckoutMetaEventId(session.id);
  after(async () => {
    await sendExplorersInitiateCheckoutConversion({
      stripeSessionId: session.id,
      sourceUrl,
      value: price.totalPriceCents / 100,
      currency: "usd",
      artworkSlugs: uniqueSlugs,
      optionId: option.id,
      frameColor,
      fbp: metaFbp,
      fbc: metaFbc,
      clientIpAddress,
      clientUserAgent,
    });
  });

  return NextResponse.json({
    url: session.url,
    metaEventId,
  });
}

