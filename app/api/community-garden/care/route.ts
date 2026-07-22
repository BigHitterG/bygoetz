import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { claimGardenCare } from "@/lib/communityGarden/myGarden";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";
import { getGardenActor } from "@/lib/communityGarden/publicGardenServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid Care request origin." }, { status: 403 });
  }

  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to earn Care." }, { status: 401 });
  }

  const steward = await getGardenStewardByUserId(user.id);
  if (!steward) {
    return NextResponse.json(
      { error: "A Garden Membership is required to collect Care." },
      { status: 403 },
    );
  }

  let payload: { receiptToken?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "A Care receipt is required." }, { status: 400 });
  }

  if (
    typeof payload.receiptToken !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.receiptToken,
    )
  ) {
    return NextResponse.json({ error: "A valid Care receipt is required." }, { status: 400 });
  }

  try {
    const { actorKey } = getGardenActor(request);
    return NextResponse.json(
      await claimGardenCare(steward.id, payload.receiptToken, actorKey),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That Community Garden action could not earn Care.",
      },
      { status: 409 },
    );
  }
}
