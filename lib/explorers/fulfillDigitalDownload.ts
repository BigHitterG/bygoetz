import Stripe from "stripe";
import { getResend } from "@/lib/resend";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDigitalDownloadProductByStripeProductId } from "./digitalDownloads";
import {
  getDownloadEmailSubject,
  renderDownloadEmailHtml,
  renderDownloadEmailText,
} from "./downloadEmail";

type FulfillmentResult = {
  status: "sent" | "skipped";
  reason?: string;
};

type DownloadLink = {
  title: string;
  url: string;
  storagePath: string;
  key: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getCustomerEmail(session: Stripe.Checkout.Session) {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
}

function getStripeProductId(lineItem: Stripe.LineItem) {
  const product = lineItem.price?.product;

  if (!product) return null;

  return typeof product === "string" ? product : product.id;
}

function uniqueDownloadLinks(downloadLinks: DownloadLink[]) {
  return Array.from(
    new Map(downloadLinks.map((downloadLink) => [downloadLink.key, downloadLink])).values(),
  );
}

async function createSignedDownloadLinks(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const supabase = getSupabaseAdmin();
  const bucket = getRequiredEnv("SUPABASE_DOWNLOAD_BUCKET");
  const ttlSeconds = Number(process.env.DOWNLOAD_LINK_TTL_SECONDS ?? "604800");
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  const digitalProducts = lineItems.data
    .map((lineItem) => {
      const stripeProductId = getStripeProductId(lineItem);
      return stripeProductId
        ? getDigitalDownloadProductByStripeProductId(stripeProductId)
        : undefined;
    })
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  const uniqueProducts = Array.from(
    new Map(digitalProducts.map((product) => [product.key, product])).values(),
  );

  const signedLinks = await Promise.all(
    uniqueProducts.map(async (product) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(product.storagePath, ttlSeconds);

      if (error || !data?.signedUrl) {
        throw new Error(
          `Could not create a signed download link for ${product.storagePath}: ${
            error?.message ?? "No signed URL returned"
          }`,
        );
      }

      return {
        title: product.title,
        url: data.signedUrl,
        storagePath: product.storagePath,
        key: product.key,
      };
    }),
  );

  return uniqueDownloadLinks(signedLinks);
}

export async function fulfillDigitalDownloadCheckout(
  session: Stripe.Checkout.Session,
): Promise<FulfillmentResult> {
  if (session.payment_status !== "paid") {
    return { status: "skipped", reason: `Checkout session is ${session.payment_status}.` };
  }

  const customerEmail = getCustomerEmail(session);

  if (!customerEmail) {
    throw new Error(`Checkout session ${session.id} does not include a customer email.`);
  }

  const supabase = getSupabaseAdmin();
  const { data: existingFulfillment, error: existingError } = await supabase
    .from("digital_download_fulfillments")
    .select("id,status")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingFulfillment?.status === "sent") {
    return { status: "skipped", reason: "Download email was already sent." };
  }

  const signedDownloadLinks = await createSignedDownloadLinks(session);

  if (signedDownloadLinks.length === 0) {
    await supabase.from("digital_download_fulfillments").upsert(
      {
        stripe_session_id: session.id,
        stripe_payment_intent_id: getPaymentIntentId(session),
        customer_email: customerEmail,
        product_keys: [],
        download_paths: [],
        status: "skipped",
        error_message: "Checkout did not include a digital download product.",
      },
      { onConflict: "stripe_session_id" },
    );

    return {
      status: "skipped",
      reason: "Checkout did not include a digital download product.",
    };
  }

  const fulfillmentPayload = {
    stripe_session_id: session.id,
    stripe_payment_intent_id: getPaymentIntentId(session),
    customer_email: customerEmail,
    product_keys: signedDownloadLinks.map((downloadLink) => downloadLink.key),
    download_paths: signedDownloadLinks.map((downloadLink) => downloadLink.storagePath),
    status: "processing",
    error_message: null,
  };

  const { error: upsertError } = await supabase
    .from("digital_download_fulfillments")
    .upsert(fulfillmentPayload, { onConflict: "stripe_session_id" });

  if (upsertError) {
    throw upsertError;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bygoetz.com";
  const ttlSeconds = Number(process.env.DOWNLOAD_LINK_TTL_SECONDS ?? "604800");
  const expiresInDays = Math.max(1, Math.round(ttlSeconds / 86400));
  const resend = getResend();
  const emailItems = signedDownloadLinks.map(({ title, url }) => ({ title, url }));

  const { data: emailData, error: emailError } = await resend.emails.send(
    {
      from: getRequiredEnv("RESEND_FROM_EMAIL"),
      to: [customerEmail],
      replyTo: process.env.RESEND_REPLY_TO_EMAIL
        ? [process.env.RESEND_REPLY_TO_EMAIL]
        : undefined,
      subject: getDownloadEmailSubject(emailItems),
      text: renderDownloadEmailText({ items: emailItems, expiresInDays, siteUrl }),
      html: renderDownloadEmailHtml({ items: emailItems, expiresInDays, siteUrl }),
    },
    {
      headers: {
        "Idempotency-Key": `stripe-checkout-${session.id}`,
      },
    },
  );

  if (emailError) {
    await supabase
      .from("digital_download_fulfillments")
      .update({ status: "failed", error_message: emailError.message })
      .eq("stripe_session_id", session.id);

    throw new Error(emailError.message);
  }

  await supabase
    .from("digital_download_fulfillments")
    .update({
      status: "sent",
      resend_email_id: emailData?.id ?? null,
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("stripe_session_id", session.id);

  return { status: "sent" };
}
