import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { getNewsletterPreference, setNewsletterPreference } from "@/lib/communityGarden/newsletter";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getGardenUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to manage email preferences." }, { status: 401 });
  return NextResponse.json({ subscribed: await getNewsletterPreference(user.id) });
}

export async function POST(request: Request) {
  if (!hasAllowedBasilRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getGardenUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to manage email preferences." }, { status: 401 });
  const body = await request.json().catch(() => null) as { subscribed?: unknown } | null;
  if (typeof body?.subscribed !== "boolean") return NextResponse.json({ error: "Choose a newsletter preference." }, { status: 400 });
  try {
    return NextResponse.json({ subscribed: await setNewsletterPreference(user.id, body.subscribed) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The email preference could not be saved." }, { status: 409 });
  }
}
