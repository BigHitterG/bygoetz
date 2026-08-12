import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  isGardenHouseDisplayKey,
  markGardenHouseAccoladeInspected,
} from "@/lib/communityGarden/gardenHouse";
import { getGardenStewardByUserId } from "@/lib/communityGarden/stewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to inspect this accolade." }, { status: 401 });
  }

  const steward = await getGardenStewardByUserId(user.id);
  if (!steward) {
    return NextResponse.json({ error: "This garden is still a preview." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (!isGardenHouseDisplayKey(body?.key)) {
    return NextResponse.json({ error: "Choose a Hall of Growth display." }, { status: 400 });
  }

  const inspectedAt = await markGardenHouseAccoladeInspected(steward.id, body.key);
  return NextResponse.json({ key: body.key, inspectedAt });
}
