import { createHash } from "node:crypto";
import { getResend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type GardenAccountEmailIntent = "signup" | "recovery";

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
  verificationType: "signup" | "recovery",
  continueToCheckout: boolean,
) {
  const link = new URL("/community-garden", origin);
  link.searchParams.set("steward", "confirm-account");
  link.searchParams.set("token_hash", tokenHash);
  link.searchParams.set("type", verificationType);
  if (continueToCheckout) link.searchParams.set("checkout", "1");
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
}: {
  email: string;
  password?: string;
  requestedIntent: GardenAccountEmailIntent;
  origin: string;
}) {
  const supabase = getSupabaseAdmin();
  let verificationType: "signup" | "recovery" = requestedIntent;
  let properties: { hashed_token: string };

  if (requestedIntent === "signup" && password) {
    const signup = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });

    if (!signup.error && signup.data.properties) {
      properties = signup.data.properties;
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
    }
  } else {
    const recovery = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (recovery.error || !recovery.data.properties) {
      return { sent: false as const };
    }
    properties = recovery.data.properties;
  }

  const continueToCheckout = requestedIntent === "signup";
  const link = getGardenAccountLink(
    origin,
    properties.hashed_token,
    verificationType,
    continueToCheckout,
  );
  const isNewSignup = verificationType === "signup";
  const emailContent = renderGardenAccountEmail({
    title: isNewSignup ? "Confirm your Basil account" : "Set your Basil password",
    intro: isNewSignup
      ? "Confirm your email address, then continue directly to the secure $6.99 Community Garden Membership checkout."
      : continueToCheckout
        ? "This email already has a Basil account. Set a password, then continue directly to the secure $6.99 Community Garden Membership checkout."
        : "Open Basil to choose a new password for your private account.",
    buttonLabel: isNewSignup
      ? "Confirm account and continue"
      : continueToCheckout
        ? "Set password and continue"
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
        ? "Confirm your Basil account"
        : continueToCheckout
          ? "Finish setting up your Basil account"
          : "Reset your Basil password",
      text: emailContent.text,
      html: emailContent.html,
    },
    {
      headers: {
        "Idempotency-Key": `basil-auth-${verificationType}-${properties.hashed_token.slice(0, 32)}`,
      },
    },
  );
  if (error) throw new Error(error.message);

  return {
    sent: true as const,
    accountStatus: isNewSignup ? ("new" as const) : ("existing" as const),
  };
}
