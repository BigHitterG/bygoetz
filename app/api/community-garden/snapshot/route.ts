import { NextRequest, NextResponse } from "next/server";
import { loadCommunityGardenSnapshot } from "@/lib/communityGarden/publicGardenServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    return response;
  } catch (error) {
    console.error("Basil community snapshot failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The shared garden could not refresh. Please try again." },
      { status: 503 },
    );
  }
}
