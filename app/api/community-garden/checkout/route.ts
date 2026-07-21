import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  createGardenName,
  GARDEN_STEWARD_CURRENCY,
  GARDEN_STEWARD_ORDER_TYPE,
  GARDEN_STEWARD_PRICE_CENTS,
  getGardenStewardByUserId,
} from "@/lib/communityGarden/stewards";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  if (requestOrigin && requestOrigin !== request.nextUrl.origin && requestOrigin !== origin) {
    return NextResponse.json({ error: "Invalid checkout origin." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    launchSessionId?: unknown;
  };
  const launchSessionId =
    typeof body.launchSessionId === "string" && UUID_PATTERN.test(body.launchSessionId)
      ? body.launchSessionId
      : null;

  const user = await getGardenUser(request);
  if (!user?.email) {
    return NextResponse.json(
      { error: "Sign in privately before starting checkout." },
      { status: 401 },
    );
  }

  if (await getGardenStewardByUserId(user.id)) {
    return NextResponse.json(
      { error: "This account already has an active Garden Membership." },
      { status: 409 },
    );
  }

  const gardenName = createGardenName(user.id);
  const metadata = {
    order_type: GARDEN_STEWARD_ORDER_TYPE,
    entitlement_version: "1",
    user_id: user.id,
    garden_name: gardenName,
    ...(launchSessionId ? { launch_session_id: launchSessionId } : {}),
  };

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: GARDEN_STEWARD_CURRENCY,
          unit_amount: GARDEN_STEWARD_PRICE_CENTS,
          product_data: {
            name: "Basil Community Garden Membership",
            description:
              "A one-time membership with a persistent My Garden, 30-bed starter plot, 8 starting Care, cross-device access, Almanac, and upgrade queue.",
            metadata: { order_type: GARDEN_STEWARD_ORDER_TYPE },
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    success_url:
      origin +
      "/api/community-garden/claim?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/community-garden?checkout=cancelled",
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
