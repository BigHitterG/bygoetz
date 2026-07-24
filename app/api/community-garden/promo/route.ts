import { NextRequest, NextResponse } from "next/server";
import {
  normalizeAccountEmail,
  validateAccountPassword,
} from "@/lib/communityGarden/accountEmails";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  normalizePendingGardenPreview,
  lookupBasilAccountByEmail,
} from "@/lib/communityGarden/pendingPurchase";
import {
  claimGardenPromoAttempt,
  createComplimentaryBasilAccount,
  GardenPromoRateLimitError,
  isRecognizedGardenPromoCode,
  redeemGardenPromo,
  removeUnusedComplimentaryBasilAccount,
} from "@/lib/communityGarden/promos";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid gift-code origin." }, { status: 403 });
  }

  let createdUserId: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      preview?: unknown;
      email?: unknown;
      password?: unknown;
      promoCode?: unknown;
    };
    const preview = normalizePendingGardenPreview(body.preview);
    if (!preview) {
      return NextResponse.json(
        { error: "Basil could not safely save this preview garden." },
        { status: 400 },
      );
    }

    const authenticatedUser = await getGardenUser(request);
    const requestedEmail = normalizeAccountEmail(body.email);
    await claimGardenPromoAttempt(
      authenticatedUser?.email ?? requestedEmail ?? authenticatedUser?.id ?? "unknown",
      getRequestIp(request),
    );
    if (!isRecognizedGardenPromoCode(body.promoCode)) {
      return NextResponse.json(
        { error: "That gift code is invalid or has already been used." },
        { status: 400 },
      );
    }
    let userId = authenticatedUser?.id ?? null;
    if (!userId) {
      const email = requestedEmail;
      const password = validateAccountPassword(body.password)
        ? String(body.password)
        : null;
      if (!email || !password) {
        return NextResponse.json(
          {
            error:
              "Create your Basil account with an email and a password of at least 10 characters.",
          },
          { status: 400 },
        );
      }
      const existing = await lookupBasilAccountByEmail(email);
      if (existing) {
        return NextResponse.json(
          {
            code: "account_exists",
            error:
              "This Basil account already exists. Sign in with its password to use the gift code.",
          },
          { status: 409 },
        );
      }
      createdUserId = await createComplimentaryBasilAccount(email, password);
      userId = createdUserId;
    }

    const redemption = await redeemGardenPromo({
      userId,
      code: body.promoCode,
      preview,
    });
    return NextResponse.json({
      active: true,
      createdAccount: Boolean(createdUserId),
      previewImported: redemption.previewImported,
    });
  } catch (error) {
    if (createdUserId) {
      await removeUnusedComplimentaryBasilAccount(createdUserId).catch(
        (cleanupError) => {
          console.error("Basil gift account cleanup failed", {
            userId: createdUserId,
            message:
              cleanupError instanceof Error
                ? cleanupError.message
                : "Unknown cleanup error",
          });
        },
      );
    }
    if (error instanceof GardenPromoRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error("Basil gift-code redemption failed", {
      message: error instanceof Error ? error.message : "Unknown redemption error",
    });
    return NextResponse.json(
      { error: "That gift code is invalid or has already been used." },
      { status: 400 },
    );
  }
}
