import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
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

  logGardenServerEvent("info", "admin_economy_uncapped", {
    requestId,
    durationMs: Date.now() - startedAt,
  });
  return NextResponse.json(
    { error: "Basil Care is open-ended and no longer has an adjustable daily cap." },
    { status: 409 },
  );
}
