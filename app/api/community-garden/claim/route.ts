import { NextRequest, NextResponse } from "next/server";
import { getBasilPurchaseMetaEventId } from "@/lib/analytics/basilMetaServer";
import { fulfillGardenStewardCheckout } from "@/lib/communityGarden/stewards";
import {
  fulfillPendingGardenCheckout,
  isPendingGardenCheckout,
} from "@/lib/communityGarden/pendingPurchase";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const gardenUrl = new URL("/community-garden", request.url);

  if (!sessionId) {
    gardenUrl.searchParams.set("steward", "unverified");
    return NextResponse.redirect(gardenUrl);
  }

  let pendingCheckout = false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    pendingCheckout = isPendingGardenCheckout(session);
    const result = pendingCheckout
      ? await fulfillPendingGardenCheckout(session)
      : await fulfillGardenStewardCheckout(session);
    if (result.status === "skipped") {
      gardenUrl.searchParams.set("steward", "unverified");
      return NextResponse.redirect(gardenUrl);
    }

    gardenUrl.searchParams.set(
      "steward",
      pendingCheckout ? "verification-sent" : "welcome",
    );
    if (result.status === "activation_sent" || result.status === "fulfilled") {
      gardenUrl.searchParams.set(
        "meta_purchase_event_id",
        getBasilPurchaseMetaEventId(session.id),
      );
    }
    return NextResponse.redirect(gardenUrl);
  } catch (error) {
    console.error("Basil Garden Membership claim failed", error);
    gardenUrl.searchParams.set(
      "steward",
      pendingCheckout ? "verification-sent" : "unverified",
    );
    return NextResponse.redirect(gardenUrl);
  }
}
