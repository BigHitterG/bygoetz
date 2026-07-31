import { NextResponse } from "next/server";
import {
  approveAllSocialVariants,
  decideSocialVariant,
  requestSocialRevision,
  reviewSocialDigest,
  saveSocialVariant,
} from "@/lib/communityGarden/socialStudio";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SocialStudioBody = {
  digestId: string;
  token: string;
  variantId?: string;
  headline?: string;
  body?: string;
  hashtags?: string[];
  decision?: "approve" | "reject" | "draft" | "published";
  publishedUrl?: string;
  storyId?: string;
  feedback?: string;
};

function parseBody(value: unknown): SocialStudioBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.digestId !== "string" || typeof body.token !== "string") return null;
  return {
    digestId: body.digestId,
    token: body.token,
    variantId: typeof body.variantId === "string" ? body.variantId : undefined,
    headline: typeof body.headline === "string" ? body.headline : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((tag): tag is string => typeof tag === "string") : undefined,
    decision: ["approve", "reject", "draft", "published"].includes(String(body.decision))
      ? body.decision as SocialStudioBody["decision"]
      : undefined,
    publishedUrl: typeof body.publishedUrl === "string" ? body.publishedUrl : undefined,
    storyId: typeof body.storyId === "string" ? body.storyId : undefined,
    feedback: typeof body.feedback === "string" ? body.feedback : undefined,
  };
}

export async function POST(request: Request) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid Social Studio request origin." }, { status: 403 });
  }
  const payload = parseBody(await request.json().catch(() => null));
  if (!payload) return NextResponse.json({ error: "Invalid Social Studio request." }, { status: 400 });
  const action = new URL(request.url).searchParams.get("action") ?? "review";
  try {
    if (action === "save") {
      if (!payload.variantId) return NextResponse.json({ error: "A social draft is required." }, { status: 400 });
      const variant = await saveSocialVariant(payload.digestId, payload.token, payload.variantId, {
        headline: payload.headline,
        body: payload.body,
        hashtags: payload.hashtags,
      });
      return NextResponse.json({ ok: true, variant });
    }
    if (action === "decision") {
      if (!payload.variantId || !payload.decision) {
        return NextResponse.json({ error: "A social draft and decision are required." }, { status: 400 });
      }
      const variant = await decideSocialVariant(
        payload.digestId,
        payload.token,
        payload.variantId,
        payload.decision,
        payload.publishedUrl,
      );
      return NextResponse.json({ ok: true, variant });
    }
    if (action === "approve-all") {
      const result = await approveAllSocialVariants(payload.digestId, payload.token);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "revision") {
      if (!payload.feedback) {
        return NextResponse.json({ error: "A feedback note is required." }, { status: 400 });
      }
      const revision = await requestSocialRevision(
        payload.digestId,
        payload.token,
        payload.storyId ?? null,
        payload.feedback,
      );
      return NextResponse.json({ ok: true, revision });
    }
    const digest = await reviewSocialDigest(payload.digestId, payload.token);
    if (!digest) return NextResponse.json({ error: "This private Social Studio link is invalid." }, { status: 404 });
    const response = NextResponse.json(digest);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "basil_social_studio_failed",
      action,
      message: error instanceof Error ? error.message : "unknown",
    }));
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Social Studio request could not be completed.",
    }, { status: 409 });
  }
}
