import { NextResponse } from "next/server";
import Stripe from "stripe";
import { fulfillDigitalDownloadCheckout } from "@/lib/explorers/fulfillDigitalDownload";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSuccessEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (checkoutSuccessEvents.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await fulfillDigitalDownloadCheckout(session);
      return NextResponse.json({ received: true, fulfillment: result });
    }

    return NextResponse.json({ received: true, ignored: event.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    console.error("Stripe webhook fulfillment failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
