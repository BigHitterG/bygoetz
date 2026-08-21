import { NextRequest, NextResponse } from "next/server";
import { getArtPrint } from "@/lib/art/prints";
import { ART_PRINT_ORDER_TYPE } from "@/lib/art/orderTypes";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{8,240}$/;
const noStoreHeaders = { "cache-control": "private, no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";

  if (!STRIPE_SESSION_ID.test(sessionId)) {
    return NextResponse.json(
      { error: "Invalid checkout session." },
      { status: 400, headers: noStoreHeaders },
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Checkout verification is not configured." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const slug = session.metadata?.art_print_slug;
    const print = slug ? getArtPrint(slug) : undefined;

    if (session.metadata?.order_type !== ART_PRINT_ORDER_TYPE || !print) {
      return NextResponse.json(
        { error: "Art-print checkout session not found." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    return NextResponse.json(
      {
        status: session.payment_status === "paid" ? "paid" : "pending",
        slug: print.slug,
        title: print.title,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Art print checkout verification failed", {
      sessionId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Checkout session could not be verified." },
      { status: 404, headers: noStoreHeaders },
    );
  }
}
