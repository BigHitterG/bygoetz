import { NextRequest, NextResponse } from "next/server";
import { loadCommunityGardenRegionManifest } from "@/lib/communityGarden/regionDelivery";
import {
  getGardenErrorCode,
  logGardenServerEvent,
} from "@/lib/communityGarden/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function setSnapshotCacheHeaders(
  response: NextResponse,
  requestedVersion: number,
  actualVersion: number,
) {
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
  response.headers.set(
    "ETag",
    `\"basil-region-manifest-${actualVersion}\"`,
  );
}
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  try {
    const requestedVersion = Number(
      request.nextUrl.searchParams.get("version") ?? "",
    );
    const manifest = await loadCommunityGardenRegionManifest();
    const response = NextResponse.json(manifest);
    setSnapshotCacheHeaders(
      response,
      requestedVersion,
      manifest.snapshotVersion,
    );
    return response;
  } catch (error) {
    logGardenServerEvent("error", "region_manifest_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      errorCode: getGardenErrorCode(error),
    });
    return NextResponse.json(
      { error: "The garden region map could not refresh. Please try again." },
      { status: 503 },
    );
  }
}
