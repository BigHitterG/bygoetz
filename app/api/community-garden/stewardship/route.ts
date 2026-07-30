import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";
import {
  acknowledgeGardenStewardshipNotification,
  getGardenStewardship,
  replaceGardenStewardshipTask,
} from "@/lib/communityGarden/stewardship";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getSteward(request: Request) {
  const user = await getGardenUser(request);
  if (!user) return null;
  return getGardenStewardByUserId(user.id);
}

export async function GET(request: Request) {
  const steward = await getSteward(request);
  if (!steward) {
    return NextResponse.json(
      { error: "A Garden Membership is required for Community Stewardship." },
      { status: 403 },
    );
  }
  return NextResponse.json(await getGardenStewardship(steward.id));
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid Stewardship request origin." }, { status: 403 });
  }
  const steward = await getSteward(request);
  if (!steward) {
    return NextResponse.json(
      { error: "A Garden Membership is required for Community Stewardship." },
      { status: 403 },
    );
  }
  const payload = (await request.json().catch(() => null)) as null | {
    action?: unknown;
    assignmentId?: unknown;
    notificationId?: unknown;
  };
  try {
    if (
      payload?.action === "replace" &&
      typeof payload.assignmentId === "string" &&
      UUID_PATTERN.test(payload.assignmentId)
    ) {
      return NextResponse.json(
        await replaceGardenStewardshipTask(steward.id, payload.assignmentId),
      );
    }
    if (
      payload?.action === "acknowledge" &&
      typeof payload.notificationId === "string" &&
      UUID_PATTERN.test(payload.notificationId)
    ) {
      return NextResponse.json(
        await acknowledgeGardenStewardshipNotification(
          steward.id,
          payload.notificationId,
        ),
      );
    }
    return NextResponse.json({ error: "Choose a valid Stewardship action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Community Stewardship could not be updated.",
      },
      { status: 409 },
    );
  }
}

