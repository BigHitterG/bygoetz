import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { revokeGardenShare } from "@/lib/communityGarden/shares";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ shareId: string }> },
) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid garden share origin." }, { status: 403 });
  }

  const user = await getGardenUser(request);
  const steward = user ? await getGardenStewardByUserId(user.id) : null;
  if (!steward) {
    return NextResponse.json(
      { error: "An active Garden Membership is required." },
      { status: 401 },
    );
  }

  const { shareId } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(shareId)) {
    return NextResponse.json({ error: "Choose a valid shared garden." }, { status: 400 });
  }

  try {
    const revoked = await revokeGardenShare(steward.id, shareId);
    if (!revoked) {
      return NextResponse.json({ error: "That shared garden is no longer active." }, { status: 404 });
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error("Basil garden snapshot revocation failed", {
      tokenSuffix: shareId.slice(-6),
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "That garden could not be unshared. Please try again." },
      { status: 503 },
    );
  }
}
