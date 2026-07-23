import { NextResponse } from "next/server";
import { approveAndSendNewsletter, reviewNewsletterIssue } from "@/lib/communityGarden/newsletter";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.issueId !== "string" || typeof body.token !== "string") return null;
  return { issueId: body.issueId, token: body.token };
}

export async function POST(request: Request) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const body = parseBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  try {
    const action = new URL(request.url).searchParams.get("action");
    if (action === "send") {
      return NextResponse.json(await approveAndSendNewsletter(body.issueId, body.token));
    }
    const issue = await reviewNewsletterIssue(body.issueId, body.token);
    if (!issue) return NextResponse.json({ error: "This private review link is invalid." }, { status: 404 });
    return NextResponse.json(issue);
  } catch (error) {
    console.error(JSON.stringify({
      event: "basil_newsletter_review_failed",
      action: new URL(request.url).searchParams.get("action") ?? "review",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return NextResponse.json({
      error: "The newsletter could not be sent. Nothing was delivered, and this approval link remains safe to retry.",
    }, { status: 409 });
  }
}
