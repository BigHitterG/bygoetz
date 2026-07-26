import { NextResponse } from "next/server";
import { evaluateCommunityGardenFrontier } from "@/lib/communityGarden/frontierServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    const result = await evaluateCommunityGardenFrontier();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "basil_frontier_evaluation_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return NextResponse.json(
      { error: "The Basil frontier could not be evaluated." },
      { status: 503 },
    );
  }
}
