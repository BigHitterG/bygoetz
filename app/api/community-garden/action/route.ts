import { NextRequest, NextResponse } from "next/server";
import {
  attachGardenSession,
  getGardenActor,
  submitCommunityGardenAction,
} from "@/lib/communityGarden/publicGardenServer";

const ACTION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionBody = {
  actionId?: unknown;
  action?: unknown;
  gridX?: unknown;
  gridY?: unknown;
  plantType?: unknown;
  plantId?: unknown;
};

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "That did not work. Please try again.";
  }
  const message = "message" in error ? String(error.message) : "";
  if (
    message.includes("already") ||
    message.includes("no longer") ||
    message.includes("Choose") ||
    message.includes("breather") ||
    message.includes("not available")
  ) {
    return message;
  }
  return "That did not work. Please try again.";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionBody;
    if (
      typeof body.actionId !== "string" ||
      !ACTION_ID_PATTERN.test(body.actionId) ||
      (body.action !== "plant" && body.action !== "water")
    ) {
      return NextResponse.json(
        { error: "That garden action was not recognized." },
        { status: 400 },
      );
    }

    const { session, actorKey, networkKey } = getGardenActor(request);
    const data = await submitCommunityGardenAction({
      actionId: body.actionId,
      actorKey,
      networkKey,
      action: body.action,
      gridX: typeof body.gridX === "number" ? body.gridX : undefined,
      gridY: typeof body.gridY === "number" ? body.gridY : undefined,
      plantType:
        typeof body.plantType === "string" ? body.plantType : undefined,
      plantId: typeof body.plantId === "string" ? body.plantId : undefined,
    });
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "no-store");
    attachGardenSession(response, session);
    return response;
  } catch (error) {
    console.error("Basil community action failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 409 },
    );
  }
}
