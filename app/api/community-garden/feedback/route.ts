import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import {
  GARDEN_FEEDBACK_CATEGORIES,
  getGardenStewardByUserId,
  submitGardenFeedback,
  type GardenFeedbackCategory,
} from "@/lib/communityGarden/stewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getGardenUser(request);
  const steward = user ? await getGardenStewardByUserId(user.id) : null;

  if (!steward) {
    return NextResponse.json(
      { error: "A Founding Gardener pass is required." },
      { status: 401 },
    );
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
