import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getBasilCheckoutMetaEventId } from "@/lib/analytics/basilMetaServer";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  normalizeAccountEmail,
  validateAccountPassword,
} from "@/lib/communityGarden/accountEmails";
import { recordBasilFunnelEvent } from "@/lib/communityGarden/funnel";
import {
  attachPendingGardenCheckout,
  createPendingBasilAccount,
  createPendingGardenPurchase,
  getPendingGardenPurchaseByClaim,
  normalizePendingGardenPreview,
  PENDING_GARDEN_CLAIM_COOKIE,
  PendingCheckoutRateLimitError,
  refreshPendingGardenPreview,
  removeUnusedPendingBasilAccount,
  serializePendingGardenClaim,
} from "@/lib/communityGarden/pendingPurchase";
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
    preview?: unknown;
    email?: unknown;
    password?: unknown;
  };
  const launchSessionId =
    typeof body.launchSessionId === "string" && UUID_PATTERN.test(body.launchSessionId)
      ? body.launchSessionId
      : null;

  const user = await getGardenUser(request);
  const preview = normalizePendingGardenPreview(body.preview);
  const requestedEmail = normalizeAccountEmail(body.email);
  const requestedPassword = validateAccountPassword(body.password)
    ? String(body.password)
    : null;

  if (!user?.email && !preview) {
    return NextResponse.json(
      { error: "Basil could not safely save this preview garden for checkout." },
      { status: 400 },
    );
  }

  if (!user?.email && (!requestedEmail || !requestedPassword)) {
    return NextResponse.json(
      {
        error:
          "Create your Basil account with an email and a password of at least 10 characters.",
      },
      { status: 400 },
    );
  }

  if (user && (await getGardenStewardByUserId(user.id))) {
    return NextResponse.json(
      { error: "This account already has an active Garden Membership." },
      { status: 409 },
    );
  }

  let pendingPurchase: Awaited<ReturnType<typeof createPendingGardenPurchase>> | null = null;
  let createdAccountUserId: string | null = null;
  let reusableClaimToken: string | null = null;
  try {
    if (!user) {
      const reusable = await getPendingGardenPurchaseByClaim(
        request.cookies.get(PENDING_GARDEN_CLAIM_COOKIE)?.value,
      );
      if (
        reusable &&
        reusable.row.buyer_email === requestedEmail &&
        reusable.row.status === "checkout_created" &&
        reusable.row.claimed_user_id
      ) {
        pendingPurchase = {
          id: reusable.row.id,
          claimToken: reusable.claimToken,
        };
        reusableClaimToken = reusable.claimToken;
        await refreshPendingGardenPreview(
          reusable.row.id,
          reusable.claimToken,
          preview!,
        );
        if (reusable.row.stripe_session_id) {
          const previousSession = await getStripe().checkout.sessions.retrieve(
            reusable.row.stripe_session_id,
          );
          if (previousSession.status === "open" && previousSession.url) {
            const response = NextResponse.json({
              url: previousSession.url,
              metaEventId: getBasilCheckoutMetaEventId(previousSession.id),
            });
            response.cookies.set(
              PENDING_GARDEN_CLAIM_COOKIE,
              serializePendingGardenClaim(reusable.row.id, reusable.claimToken),
              {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/api/community-garden",
                maxAge: 7 * 24 * 60 * 60,
              },
            );
            return response;
          }
        }
      } else {
        const account = await createPendingBasilAccount(
          requestedEmail!,
          requestedPassword!,
        );
        if (account.status === "existing") {
          return NextResponse.json(
            {
              code: "account_exists",
              error:
                "This Basil account already exists. Sign in with this email instead of purchasing again.",
            },
            { status: 409 },
          );
        }
        createdAccountUserId = account.userId;
        pendingPurchase = await createPendingGardenPurchase({
          preview: preview!,
          launchSessionId,
          requestIp:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            "unknown",
          buyerEmail: requestedEmail!,
          claimedUserId: account.userId,
        });
        if (launchSessionId) {
          await recordBasilFunnelEvent({
            launchSessionId,
            event: "signup_started",
            sourceKey: `pending-account:${pendingPurchase.id}`,
          }).catch(() => undefined);
        }
      }
    }
  } catch (error) {
    if (createdAccountUserId) {
      await removeUnusedPendingBasilAccount(
        createdAccountUserId,
        pendingPurchase?.id,
      ).catch(() => undefined);
    }
    if (error instanceof PendingCheckoutRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
  const gardenName = user ? createGardenName(user.id) : null;
  const metadata: Record<string, string> = {
    order_type: GARDEN_STEWARD_ORDER_TYPE,
    entitlement_version: "1",
    ...(launchSessionId ? { launch_session_id: launchSessionId } : {}),
    ...(user && gardenName ? { user_id: user.id, garden_name: gardenName } : {}),
    ...(pendingPurchase
      ? {
          pending_purchase_id: pendingPurchase.id,
          pending_claim_token: pendingPurchase.claimToken,
        }
      : {}),
  };

  let stripeCustomerId: string | null = null;
  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    if (pendingPurchase && reusableClaimToken) {
      const reusable = await getPendingGardenPurchaseByClaim(
        serializePendingGardenClaim(pendingPurchase.id, reusableClaimToken),
      );
      stripeCustomerId = reusable?.row.stripe_customer_id ?? null;
    }
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user?.email ?? requestedEmail!,
        metadata: pendingPurchase
          ? { pending_purchase_id: pendingPurchase.id }
          : { basil_user_id: user!.id },
      });
      stripeCustomerId = customer.id;
    }

    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
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
  } catch (error) {
    if (createdAccountUserId) {
      await removeUnusedPendingBasilAccount(
        createdAccountUserId,
        pendingPurchase?.id,
      ).catch(() => undefined);
    }
    throw error;
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  if (pendingPurchase) {
    await attachPendingGardenCheckout(
      pendingPurchase.id,
      pendingPurchase.claimToken,
      session.id,
      stripeCustomerId,
    );
  }

  if (launchSessionId) {
    await Promise.allSettled([
      recordBasilFunnelEvent({
        launchSessionId,
        event: "paywall_viewed",
        sourceKey: `checkout-route-paywall:${session.id}`,
      }),
      recordBasilFunnelEvent({
        launchSessionId,
        event: "checkout_started",
        sourceKey: `checkout-route:${session.id}`,
      }),
    ]);
  }

  const response = NextResponse.json({
    url: session.url,
    metaEventId: getBasilCheckoutMetaEventId(session.id),
  });
  if (pendingPurchase) {
    response.cookies.set(
      PENDING_GARDEN_CLAIM_COOKIE,
      serializePendingGardenClaim(
        pendingPurchase.id,
        pendingPurchase.claimToken,
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/community-garden",
        maxAge: 7 * 24 * 60 * 60,
      },
    );
  }
  return response;
}
