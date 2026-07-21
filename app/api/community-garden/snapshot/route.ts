import { after, NextRequest, NextResponse } from "next/server";
import { loadCommunityGardenSnapshot } from "@/lib/communityGarden/publicGardenServer";
import {
  getGardenDeviceClass,
  getGardenErrorCode,
  logGardenServerEvent,
  recordCommunityGardenHealth,
} from "@/lib/communityGarden/health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const deviceClass = getGardenDeviceClass(request.headers.get("user-agent"));

  function recordResult(event: "snapshot_ok" | "snapshot_error", errorCode?: string) {
    const durationMs = Date.now() - startedAt;
    logGardenServerEvent(event === "snapshot_ok" ? "info" : "error", event, {
      requestId,
      deviceClass,
      durationMs,
      errorCode,
    });
    after(async () => {
      try {
        await recordCommunityGardenHealth({
          event,
          deviceClass,
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
    const requestedVersion = Number(
      request.nextUrl.searchParams.get("version") ?? "",
    );
    const snapshot = await loadCommunityGardenSnapshot();
    const actualVersion = Number(snapshot.version);
    const response = NextResponse.json(snapshot);

    if (
      Number.isSafeInteger(requestedVersion) &&
      requestedVersion === actualVersion
    ) {
      response.headers.set(
        "Cache-Control",
        "public, max-age=600, s-maxage=31536000, immutable",
      );
    } else {
      response.headers.set(
        "Cache-Control",
        "public, max-age=10, s-maxage=10, stale-while-revalidate=20",
      );
    }
    recordResult("snapshot_ok");
    return response;
  } catch (error) {
    recordResult("snapshot_error", getGardenErrorCode(error));
    return NextResponse.json(
      { error: "The shared garden could not refresh. Please try again." },
      { status: 503 },
    );
  }
}
