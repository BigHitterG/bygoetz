import { NextResponse } from "next/server";
import {
  getCommunityGardenEconomy,
  publicCommunityGardenEconomy,
} from "@/lib/communityGarden/economy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = NextResponse.json(
      publicCommunityGardenEconomy(await getCommunityGardenEconomy()),
    );
    response.headers.set(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "The current Care rhythm could not be loaded." },
      { status: 503 },
    );
  }
}
