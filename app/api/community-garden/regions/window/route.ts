import { NextRequest, NextResponse } from "next/server";
import { loadCommunityGardenRegionWindow } from "@/lib/communityGarden/regionDelivery";
import {
  getGardenErrorCode,
  logGardenServerEvent,
} from "@/lib/communityGarden/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null) {
  if (!value || !/^-?\d{1,4}$/.test(value)) return null;
  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) ? coordinate : null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const centerRegionX = parseCoordinate(
    request.nextUrl.searchParams.get("centerX"),
  );
  const centerRegionY = parseCoordinate(
    request.nextUrl.searchParams.get("centerY"),
  );
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius") ?? 2);

  if (
    centerRegionX === null ||
    centerRegionY === null ||
    !Number.isSafeInteger(requestedRadius) ||
    requestedRadius < 0 ||
    requestedRadius > 3
  ) {
    return NextResponse.json(
      { error: "A valid center region and radius from 0 to 3 are required." },
      { status: 400 },
    );
  }

  try {
    const window = await loadCommunityGardenRegionWindow(
      centerRegionX,
      centerRegionY,
      requestedRadius,
    );
    const requestedVersion = Number(
      request.nextUrl.searchParams.get("version") ?? "",
    );
    const response = NextResponse.json(window);
    if (
      Number.isSafeInteger(requestedVersion) &&
      requestedVersion === window.snapshotVersion
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
    response.headers.set(
      "ETag",
      `"basil-region-window-${window.snapshotVersion}-${centerRegionX}-${centerRegionY}-${requestedRadius}"`,
    );
    return response;
  } catch (error) {
    logGardenServerEvent("error", "region_window_failed", {
      requestId,
      centerRegionX,
      centerRegionY,
      requestedRadius,
      durationMs: Date.now() - startedAt,
      errorCode: getGardenErrorCode(error),
    });
    return NextResponse.json(
      { error: "That part of the garden could not refresh. Please try again." },
      { status: 503 },
    );
  }
}
