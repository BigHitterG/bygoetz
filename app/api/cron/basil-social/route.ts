import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createMonthlyNewsletterIssue,
  isMonthlyDraftDue,
  monthlyPeriodKey,
} from "@/lib/communityGarden/newsletter";
import {
  createDailySocialDigest,
  resendLatestSocialDigest,
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
  const resendKey = new URL(request.url).searchParams.get("resend");
  if (resendKey) {
    const expectedHash = "e222594cdd012eebe9e913cc5d52667d62b0426ae9789fa61e81afe4033dd6dd";
    const actualHash = createHash("sha256").update(resendKey).digest("hex");
    if (actualHash !== expectedHash) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }
    try {
      return NextResponse.json({
        ok: true,
        resend: await resendLatestSocialDigest(resendKey),
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "basil_social_resend_failed",
        message: error instanceof Error ? error.message : "unknown",
      }));
      return NextResponse.json(
        { error: "Social digest resend failed." },
        { status: 503 },
      );
    }
  }
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
