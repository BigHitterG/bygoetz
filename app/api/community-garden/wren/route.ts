import { NextResponse } from "next/server";
import { getWrenPublicProfile } from "@/lib/communityGarden/wrenAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getWrenPublicProfile(), {
      headers: { "cache-control": "public, max-age=60, s-maxage=300" },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "basil_wren_public_profile_failed",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return NextResponse.json(
      { error: "Wren's field record is temporarily unavailable." },
      { status: 503 },
    );
  }
}
