import { NextResponse } from "next/server";
import { runCommunityGardenFoundingStewardSession } from "@/lib/communityGarden/foundingStewards";
import { evaluateCommunityGardenFrontier } from "@/lib/communityGarden/frontierServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const TICK_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function claimSupabaseTick(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return false;
  }

  const tickToken = typeof payload === "object" && payload !== null
    && "tickToken" in payload && typeof payload.tickToken === "string"
    ? payload.tickToken
    : "";
  if (!TICK_TOKEN_PATTERN.test(tickToken)) return false;

  const { data, error } = await getSupabaseAdmin().rpc(
    "claim_community_garden_founding_steward_tick",
    { p_token: tickToken },
  );
  if (error) {
    console.error(JSON.stringify({
      event: "basil_founding_steward_tick_claim_failed",
      message: error.message,
    }));
    return false;
  }
  return data === true;
}

async function runFoundingStewards(now: Date) {
  try {
    return await runCommunityGardenFoundingStewardSession(now);
  } catch (error) {
    console.error(JSON.stringify({
      event: "basil_founding_stewards_failed",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return null;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  try {
    const now = new Date();
    const foundingStewards = await runFoundingStewards(now);
    // Vercel wakes this GET once daily. Hobby cron delivery may occur at any
    // point within the configured hour, so the daily evaluation must not use
    // a narrower minute gate. Supabase Cron wakes the private POST below every
    // 30 minutes for the natural steward sessions.
    const frontier = await evaluateCommunityGardenFrontier();
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

export async function POST(request: Request) {
  if (!(await claimSupabaseTick(request))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const foundingStewards = await runFoundingStewards(new Date());
  return NextResponse.json({ ok: true, foundingStewards });
}
