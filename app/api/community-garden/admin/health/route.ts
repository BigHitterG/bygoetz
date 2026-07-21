import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  getCommunityGardenAdminHealth,
  getGardenErrorCode,
  isGardenAdmin,
  logGardenServerEvent,
} from "@/lib/communityGarden/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  const user = await getGardenUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to view garden health." },
      { status: 401 },
    );
  }
  if (!isGardenAdmin(user)) {
    logGardenServerEvent("error", "admin_health_denied", {
      requestId,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    const health = await getCommunityGardenAdminHealth();
    logGardenServerEvent("info", "admin_health_loaded", {
      requestId,
      durationMs: Date.now() - startedAt,
      status: health.status,
    });
    const response = NextResponse.json(health);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    logGardenServerEvent("error", "admin_health_failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      errorCode: getGardenErrorCode(error),
    });
    return NextResponse.json(
      { error: "Garden health could not be loaded." },
      { status: 503 },
    );
  }
}
