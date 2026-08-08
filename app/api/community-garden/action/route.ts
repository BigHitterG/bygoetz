import { after, NextRequest, NextResponse } from "next/server";
import {
  attachGardenSession,
  getCanonicalGardenActor,
  submitCommunityGardenAction,
} from "@/lib/communityGarden/publicGardenServer";
import {
  getGardenDeviceClass,
  getGardenErrorCode,
  logGardenServerEvent,
  recordCommunityGardenHealth,
} from "@/lib/communityGarden/health";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";
import { MAX_WATERING_TARGETS } from "@/app/community-garden/lib/wateringSelection";
import { recordGardenStewardshipAction } from "@/lib/communityGarden/stewardship";
import { loadCommunityGardenRegionManifest } from "@/lib/communityGarden/regionDelivery";
import { OCCUPIED_GARDEN_COORDINATE_REASON } from "@/app/community-garden/lib/gardenActionFailure";

const ACTION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionBody = {
  actionId?: unknown;
  action?: unknown;
  gridX?: unknown;
  gridY?: unknown;
  plantType?: unknown;
  plantId?: unknown;
  plantIds?: unknown;
  weedId?: unknown;
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
    message.includes("full day") ||
    message.includes("reached today") ||
    message.includes("resting") ||
    message.includes("Pull this weed") ||
    message.includes("not available")
  ) {
    return message;
  }
  return "That did not work. Please try again.";
}

function actionErrorPayload(error: unknown, errorCode: string) {
  if (errorCode === "23505") {
    return {
      error: "Another gardener planted there first.",
      reason: OCCUPIED_GARDEN_COORDINATE_REASON,
    };
  }
  return { error: errorMessage(error) };
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid garden action origin." }, { status: 403 });
  }
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const deviceClass = getGardenDeviceClass(request.headers.get("user-agent"));
  let actor: Awaited<ReturnType<typeof getCanonicalGardenActor>> | null = null;
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
    actor = await getCanonicalGardenActor(request);
    const body = (await request.json()) as ActionBody;
    actionType = typeof body.action === "string" ? body.action : "unknown";
    if (
      typeof body.actionId !== "string" ||
      !ACTION_ID_PATTERN.test(body.actionId) ||
      (body.action !== "plant" && body.action !== "water" && body.action !== "weed")
    ) {
      recordResult("action_error", "invalid_action");
      const response = NextResponse.json(
        { error: "That garden action was not recognized." },
        { status: 400 },
      );
      attachGardenSession(response, actor.session);
      return response;
    }

    const legacyPlantId =
      typeof body.plantId === "string" && ACTION_ID_PATTERN.test(body.plantId)
        ? body.plantId
        : null;
    const plantIds = Array.isArray(body.plantIds)
      ? Array.from(
          new Set(
            body.plantIds.filter(
              (plantId): plantId is string =>
                typeof plantId === "string" && ACTION_ID_PATTERN.test(plantId),
            ),
          ),
        ).slice(0, MAX_WATERING_TARGETS)
      : legacyPlantId
        ? [legacyPlantId]
        : [];
    if (
      body.action === "weed" &&
      typeof body.weedId === "string" &&
      ACTION_ID_PATTERN.test(body.weedId)
    ) {
      plantIds.push(body.weedId);
    }
    if (body.action === "water" && plantIds.length === 0) {
      recordResult("action_error", "invalid_water_targets");
      const response = NextResponse.json(
        { error: "Choose between one and six connected flowers to water." },
        { status: 400 },
      );
      attachGardenSession(response, actor.session);
      return response;
    }
    if (body.action === "weed" && plantIds.length !== 1) {
      recordResult("action_error", "invalid_weed_target");
      const response = NextResponse.json(
        { error: "Choose one weed to pull." },
        { status: 400 },
      );
      attachGardenSession(response, actor.session);
      return response;
    }

    const data = await submitCommunityGardenAction({
      actionId: body.actionId,
      actorKey: actor.actorKey,
      networkKey: actor.networkKey,
      identityKind: actor.identityKind,
      action: body.action,
      gridX: typeof body.gridX === "number" ? body.gridX : undefined,
      gridY: typeof body.gridY === "number" ? body.gridY : undefined,
      plantType:
        typeof body.plantType === "string" ? body.plantType : undefined,
      plantIds,
    });
    const responseData = { ...(data as Record<string, unknown>) };
    if (actor.identityKind === "account") {
      try {
        const resultPlants = Array.isArray(responseData.plants)
          ? responseData.plants.filter(
              (plant): plant is Record<string, unknown> =>
                Boolean(plant) && typeof plant === "object",
            )
          : [];
        const anchorX =
          typeof body.gridX === "number"
            ? body.gridX
            : typeof resultPlants[0]?.grid_x === "number"
              ? resultPlants[0].grid_x
              : undefined;
        const anchorY =
          typeof body.gridY === "number"
            ? body.gridY
            : typeof resultPlants[0]?.grid_y === "number"
              ? resultPlants[0].grid_y
              : undefined;
        let guidanceZone: "garden" | "heart" | "growth-ring" | null = null;
        if (anchorX !== undefined && anchorY !== undefined) {
          const manifest = await loadCommunityGardenRegionManifest();
          const region = manifest.regions.find(
            (candidate) =>
              anchorX >= candidate.bounds.minX &&
              anchorX <= candidate.bounds.maxX &&
              anchorY >= candidate.bounds.minY &&
              anchorY <= candidate.bounds.maxY,
          );
          guidanceZone = region?.guidanceZone ?? null;
        }
        const stewardship = await recordGardenStewardshipAction({
          actionId: body.actionId,
          actorKey: actor.actorKey,
          actionType: body.action,
          gridX: anchorX,
          gridY: anchorY,
          plantType:
            typeof body.plantType === "string" ? body.plantType : undefined,
          plantIds,
          result: responseData,
          guidanceZone,
        });
        if (stewardship) {
          responseData.contribution = {
            ...(responseData.contribution &&
            typeof responseData.contribution === "object"
              ? (responseData.contribution as Record<string, unknown>)
              : {}),
            stewardship,
          };
        }
      } catch (stewardshipError) {
        logGardenServerEvent("error", "stewardship_record_failed", {
          requestId,
          action: actionType,
          errorCode: getGardenErrorCode(stewardshipError),
        });
      }
    }
    const response = NextResponse.json(responseData);
    response.headers.set("Cache-Control", "no-store");
    attachGardenSession(response, actor.session);
    recordResult("action_ok");
    return response;
  } catch (error) {
    const errorCode = getGardenErrorCode(error);
    recordResult("action_error", errorCode);
    const response = NextResponse.json(
      actionErrorPayload(error, errorCode),
      { status: 409 },
    );
    if (actor) attachGardenSession(response, actor.session);
    return response;
  }
}
