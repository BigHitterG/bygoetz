import { NextResponse } from "next/server";
import { explorerProducts } from "@/lib/explorers/products";
import { getExplorerSetOption } from "@/lib/explorers/buildASet";
import { getExplorerSetStripeConfiguration } from "@/lib/explorers/buildASetStripe";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequest = {
  selectedSlugs?: unknown;
  optionId?: unknown;
};

export async function POST(request: Request) {
  let payload: CheckoutRequest;

  try {
    payload = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const selectedSlugs = Array.isArray(payload.selectedSlugs)
    ? payload.selectedSlugs.filter((slug): slug is string => typeof slug === "string")
    : [];
  const uniqueSlugs = [...new Set(selectedSlugs)];
  const option = typeof payload.optionId === "string" ? getExplorerSetOption(payload.optionId) : null;
  const selectedProducts = uniqueSlugs
    .map((slug) => explorerProducts.find((product) => product.slug === slug))
    .filter((product): product is (typeof explorerProducts)[number] => Boolean(product));

  if (uniqueSlugs.length !== 3 || selectedProducts.length !== 3 || !option) {
    return NextResponse.json(
      { error: "Choose exactly three valid artworks and one print option." },
      { status: 400 },
    );
  }

  const configuration = getExplorerSetStripeConfiguration(option.id);
  if (
    !configuration.optionConfigured ||
    !configuration.priceId ||
    !configuration.shippingRateId
  ) {
    return NextResponse.json(
      { error: "The physical set checkout is not configured yet." },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const artworkTitles = selectedProducts.map((product) => product.title);
  const metadata = {
    order_type: "explorers_print_set",
    selected_artworks: artworkTitles.join(" | "),
    selected_slugs: uniqueSlugs.join(","),
    print_option: option.id,
    print_option_label: option.label,
    set_size: "3",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    line_items: [{ price: configuration.priceId, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
    shipping_address_collection: {
      allowed_countries: configuration.allowedCountries,
    },
    shipping_options: [{ shipping_rate: configuration.shippingRateId }],
    success_url: `${origin}/explorers/build-a-set/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/explorers/build-a-set?checkout=cancelled#builder`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}

