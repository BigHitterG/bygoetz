import { after, NextRequest, NextResponse } from "next/server";
import {
  attachGardenSession,
  getGardenActor,
  submitCommunityGardenAction,
} from "@/lib/communityGarden/publicGardenServer";
import {
  getGardenDeviceClass,
  getGardenErrorCode,
  logGardenServerEvent,
  recordCommunityGardenHealth,
} from "@/lib/communityGarden/health";

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
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const deviceClass = getGardenDeviceClass(request.headers.get("user-agent"));
  let actor: ReturnType<typeof getGardenActor> | null = null;
  let actionType = "unknown";

  function recordResult(event: "action_ok" | "action_error", errorCode?: string) {
    const durationMs = Date.now() - startedAt;
    logGardenServerEvent(event === "action_ok" ? "info" : "error", event, {
      requestId,
      action: actionType,
      deviceClass,
      durationMs,
      errorCode,
    });
    after(async () => {
      try {
        await recordCommunityGardenHealth({
          event,
          deviceClass,
          actorKey: actor?.actorKey,
          durationMs,
          errorCode,
        });
      } catch (healthError) {
        logGardenServerEvent("error", "health_record_failed", {
          requestId,
          sourceEvent: event,
          errorCode: getGardenErrorCode(healthError),
        });
      }
    });
  }

  try {
    actor = getGardenActor(request);
    const body = (await request.json()) as ActionBody;
    actionType = typeof body.action === "string" ? body.action : "unknown";
    if (
      typeof body.actionId !== "string" ||
      !ACTION_ID_PATTERN.test(body.actionId) ||
      (body.action !== "plant" && body.action !== "water")
    ) {
      recordResult("action_error", "invalid_action");
      const response = NextResponse.json(
        { error: "That garden action was not recognized." },
        { status: 400 },
      );
      attachGardenSession(response, actor.session);
      return response;
    }

    const data = await submitCommunityGardenAction({
      actionId: body.actionId,
      actorKey: actor.actorKey,
      networkKey: actor.networkKey,
      action: body.action,
      gridX: typeof body.gridX === "number" ? body.gridX : undefined,
      gridY: typeof body.gridY === "number" ? body.gridY : undefined,
      plantType:
        typeof body.plantType === "string" ? body.plantType : undefined,
      plantId: typeof body.plantId === "string" ? body.plantId : undefined,
    });
    const response = NextResponse.json(data);
    response.headers.set("Cache-Control", "no-store");
    attachGardenSession(response, actor.session);
    recordResult("action_ok");
    return response;
  } catch (error) {
    const errorCode = getGardenErrorCode(error);
    recordResult("action_error", errorCode);
    const response = NextResponse.json(
      { error: errorMessage(error) },
      { status: 409 },
    );
    if (actor) attachGardenSession(response, actor.session);
    return response;
  }
}
