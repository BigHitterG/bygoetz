import { NextRequest, NextResponse } from "next/server";
import {
  isFoundingGardenRegion,
  loadCommunityGardenRegionSnapshot,
} from "@/lib/communityGarden/regionDelivery";
import {
  getGardenErrorCode,
  logGardenServerEvent,
} from "@/lib/communityGarden/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ regionX: string; regionY: string }>;
};

function parseRegionCoordinate(value: string) {
  if (!/^-?\d{1,4}$/.test(value)) return null;
  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) ? coordinate : null;
}
export async function GET(request: NextRequest, context: RouteContext) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const params = await context.params;
  const regionX = parseRegionCoordinate(params.regionX);
  const regionY = parseRegionCoordinate(params.regionY);

  if (regionX === null || regionY === null) {
    return NextResponse.json(
      { error: "Region coordinates must be whole numbers." },
      { status: 400 },
    );
  }
  if (!isFoundingGardenRegion(regionX, regionY)) {
    return NextResponse.json(
      { error: "That garden region is not open." },
      { status: 404 },
    );
  }

  try {
    const snapshot = await loadCommunityGardenRegionSnapshot(regionX, regionY);
    if (!snapshot) {
      return NextResponse.json(
        { error: "That garden region is not open." },
        { status: 404 },
      );
    }

    const requestedVersion = Number(
      request.nextUrl.searchParams.get("version") ?? "",
    );
    const response = NextResponse.json(snapshot);
    if (
      Number.isSafeInteger(requestedVersion) &&
      requestedVersion === snapshot.snapshotVersion
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
      `\"basil-region-${snapshot.snapshotVersion}-${regionX}-${regionY}\"`,
    );
    return response;
  } catch (error) {
    logGardenServerEvent("error", "region_snapshot_failed", {
      requestId,
      regionX,
      regionY,
      durationMs: Date.now() - startedAt,
      errorCode: getGardenErrorCode(error),
    });
    return NextResponse.json(
      { error: "That garden region could not refresh. Please try again." },
      { status: 503 },
    );
  }
}
