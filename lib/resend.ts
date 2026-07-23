import { Resend } from "resend";

let resendClient: Resend | null = null;
let newsletterResendClient: Resend | null = null;

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

/**
 * Newsletter broadcasts need Resend contact, topic, segment, and broadcast
 * permissions. Keep that broader credential separate from the send-only key
 * used by transactional account and purchase emails.
 */
export function getNewsletterResend() {
  const apiKey = process.env.RESEND_NEWSLETTER_API_KEY;

  if (!apiKey) {
    throw new Error("Basil newsletter delivery is not configured.");
  }

  if (!newsletterResendClient) {
    newsletterResendClient = new Resend(apiKey);
  }

  return newsletterResendClient;
}
