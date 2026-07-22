import { NextRequest, NextResponse } from "next/server";
import {
  attachGardenSession,
  getGardenActor,
  loadCommunityGardenWateringStatus,
} from "@/lib/communityGarden/publicGardenServer";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const dynamic = "force-dynamic";

function readCoordinate(request: NextRequest, name: string) {
  const value = Number(request.nextUrl.searchParams.get(name));
  return Number.isInteger(value) ? value : null;
}

export async function GET(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid garden status origin." },
      { status: 403 },
    );
  }

  const minX = readCoordinate(request, "minX");
  const maxX = readCoordinate(request, "maxX");
  const minY = readCoordinate(request, "minY");
  const maxY = readCoordinate(request, "maxY");
  if (minX === null || maxX === null || minY === null || maxY === null) {
    return NextResponse.json(
      { error: "Choose a valid garden area." },
      { status: 400 },
    );
  }

  const actor = getGardenActor(request);
  try {
    const status = await loadCommunityGardenWateringStatus({
      actorKey: actor.actorKey,
      minX,
      maxX,
      minY,
      maxY,
    });
    const response = NextResponse.json(status);
    response.headers.set("Cache-Control", "private, no-store");
    attachGardenSession(response, actor.session);
    return response;
  } catch {
    const response = NextResponse.json(
      { error: "Watering opportunities could not refresh." },
      { status: 503 },
    );
    attachGardenSession(response, actor.session);
    return response;
  }
}
