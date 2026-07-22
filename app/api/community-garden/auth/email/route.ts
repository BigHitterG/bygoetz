import { NextRequest, NextResponse } from "next/server";
import {
  claimGardenAccountEmailRequest,
  normalizeAccountEmail,
  sendGardenAccountEmail,
  validateAccountPassword,
  type GardenAccountEmailIntent,
} from "@/lib/communityGarden/accountEmails";
import {
  getBasilOrigin,
  hasAllowedBasilRequestOrigin,
} from "@/lib/communityGarden/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasAllowedBasilRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid account request origin." }, { status: 403 });
  }

  let payload: { intent?: unknown; email?: unknown; password?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const intent: GardenAccountEmailIntent | null =
    payload.intent === "signup" || payload.intent === "recovery"
      ? payload.intent
      : null;
  const email = normalizeAccountEmail(payload.email);
  const password = payload.password;

  if (!intent || !email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (intent === "signup" && !validateAccountPassword(password)) {
    return NextResponse.json(
      { error: "Use a password between 10 and 128 characters." },
      { status: 400 },
    );
  }

  const requestIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  try {
    const allowed = await claimGardenAccountEmailRequest(email, requestIp, intent);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many account emails were requested. Please try again later." },
        { status: 429 },
      );
    }

    const result = await sendGardenAccountEmail({
      email,
      password: typeof password === "string" ? password : undefined,
      requestedIntent: intent,
      origin: getBasilOrigin(),
    });

    return NextResponse.json(
      {
        accepted: true,
        accountStatus: result.sent ? result.accountStatus : "existing",
        message:
          result.sent
            ? result.accountStatus === "existing"
              ? "This account already exists. Check your email for a Basil link to verify or recover it."
              : "Your account was created. Check your email for a verification message from Basil by Goetz."
            : "If that account exists, a Basil password email is on its way.",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Basil account email failed", error);
    return NextResponse.json(
      { error: "Basil could not send the account email. Please try again." },
      { status: 503 },
    );
  }
}
