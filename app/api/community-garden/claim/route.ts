import { NextRequest, NextResponse } from "next/server";
import { getBasilPurchaseMetaEventId } from "@/lib/analytics/basilMetaServer";
import { fulfillGardenStewardCheckout } from "@/lib/communityGarden/stewards";
import {
  fulfillPendingGardenCheckout,
  getPendingGardenClaimCookieValue,
  isPendingGardenCheckout,
  PENDING_GARDEN_CLAIM_COOKIE,
} from "@/lib/communityGarden/pendingPurchase";
import { getBasilGameUrlForOrigin } from "@/lib/communityGarden/urls";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToGarden(url: URL, pendingClaim?: string | null) {
  const response = NextResponse.redirect(url);
  if (pendingClaim) {
    response.cookies.set(PENDING_GARDEN_CLAIM_COOKIE, pendingClaim, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/community-garden",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const gardenUrl = new URL(getBasilGameUrlForOrigin(request.nextUrl.origin));

  if (!sessionId) {
    gardenUrl.searchParams.set("steward", "unverified");
    return redirectToGarden(gardenUrl);
  }

  let pendingCheckout = false;
  let pendingClaim: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    pendingCheckout = isPendingGardenCheckout(session);
    pendingClaim = getPendingGardenClaimCookieValue(session);
    const result = pendingCheckout
      ? await fulfillPendingGardenCheckout(session)
      : await fulfillGardenStewardCheckout(session);
    if (result.status === "skipped") {
      gardenUrl.searchParams.set("steward", "unverified");
      return redirectToGarden(gardenUrl, pendingClaim);
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
    return redirectToGarden(gardenUrl, pendingClaim);
  } catch (error) {
    console.error("Basil Garden Membership claim failed", error);
    gardenUrl.searchParams.set(
      "steward",
      pendingCheckout ? "verification-sent" : "unverified",
    );
    return redirectToGarden(gardenUrl, pendingClaim);
  }
}
