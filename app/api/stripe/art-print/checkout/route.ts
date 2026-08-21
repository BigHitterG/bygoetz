import { NextRequest, NextResponse } from "next/server";
import { getArtPrint } from "@/lib/art/prints";
import { ART_PRINT_ORDER_TYPE } from "@/lib/art/orderTypes";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequest = {
  slug?: unknown;
  quantity?: unknown;
};

const DEFAULT_SHIPPING_CENTS = 800;
const ART_PRINT_INTEGRATION_IDENTIFIER = "art_print_checkout_qmvkthza";

function getShippingAmountCents() {
  const parsed = Number.parseInt(process.env.ART_PRINT_SHIPPING_CENTS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100_000
    ? parsed
    : DEFAULT_SHIPPING_CENTS;
}

function getSiteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configured || new URL(request.url).origin;

  try {
    return new URL(candidate).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

function getSourceUrl(request: NextRequest, origin: string, canonicalPath: string) {
  const fallback = `${origin}${canonicalPath}`;
  const referer = request.headers.get("referer");
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    return url.origin === origin ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getCancelUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  url.searchParams.set("checkout", "cancelled");
  return url.toString();
}

export async function POST(request: NextRequest) {
  let payload: CheckoutRequest;

  try {
    payload = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  if (typeof payload.slug !== "string" || payload.quantity !== 1) {
    return NextResponse.json(
      { error: "Choose one valid art print." },
      { status: 400 },
    );
  }

  const print = getArtPrint(payload.slug);
  if (!print || print.availability !== "available") {
    return NextResponse.json(
      { error: "This print is not currently available." },
      { status: 400 },
    );
  }

  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      { error: "Art print checkout is not configured yet." },
      { status: 503 },
    );
  }

  const origin = getSiteOrigin(request);
  const sourceUrl = getSourceUrl(request, origin, print.canonicalPath);
  const metadata = {
    order_type: ART_PRINT_ORDER_TYPE,
    art_print_id: print.id,
    art_print_slug: print.slug,
    art_print_title: print.title,
    quantity: "1",
    unit_amount: String(print.unitAmount),
    currency: print.currency,
    dimensions: `${print.dimensions.width}x${print.dimensions.height}${print.dimensions.unit}`,
    source_url: sourceUrl.slice(0, 500),
  };
  const shippingRateId = process.env.ART_PRINT_SHIPPING_RATE_ID?.trim();

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      integration_identifier: ART_PRINT_INTEGRATION_IDENTIFIER,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: print.currency,
            unit_amount: print.unitAmount,
            product_data: {
              name: `${print.title} — ${print.dimensions.width} × ${print.dimensions.height} Art Print`,
              description: `${print.edition.label}. ${print.presentation.label}.`,
              tax_code: "txcd_99999999",
              metadata,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: shippingRateId
        ? [{ shipping_rate: shippingRateId }]
        : [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                fixed_amount: {
                  amount: getShippingAmountCents(),
                  currency: print.currency,
                },
                display_name: "US standard shipping",
              },
            },
          ],
      // The live Stripe account has a verified active US/Iowa tax registration.
      automatic_tax: { enabled: true },
      success_url: `${origin}${print.canonicalPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: getCancelUrl(sourceUrl),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Art print checkout session creation failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      slug: print.slug,
    });
    return NextResponse.json(
      { error: "Secure checkout could not be opened." },
      { status: 502 },
    );
  }
}
