import { NextResponse } from "next/server";
import { runCommunityGardenFoundingStewardSession } from "@/lib/communityGarden/foundingStewards";
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
    const now = new Date();
    let foundingStewards: Awaited<ReturnType<typeof runCommunityGardenFoundingStewardSession>> | null = null;
    try {
      foundingStewards = await runCommunityGardenFoundingStewardSession(now);
    } catch (error) {
      console.error(JSON.stringify({
        event: "basil_founding_stewards_failed",
        message: error instanceof Error ? error.message : "unknown",
      }));
    }
    // The endpoint now wakes every 30 minutes for natural steward sessions,
    // but frontier state remains a once-daily, idempotent evaluation.
    const shouldEvaluateFrontier = now.getUTCHours() === 6 && now.getUTCMinutes() < 30;
    const frontier = shouldEvaluateFrontier
      ? await evaluateCommunityGardenFrontier()
      : null;
    return NextResponse.json({ ok: true, foundingStewards, frontier });
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
