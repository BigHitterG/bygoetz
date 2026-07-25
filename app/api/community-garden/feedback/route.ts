import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  GARDEN_FEEDBACK_CATEGORIES,
  GARDEN_REPORT_ATTACHMENT_TYPES,
  GARDEN_REPORT_KINDS,
  GARDEN_REPORT_MAX_ATTACHMENT_BYTES,
  GARDEN_REPORT_MAX_MESSAGE_LENGTH,
  claimAnonymousGardenReportSlot,
  getGardenStewardByUserId,
  submitAnonymousGardenReport,
  submitGardenFeedback,
  type GardenFeedbackCategory,
  type GardenReportKind,
} from "@/lib/communityGarden/stewards";
import { hasAllowedBasilRequestOrigin } from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function submitAnonymousReport(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  const rawKind = form.get("kind");
  const kind = GARDEN_REPORT_KINDS.includes(rawKind as GardenReportKind)
    ? (rawKind as GardenReportKind)
    : null;
  const rawMessage = form.get("message");
  const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
  const rawAttachment = form.get("attachment");
  const attachment =
    rawAttachment instanceof File && rawAttachment.size > 0 ? rawAttachment : null;

  if (!kind || message.length < 1 || message.length > GARDEN_REPORT_MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        error: `Choose bug or idea and keep the note between 1 and ${GARDEN_REPORT_MAX_MESSAGE_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (
    attachment &&
    (!GARDEN_REPORT_ATTACHMENT_TYPES.includes(
      attachment.type as (typeof GARDEN_REPORT_ATTACHMENT_TYPES)[number],
    ) ||
      attachment.size > GARDEN_REPORT_MAX_ATTACHMENT_BYTES)
  ) {
    return NextResponse.json(
      {
        error: "Use a JPG, PNG, or WebP screenshot no larger than 2.5 MB.",
      },
      { status: 400 },
    );
  }

  const report = await submitAnonymousGardenReport({
    kind,
    message,
    attachment: attachment
      ? {
          bytes: await attachment.arrayBuffer(),
          contentType: attachment.type as (typeof GARDEN_REPORT_ATTACHMENT_TYPES)[number],
          size: attachment.size,
        }
      : null,
  });

  return NextResponse.json({ report }, { status: 201 });
}

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid feedback origin." }, { status: 403 });
  }
  const user = await getGardenUser(request);
  const steward = user ? await getGardenStewardByUserId(user.id) : null;

  if (!steward) {
    return NextResponse.json(
      { error: "An active Garden Membership is required." },
      { status: 401 },
    );
  }

  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    try {
      if (!(await claimAnonymousGardenReportSlot(user!.id))) {
        return NextResponse.json(
          { error: "That is plenty for now. Try another report in about an hour." },
          { status: 429 },
        );
      }
      return await submitAnonymousReport(request);
    } catch (error) {
      console.error("Anonymous Basil report submission failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json(
        {
          error:
            "The report could not be sent. Your note is still here, so you can try again.",
        },
        { status: 500 },
      );
    }
  }

  let payload: { category?: unknown; message?: unknown };
  try {
    payload = (await request.json()) as { category?: unknown; message?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }

  const category = GARDEN_FEEDBACK_CATEGORIES.includes(
    payload.category as GardenFeedbackCategory,
  )
    ? (payload.category as GardenFeedbackCategory)
    : null;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!category || message.length < 1 || message.length > 280) {
    return NextResponse.json(
      { error: "Choose a category and keep the idea between 1 and 280 characters." },
      { status: 400 },
    );
  }

  const feedback = await submitGardenFeedback(steward.id, category, message);
  return NextResponse.json({ feedback }, { status: 201 });
}
