import { createHash } from "node:crypto";
import { getResend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type GardenAccountEmailIntent = "signup" | "recovery";
export type GardenAccountVerificationType = "signup" | "recovery" | "magiclink";

const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;

export function normalizeAccountEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }
  return email;
}

export function validateAccountPassword(value: unknown) {
  return typeof value === "string" && value.length >= 10 && value.length <= 128;
}

function hashRateLimitValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function claimGardenAccountEmailRequest(
  email: string,
  requestIp: string,
  intent: GardenAccountEmailIntent,
) {
  const supabase = getSupabaseAdmin();
  const emailHash = hashRateLimitValue(`email:${email}`);
  const ipHash = hashRateLimitValue(`ip:${requestIp || "unknown"}`);
  const since = new Date(Date.now() - EMAIL_WINDOW_MS).toISOString();

  const [{ count: emailCount, error: emailError }, { count: ipCount, error: ipError }] =
    await Promise.all([
      supabase
        .from("garden_auth_email_requests")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash)
        .gte("created_at", since),
      supabase
        .from("garden_auth_email_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", since),
    ]);

  if (emailError) throw emailError;
  if (ipError) throw ipError;
  if ((emailCount ?? 0) >= EMAIL_LIMIT || (ipCount ?? 0) >= IP_LIMIT) return false;

  const { error } = await supabase.from("garden_auth_email_requests").insert({
    email_hash: emailHash,
    ip_hash: ipHash,
    intent,
  });
  if (error) throw error;

  void supabase
    .from("garden_auth_email_requests")
    .delete()
    .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  return true;
}

function getGardenAccountLink(
  origin: string,
  tokenHash: string,
  verificationType: GardenAccountVerificationType,
  continueToCheckout: boolean,
  requiresPassword?: boolean,
) {
  const link = new URL("/community-garden", origin);
  link.searchParams.set("steward", "confirm-account");
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", verificationType);
  if (continueToCheckout) link.searchParams.set("checkout", "1");
  if (requiresPassword) link.searchParams.set("setup", "1");
  return link.toString();
}

