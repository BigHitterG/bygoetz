import { NextResponse } from "next/server";
import {
  createMonthlyNewsletterIssue,
  isMonthlyDraftDue,
  monthlyPeriodKey,
} from "@/lib/communityGarden/newsletter";
import { createDailySocialDigest } from "@/lib/communityGarden/socialStudio";

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
  const newsletterDue = isMonthlyDraftDue(now);
  const [socialResult, newsletterResult] = await Promise.allSettled([
    createDailySocialDigest(now),
    newsletterDue
      ? createMonthlyNewsletterIssue(monthlyPeriodKey(now), now)
      : Promise.resolve({ skipped: "not-monthly-draft-day" }),
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
    social: socialResult.status === "fulfilled" ? socialResult.value : { error: "Social digest failed." },
    newsletter: newsletterResult.status === "fulfilled" ? newsletterResult.value : { error: "Newsletter draft failed." },
  }, { status: failed ? 503 : 200 });
}

