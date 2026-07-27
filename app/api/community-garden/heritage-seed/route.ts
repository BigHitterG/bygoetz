import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { nominateHeritageSeed } from "@/lib/communityGarden/heritageSeeds";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid Heritage Seed origin." },
      { status: 403 },
    );
  }
  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to choose a Heritage Flower." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { plantId?: unknown };
    if (typeof body.plantId !== "string") {
      return NextResponse.json(
        { error: "Choose one of your Community Garden flowers." },
        { status: 400 },
      );
    }
    const heritage = await nominateHeritageSeed(user.id, body.plantId);
    return NextResponse.json({ heritage });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That flower could not be nominated.",
      },
      { status: 400 },
    );
  }
}
