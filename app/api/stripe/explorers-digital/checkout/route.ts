­r‡^Ñf¥–Ø¦{,yÊ'vÃ®¶›­import { after, NextRequest, NextResponse } from "next/server";
import {
  getExplorersDigitalCheckoutMetaEventId,
  sendExplorersDigitalInitiateCheckoutConversion,
} from "@/lib/analytics/explorersMetaServer";
import { getDigitalDownloadProductByKey } from "@/lib/explorers/digitalDownloads";
import { EXPLORERS_DIGITAL_ORDER_TYPE } from "@/lib/explorers/orderTypes";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequest = {
  productKey?: unknown;
};

function getClientIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function getSourceUrl(request: NextRequest, origin: string) {
  const fallback = `${origin}/explorers/digital-downloads`;
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

function getCancelUrl(sourceUrl: string) {
  const cancelUrl = new URL(sourceUrl);
  cancelUrl.searchParams.set("checkout", "cancelled");
  return cancelUrl.toString();
}

export async function POST(request: NextRequest) {
  let payload: CheckoutRequest;
  try {
    payload = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const product =
    typeof payload.productKey === "string"
      ? getDigitalDownloadProductByKey(payload.productKey)
      : undefined;
  if (!product) {
    return NextResponse.json({ error: "Choose a valid digital product." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Digital checkout is not configured yet." },
      { status: 503 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const sourceUrl = getSourceUrl(request, origin);
  const metaFbp = request.cookies.get("_fbp")?.value;
  const metaFbc = request.cookies.get("_fbc")?.value;
  const clientIpAddress = getClientIpAddress(request);
  const clientUserAgent = request.headers.get("user-agent");
  const metadata = {
    order_type: EXPLORERS_DIGITAL_ORDER_TYPE,
    digital_product_keys: product.key,
    meta_source_url: sourceUrl.slice(0, 500),
    ...(metaFbp ? { meta_fbp: metaFbp } : {}),
    ...(metaFbc ? { meta_fbc: metaFbc } : {}),
  };

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: product.priceCents,
          product_data: {
            name: product.title,
            metadata: {
              order_type: EXPLORERS_DIGITAL_ORDER_TYPE,
              digital_product_key: product.key,
            },
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url:
      origin + "/explorers/digital-downloads/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: getCancelUrl(sourceUrl),
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  const metaEventId = getExplorersDigitalCheckoutMetaEventId(session.id);
  after(async () => {
    await sendExplorersDigitalInitiateCheckoutConversion({
      stripeSessionId: session.id,
      sourceUrl,
      value: product.priceCents / 100,
      currency: "usd",
      productKeys: [product.key],
      fbp: metaFbp,
      fbc: metaFbc,
      clientIpAddress,
      clientUserAgent,
    });
  });

  return NextResponse.json({ url: session.url, metaEventId });
}