function renderGardenAccountEmail({
  title,
  intro,
  buttonLabel,
  link,
}: {
  title: string;
  intro: string;
  buttonLabel: string;
  link: string;
}) {
  const text = [
    title,
    "",
    intro,
    "",
    `${buttonLabel}: ${link}`,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Basil Community Garden by Goetz",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#e8e1d3;color:#34231f;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#e8e1d3;">
      <tr>
        <td align="center" style="padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border:3px solid #34231f;background-color:#fff4df;">
            <tr>
              <td style="padding-top:28px;padding-right:28px;padding-bottom:28px;padding-left:28px;">
                <p style="margin-top:0;margin-right:0;margin-bottom:8px;margin-left:0;color:#b62f3d;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;">Basil Community Garden</p>
                <h1 style="margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;color:#34231f;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:32px;">${title}</h1>
                <p style="margin-top:0;margin-right:0;margin-bottom:22px;margin-left:0;color:#5b4238;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;">${intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="#dd5f66" style="border:2px solid #34231f;background-color:#dd5f66;">
                      <a href="${link}" style="display:inline-block;padding-top:12px;padding-right:18px;padding-bottom:12px;padding-left:18px;color:#fff9e9;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">${buttonLabel}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:22px;margin-right:0;margin-bottom:0;margin-left:0;color:#6f4c3e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">If you did not request this, you can safely ignore this email. This link opens bygoetz.com and is used only for your private Basil account.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export async function sendGardenAccountEmail({
  email,
  password,
  requestedIntent,
  origin,
  continueToCheckout: requestedContinueToCheckout,
  paidPurchase = false,
  requiresPassword = false,
  idempotencyKey,
}: {
  email: string;
  password?: string;
  requestedIntent: GardenAccountEmailIntent;
  origin: string;
  continueToCheckout?: boolean;
  paidPurchase?: boolean;
  requiresPassword?: boolean;
  idempotencyKey?: string;
}) {
  const supabase = getSupabaseAdmin();
  let verificationType: GardenAccountVerificationType = requestedIntent;
  let properties: { hashed_token: string };
  let userId: string | null = null;

  if (requestedIntent === "signup" && password) {
    const signup = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });

    if (!signup.error && signup.data.properties) {
      properties = signup.data.properties;
      userId = signup.data.user?.id ?? null;
    } else {
      const recovery = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (recovery.error || !recovery.data.properties) {
        throw (
          recovery.error ??
          signup.error ??
          new Error("Basil could not create an account confirmation link.")
        );
      }
      verificationType = "recovery";
      properties = recovery.data.properties;
      userId = recovery.data.user?.id ?? null;
    }
  } else {
    const recovery = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (recovery.error || !recovery.data.properties) {
      return { sent: false as const, userId: null };
    }
    properties = recovery.data.properties;
    userId = recovery.data.user?.id ?? null;
  }

  const continueToCheckout =
    requestedContinueToCheckout ?? requestedIntent === "signup";
  const link = getGardenAccountLink(
    origin,
    properties.hashed_token,
    verificationType,
    continueToCheckout,
    requiresPassword,
  );
  const isNewSignup = verificationType === "signup";
  const emailContent = renderGardenAccountEmail({
    title: paidPurchase
      ? "Your garden is saved — finish your Basil account"
      : isNewSignup
        ? "Confirm your Basil account"
        : "Set your Basil password",
    intro: isNewSignup
      ? paidPurchase
        ? "Your $6.99 Garden Membership is paid and your preview garden is safely stored. Confirm this email, choose your Basil password, and continue with the garden you created."
        : "Confirm your email address, then continue directly to the secure $6.99 Community Garden Membership checkout."
      : continueToCheckout
        ? "This email already has a Basil account. Set a password, then continue directly to the secure $6.99 Community Garden Membership checkout."
        : paidPurchase
          ? "Your $6.99 Garden Membership is paid and your preview garden is safely stored. Open Basil to confirm this email and choose the password for your private account."
          : "Open Basil to choose a new password for your private account.",
    buttonLabel: isNewSignup
      ? paidPurchase
        ? "Confirm email and choose password"
        : "Confirm account and continue"
      : continueToCheckout
        ? "Set password and continue"
        : paidPurchase
          ? "Confirm email and choose password"
          : "Reset Basil password",
    link,
  });

  const { error } = await getResend().emails.send(
    {
      from:
        process.env.BASIL_AUTH_FROM_EMAIL ??
        "Basil by Goetz <garden@send.bygoetz.com>",
      to: [email],
      replyTo: process.env.RESEND_REPLY_TO_EMAIL
        ? [process.env.RESEND_REPLY_TO_EMAIL]
        : undefined,
      subject: isNewSignup
        ? paidPurchase
          ? "Your Basil garden is saved — finish your account"
          : "Confirm your Basil account"
        : continueToCheckout
          ? "Finish setting up your Basil account"
          : "Reset your Basil password",
      text: emailContent.text,
      html: emailContent.html,
    },
    {
      headers: {
        "Idempotency-Key": idempotencyKey
          ? `basil-${idempotencyKey}`.slice(0, 256)
          : `basil-auth-${verificationType}-${properties.hashed_token.slice(0, 32)}`,
      },
    },
  );
  if (error) throw new Error(error.message);

  return {
    sent: true as const,
    accountStatus: isNewSignup ? ("new" as const) : ("existing" as const),
    userId,
  };
}

async function generatePaidGardenLink(email: string) {
  const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties || !data.user?.id) {
    throw (
      error ?? new Error("Basil could not create the purchased account link.")
    );
  }
  return {
    tokenHash: data.properties.hashed_token,
    type: "magiclink" as const,
    userId: data.user.id,
  };
}

export async function sendPaidGardenVerificationEmail({
  email,
  origin,
  idempotencyKey,
}: {
  email: string;
  origin: string;
  idempotencyKey: string;
}) {
  const verification = await generatePaidGardenLink(email);
  const link = getGardenAccountLink(
    origin,
    verification.tokenHash,
    verification.type,
    false,
    false,
  );
  const emailContent = renderGardenAccountEmail({
    title: "Confirm your Basil account",
    intro:
      "Your $6.99 Garden Membership is paid and your garden is safely stored. Confirm this email to finish your private Basil account and continue growing.",
    buttonLabel: "Confirm account and open my garden",
    link,
  });
  const { error } = await getResend().emails.send(
    {
      from:
        process.env.BASIL_AUTH_FROM_EMAIL ??
        "Basil by Goetz <garden@send.bygoetz.com>",
      to: [email],
      replyTo: process.env.RESEND_REPLY_TO_EMAIL
        ? [process.env.RESEND_REPLY_TO_EMAIL]
        : undefined,
      subject: "Confirm your Basil account — your garden is saved",
      text: emailContent.text,
      html: emailContent.html,
    },
    {
      headers: {
        "Idempotency-Key": `basil-paid-verification-${idempotencyKey}`.slice(
          0,
          256,
        ),
      },
    },
  );
  if (error) throw new Error(error.message);
  return { sent: true as const, userId: verification.userId };
}

export async function createPaidGardenSessionHandoff(email: string) {
  return generatePaidGardenLink(email);
}
