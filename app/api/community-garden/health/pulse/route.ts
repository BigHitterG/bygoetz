import { after, NextRequest, NextResponse } from "next/server";
import {
  getGardenDeviceClass,
  getGardenErrorCode,
  logGardenServerEvent,
  recordCommunityGardenHealth,
} from "@/lib/communityGarden/health";
import {
  attachGardenSession,
  getGardenActor,
} from "@/lib/communityGarden/publicGardenServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const deviceClass = getGardenDeviceClass(request.headers.get("user-agent"));
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store");

  let actor: ReturnType<typeof getGardenActor>;
  try {
    actor = getGardenActor(request);
  } catch (error) {
    logGardenServerEvent("error", "health_pulse_unavailable", {
      requestId,
      errorCode: getGardenErrorCode(error),
    });
    return response;
  }

  const { session, actorKey } = actor;
  attachGardenSession(response, session);

  after(async () => {
    try {
      await recordCommunityGardenHealth({
        event: "pulse",
        deviceClass,
        actorKey,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      logGardenServerEvent("error", "health_record_failed", {
        requestId,
        sourceEvent: "pulse",
        errorCode: getGardenErrorCode(error),
      });
    }
  });

  return response;
}
