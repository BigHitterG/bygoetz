import { NextResponse } from "next/server";
import {
  acknowledgeHeritageNotifications,
  getHeritageNotifications,
} from "@/lib/communityGarden/heritageNotifications";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to see Heritage Flower news." },
      { status: 401 },
    );
  }

  try {
    const notifications = await getHeritageNotifications(user.id);
    const response = NextResponse.json({ notifications });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Basil Heritage notification lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Heritage Flower news is taking a little longer to arrive." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid Heritage notification origin." },
      { status: 403 },
    );
  }

  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to update Heritage Flower news." },
      { status: 401 },
    );
  }

  let payload: { notificationIds?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: "Choose a Heritage Flower notification." },
      { status: 400 },
    );
  }

  const notificationIds = Array.isArray(payload.notificationIds)
    ? Array.from(
        new Set(
          payload.notificationIds.filter(
            (value): value is string =>
              typeof value === "string" && UUID_PATTERN.test(value),
          ),
        ),
      ).slice(0, 20)
    : [];
  if (notificationIds.length === 0) {
    return NextResponse.json(
      { error: "Choose a valid Heritage Flower notification." },
      { status: 400 },
    );
  }

  try {
    const result = await acknowledgeHeritageNotifications(
      user.id,
      notificationIds,
    );
    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Basil Heritage notification acknowledgement failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "That Heritage Flower notice could not be cleared yet." },
      { status: 503 },
    );
  }
}
