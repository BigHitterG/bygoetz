import { NextResponse } from "next/server";
import {
  createMonthlyNewsletterIssue,
  isMonthlyDraftDue,
  monthlyPeriodKey,
} from "@/lib/communityGarden/newsletter";
import {
  createDailySocialDigest,
  resendLatestSocialDigest,
  resendSocialDigestWithCapability,
} from "@/lib/communityGarden/socialStudio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return request.headers.get("user-agent") === "vercel-cron/1.0";
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const now = new Date();
  const mode = new URL(request.url).searchParams.get("mode") ?? "scheduled";
  if (!["scheduled", "prepare", "notify"].includes(mode)) {
    return NextResponse.json({ error: "Invalid social cron mode." }, { status: 400 });
  }
  const newsletterDue = isMonthlyDraftDue(now);
  const [socialResult, newsletterResult] = await Promise.allSettled([
    mode === "notify"
      ? resendLatestSocialDigest(`scheduled-notify-${now.toISOString().slice(0, 10)}`)
      : createDailySocialDigest(now, { sendEmail: false }),
    mode === "scheduled" && newsletterDue
      ? createMonthlyNewsletterIssue(monthlyPeriodKey(now), now)
      : Promise.resolve({ skipped: mode === "scheduled" ? "not-monthly-draft-day" : "social-workflow-only" }),
  ]);
  if (socialResult.status === "rejected") {
    console.error(JSON.stringify({
      event: "basil_social_cron_failed",
      message: socialResult.reason instanceof Error ? socialResult.reason.message : "unknown",
    }));
  }
  if (newsletterResult.status === "rejected") {
    console.error(JSON.stringify({
      event: "basil_newsletter_cron_failed",
      message: newsletterResult.reason instanceof Error ? newsletterResult.reason.message : "unknown",
    }));
  }
  const failed = socialResult.status === "rejected" || newsletterResult.status === "rejected";
  return NextResponse.json({
    ok: !failed,
    mode,
    social: socialResult.status === "fulfilled" ? socialResult.value : { error: "Social digest failed." },
    newsletter: newsletterResult.status === "fulfilled" ? newsletterResult.value : { error: "Newsletter draft failed." },
  }, { status: failed ? 503 : 200 });
}

export async function POST(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "notify") return NextResponse.json({ error: "Invalid social cron mode." }, { status: 400 });
  const storyId = request.headers.get("x-basil-story-id") ?? "";
  const token = request.headers.get("x-basil-transfer-token") ?? "";
  try {
    const result = await resendSocialDigestWithCapability(storyId, token);
    return NextResponse.json({ ok: true, social: result });
  } catch (error) {
    console.error(JSON.stringify({
      event: "basil_social_capability_notify_failed",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Social Studio email could not be sent.",
    }, { status: 401 });
  }
}
