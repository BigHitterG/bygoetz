import { NextRequest, NextResponse } from "next/server";
import { claimGardenAccountEmailRequest } from "@/lib/communityGarden/accountEmails";
import {
  createPendingGardenSessionHandoff,
  getPendingGardenAccountStatus,
  PENDING_GARDEN_CLAIM_COOKIE,
  resendPendingGardenVerification,
} from "@/lib/communityGarden/pendingPurchase";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function invalidOrigin(request: NextRequest) {
  return !hasAllowedBasilRequestOrigin(request);
}

function pendingClaim(request: NextRequest) {
  return request.cookies.get(PENDING_GARDEN_CLAIM_COOKIE)?.value;
}

export async function GET(request: NextRequest) {
  const status = await getPendingGardenAccountStatus(pendingClaim(request));
  if (!status) {
    return NextResponse.json({ pending: false }, { status: 404 });
  }
  return NextResponse.json({ pending: true, ...status });
}

export async function POST(request: NextRequest) {
  if (invalidOrigin(request)) {
    return NextResponse.json({ error: "Invalid purchase origin." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  const claim = pendingClaim(request);

  try {
    if (body.action === "handoff") {
      const handoff = await createPendingGardenSessionHandoff(claim);
      return NextResponse.json(handoff);
    }

    if (body.action === "resend") {
      const status = await getPendingGardenAccountStatus(claim);
      if (!status?.email) {
        return NextResponse.json(
          { error: "The purchased Basil account could not be found." },
          { status: 404 },
        );
      }
      const requestIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        "unknown";
      const allowed = await claimGardenAccountEmailRequest(
        status.email,
        requestIp,
        "signup",
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "Too many account emails were requested. Please wait and try again." },
          { status: 429 },
        );
      }
      const sent = await resendPendingGardenVerification(
        claim,
        String(Math.floor(Date.now() / 60_000)),
      );
      return NextResponse.json(sent);
    }

    return NextResponse.json({ error: "Unknown purchase action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Basil account could not be updated.",
      },
      { status: 400 },
    );
  }
}
