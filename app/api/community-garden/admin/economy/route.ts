import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { updateCommunityGardenEconomy } from "@/lib/communityGarden/economy";
import {
  MAX_DAILY_CARE_LIMIT,
  MIN_DAILY_CARE_LIMIT,
} from "@/lib/communityGarden/economyPolicy";
import { isGardenAdmin, logGardenServerEvent } from "@/lib/communityGarden/health";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");

  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid Care settings origin." }, { status: 403 });
  }

  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to update Care settings." }, { status: 401 });
  }
  if (!isGardenAdmin(user)) {
    logGardenServerEvent("error", "admin_economy_denied", {
      requestId,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    dailyCareLimit?: unknown;
  } | null;
  const dailyCareLimit = payload?.dailyCareLimit;
  if (
    !Number.isInteger(dailyCareLimit) ||
    Number(dailyCareLimit) < MIN_DAILY_CARE_LIMIT ||
    Number(dailyCareLimit) > MAX_DAILY_CARE_LIMIT
  ) {
    return NextResponse.json(
      {
        error: `Choose a daily Care limit from ${MIN_DAILY_CARE_LIMIT} to ${MAX_DAILY_CARE_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  try {
    const economy = await updateCommunityGardenEconomy(
      Number(dailyCareLimit),
      user.id,
    );
    logGardenServerEvent("info", "admin_economy_updated", {
      requestId,
      durationMs: Date.now() - startedAt,
      dailyCareLimit: economy.dailyCareLimit,
    });
    const response = NextResponse.json(economy);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    logGardenServerEvent("error", "admin_economy_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "The Care settings could not be updated." },
      { status: 503 },
    );
  }
}
