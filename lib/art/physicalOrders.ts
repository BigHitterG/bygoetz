import "server-only";

import type Stripe from "stripe";
import { getResend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getArtPrint } from "./prints";
import { ART_PRINT_ORDER_TYPE } from "./orderTypes";

type ShippingDetails = {
  name: string | null;
  address: {
    city: string | null;
    country: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    state: string | null;
  } | null;
};

type NotificationOutcome = {
  status: "sent" | "failed" | "skipped";
  id?: string | null;
  error?: string;
};

function getCustomerEmail(session: Stripe.Checkout.Session) {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

function getStripeId(
  value: string | { id: string } | null | undefined,
) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function getShippingDetails(session: Stripe.Checkout.Session): ShippingDetails {
  const collected = session as Stripe.Checkout.Session & {
    collected_information?: {
      shipping_details?: ShippingDetails | null;
    } | null;
  };
  const shipping = collected.collected_information?.shipping_details;

  if (shipping) return shipping;

  return {
    name: session.customer_details?.name ?? null,
    address: session.customer_details?.address ?? null,
  };
}

function getOwnerRecipients() {
  return Array.from(
    new Set(
      (process.env.ART_PRINT_ORDER_EMAILS ?? "info@bygoetz.com")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatAddress(details: ShippingDetails) {
  const address = details.address;
  if (!address) return "Shipping address unavailable";

  return [
    details.name,
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function compactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 240);
}

async function sendNotification(input: {
  to: string[];
  from: string;
  replyTo?: string[];
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}): Promise<NotificationOutcome> {
  try {
    const { data, error } = await getResend().emails.send(
      {
        from: input.from,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (error) {
      return { status: "failed", error: error.message.slice(0, 240) };
    }

    return { status: "sent", id: data?.id ?? null };
  } catch (error) {
    return { status: "failed", error: compactError(error) };
  }
}

export async function processArtPrintOrder(session: Stripe.Checkout.Session) {
  if (session.metadata?.order_type !== ART_PRINT_ORDER_TYPE) {
    return { status: "skipped" as const, reason: "Not an art-print order." };
  }

  const slug = session.metadata.art_print_slug;
  const print = slug ? getArtPrint(slug) : undefined;
  const quantity = Number.parseInt(session.metadata.quantity ?? "", 10);

  if (!print || quantity !== 1) {
    return {
      status: "skipped" as const,
      reason: "Checkout session is not an eligible paid art-print order.",
    };
  }

  const expectedSubtotal = print.unitAmount * quantity;
  if (
    session.payment_status !== "paid" ||
    session.currency?.toLowerCase() !== print.currency ||
    session.amount_subtotal !== expectedSubtotal ||
    session.amount_total === null ||
    session.amount_total < expectedSubtotal
  ) {
    return {
      status: "skipped" as const,
      reason: "Checkout session is not an eligible paid art-print order.",
    };
  }

  const customerEmail = getCustomerEmail(session);
  const shipping = getShippingDetails(session);
  const paymentIntentId = getStripeId(session.payment_intent);
  const customerId = getStripeId(session.customer);
  const now = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const orderFields =
    "id,customer_notified_at,owner_notified_at,customer_email_id,owner_email_id";
  const { data: insertedOrder, error: insertError } = await supabase
    .from("art_print_orders")
    .insert({
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      print_slug: print.slug,
      print_title: print.title,
      quantity,
      currency: print.currency,
      subtotal_amount: session.amount_subtotal,
      shipping_amount: session.total_details?.amount_shipping ?? 0,
      tax_amount: session.total_details?.amount_tax ?? 0,
      total_amount: session.amount_total,
      buyer_email: customerEmail,
      buyer_name: session.customer_details?.name ?? null,
      shipping_name: shipping.name,
      shipping_address: shipping.address,
      fulfillment_status: "paid",
      updated_at: now,
    })
    .select(orderFields)
    .single();

  let order = insertedOrder;
  if (insertError?.code === "23505") {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("art_print_orders")
      .select(orderFields)
      .eq("stripe_session_id", session.id)
      .single();

    if (existingOrderError || !existingOrder) {
      throw new Error(
        `Could not read existing art-print order ${session.id}: ${
          existingOrderError?.message ?? "No row returned"
        }`,
      );
    }
    order = existingOrder;
  } else if (insertError || !order) {
    throw new Error(
      `Could not record art-print order ${session.id}: ${
        insertError?.message ?? "No row returned"
      }`,
    );
  }

  const from =
    process.env.ART_PRINT_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo =
    process.env.ART_PRINT_REPLY_TO_EMAIL?.trim() ||
    process.env.RESEND_REPLY_TO_EMAIL?.trim() ||
    "info@bygoetz.com";
  const address = formatAddress(shipping);
  const total = formatMoney(session.amount_total, print.currency);
  let customerOutcome: NotificationOutcome = order.customer_notified_at
    ? { status: "sent", id: order.customer_email_id }
    : { status: "skipped", error: "Customer notification is not configured." };
  let ownerOutcome: NotificationOutcome = order.owner_notified_at
    ? { status: "sent", id: order.owner_email_id }
    : { status: "skipped", error: "Owner notification is not configured." };

  if (process.env.RESEND_API_KEY && from) {
    const customerText = [
      `Thank you for ordering ${print.title}.`,
      "",
      `${print.dimensions.width} × ${print.dimensions.height} in. open-edition art print`,
      `Order total: ${total}`,
      "",
      "Shipping to:",
      address,
      "",
      "Thomas will follow up when your print ships.",
    ].join("\n");
    const ownerText = [
      `New ${print.title} print order`,
      "",
      `Stripe session: ${session.id}`,
      `Customer: ${session.customer_details?.name ?? "Not supplied"}`,
      `Email: ${customerEmail ?? "Not supplied"}`,
      `Order total: ${total}`,
      "",
      "Shipping to:",
      address,
    ].join("\n");

    const sends: Promise<void>[] = [];
    if (!order.customer_notified_at && customerEmail) {
      sends.push(
        sendNotification({
          to: [customerEmail],
          from,
          replyTo: [replyTo],
          subject: `Order received — ${print.title}`,
          text: customerText,
          html: `<p>Thank you for ordering <strong>${escapeHtml(print.title)}</strong>.</p><p>${print.dimensions.width} × ${print.dimensions.height} in. open-edition art print<br>Order total: ${escapeHtml(total)}</p><p><strong>Shipping to:</strong><br>${escapeHtml(address).replaceAll("\n", "<br>")}</p><p>Thomas will follow up when your print ships.</p>`,
          idempotencyKey: `art-print-customer-${session.id}`,
        }).then((outcome) => {
          customerOutcome = outcome;
        }),
      );
    }
    if (!order.owner_notified_at) {
      sends.push(
        sendNotification({
          to: getOwnerRecipients(),
          from,
          replyTo: customerEmail ? [customerEmail] : [replyTo],
          subject: `New art-print order — ${print.title}`,
          text: ownerText,
          html: `<p><strong>New ${escapeHtml(print.title)} print order</strong></p><p>Stripe session: ${escapeHtml(session.id)}<br>Customer: ${escapeHtml(session.customer_details?.name ?? "Not supplied")}<br>Email: ${escapeHtml(customerEmail ?? "Not supplied")}<br>Order total: ${escapeHtml(total)}</p><p><strong>Shipping to:</strong><br>${escapeHtml(address).replaceAll("\n", "<br>")}</p>`,
          idempotencyKey: `art-print-owner-${session.id}`,
        }).then((outcome) => {
          ownerOutcome = outcome;
        }),
      );
    }

    await Promise.all(sends);
  }

  const customerDone = !customerEmail || customerOutcome.status === "sent";
  const ownerDone = ownerOutcome.status === "sent";
  const anySent = customerOutcome.status === "sent" || ownerOutcome.status === "sent";
  const allSkipped =
    customerOutcome.status === "skipped" && ownerOutcome.status === "skipped";
  const notificationStatus =
    customerDone && ownerDone
      ? "sent"
      : allSkipped
        ? "skipped"
        : anySent
          ? "partial"
          : "failed";
  const notificationErrors = [customerOutcome.error, ownerOutcome.error]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);

  const { error: notificationUpdateError } = await supabase
    .from("art_print_orders")
    .update({
      notification_status: notificationStatus,
      customer_notified_at:
        customerOutcome.status === "sent"
          ? order.customer_notified_at ?? now
          : order.customer_notified_at,
      owner_notified_at:
        ownerOutcome.status === "sent" ? order.owner_notified_at ?? now : order.owner_notified_at,
      customer_email_id: customerOutcome.id ?? order.customer_email_id,
      owner_email_id: ownerOutcome.id ?? order.owner_email_id,
      notification_error: notificationErrors || null,
      updated_at: now,
    })
    .eq("stripe_session_id", session.id);

  if (notificationUpdateError) {
    // The paid order is already safely recorded. A notification bookkeeping
    // failure must not make Stripe retry otherwise-complete fulfillment.
    console.error("Art print notification state could not be saved", {
      stripeSessionId: session.id,
      error: notificationUpdateError.message,
    });
  }

  return {
    status: "processed" as const,
    orderId: order.id,
    notificationStatus,
  };
}
