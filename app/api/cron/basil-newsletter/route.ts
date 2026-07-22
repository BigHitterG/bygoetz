import { NextResponse } from "next/server";
import {
  createMonthlyNewsletterIssue,
  isMonthlyDraftDue,
  monthlyPeriodKey,
} from "@/lib/communityGarden/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const now = new Date();
  try {
    if (mode === "first") {
      const chicagoDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      if (chicagoDate !== "2026-07-22") {
        return NextResponse.json({ ok: true, skipped: "first-review-window-closed" });
      }
      const result = await createMonthlyNewsletterIssue("2026-07-preview", now);
      return NextResponse.json({ ok: true, ...result });
    }
    if (mode !== "monthly" || !isMonthlyDraftDue(now)) {
      return NextResponse.json({ ok: true, skipped: "not-monthly-draft-day" });
    }
    const result = await createMonthlyNewsletterIssue(monthlyPeriodKey(now), now);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(JSON.stringify({ event: "basil_newsletter_cron_failed", message: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: "The Basil newsletter draft could not be prepared." }, { status: 503 });
  }
}
