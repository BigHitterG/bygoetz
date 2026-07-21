import { createHash, createHmac, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendGardenAccountEmail } from "./accountEmails";
import { recordBasilFunnelEvent } from "./funnel";
import { importMyGardenPreview, type MyGardenPlantType } from "./myGarden";
import {
  createGardenName,
  GARDEN_STEWARD_CURRENCY,
  GARDEN_STEWARD_ORDER_TYPE,
  GARDEN_STEWARD_PRICE_CENTS,
} from "./stewards";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

export type PendingGardenPreview = {
  careBalance: number;
  plants: Array<{
    gridX: number;
    gridY: number;
    plantType: MyGardenPlantType;
  }>;
  paths: Array<{ gridX: number; gridY: number }>;
};

export class PendingCheckoutRateLimitError extends Error {
  constructor() {
    super("Too many checkout attempts. Please wait and try again.");
    this.name = "PendingCheckoutRateLimitError";
  }
}

type PendingPurchaseRow = {
  id: string;
  claim_token_hash: string;
  launch_session_id: string | null;
  preview: PendingGardenPreview;
  stripe_session_id: string | null;
  status: string;
  activation_started_at: string | null;
  activation_sent_at: string | null;
  claimed_user_id: string | null;
  expires_at: string;
};

function integerInRange(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

export function normalizePendingGardenPreview(value: unknown): PendingGardenPreview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!integerInRange(record.careBalance, 0, 20)) return null;
  if (!Array.isArray(record.plants) || record.plants.length > 3) return null;
  if (!Array.isArray(record.paths) || record.paths.length > 64) return null;

  const plantTiles = new Set<string>();
  const plants: PendingGardenPreview["plants"] = [];
  for (const candidate of record.plants) {
    if (!candidate || typeof candidate !== "object") return null;
    const plant = candidate as Record<string, unknown>;
    if (
      !integerInRange(plant.gridX, 0, 11) ||
      !integerInRange(plant.gridY, 0, 15) ||
      (plant.plantType !== "rose" &&
        plant.plantType !== "sunflower" &&
        plant.plantType !== "lavender")
    ) {
      return null;
    }
    const key = `${plant.gridX}:${plant.gridY}`;
    if (plantTiles.has(key)) continue;
    plantTiles.add(key);
    plants.push({
      gridX: Number(plant.gridX),
      gridY: Number(plant.gridY),
      plantType: plant.plantType,
    });
  }

  const pathTiles = new Set<string>();
  const paths: PendingGardenPreview["paths"] = [];
  for (const candidate of record.paths) {
    if (!candidate || typeof candidate !== "object") return null;
    const path = candidate as Record<string, unknown>;
    if (!integerInRange(path.gridX, 0, 11) || !integerInRange(path.gridY, 0, 15)) {
      return null;
    }
    const key = `${path.gridX}:${path.gridY}`;
    if (pathTiles.has(key)) continue;
    pathTiles.add(key);
    paths.push({ gridX: Number(path.gridX), gridY: Number(path.gridY) });
  }

  return { careBalance: Number(record.careBalance), plants, paths };
}

function hashClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPendingGardenPurchase(input: {
  preview: PendingGardenPreview;
  launchSessionId: string | null;
  requestIp: string;
}) {
  const claimToken = randomBytes(32).toString("base64url");
  const supabase = getSupabaseAdmin();
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!signingSecret) throw new Error("Basil checkout security is not configured.");
  const requestIpHash = createHmac("sha256", signingSecret)
    .update(input.requestIp || "unknown")
    .digest("hex");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("garden_pending_purchases")
    .select("id", { count: "exact", head: true })
    .eq("request_ip_hash", requestIpHash)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) >= 8) {
    throw new PendingCheckoutRateLimitError();
  }
  const { data, error } = await supabase
    .from("garden_pending_purchases")
    .insert({
      claim_token_hash: hashClaimToken(claimToken),
      launch_session_id: input.launchSessionId,
      preview: input.preview,
      request_ip_hash: requestIpHash,
    })
    .select("id")
    .single();
  if (error) throw error;
  void supabase
    .from("garden_pending_purchases")
    .delete()
    .in("status", ["checkout_created", "failed"])
    .lt("expires_at", new Date().toISOString());
  return { id: data.id as string, claimToken };
}

export async function attachPendingGardenCheckout(
  pendingId: string,
  claimToken: string,
  stripeSessionId: string,
) {
  const { error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .update({ stripe_session_id: stripeSessionId, updated_at: new Date().toISOString() })
    .eq("id", pendingId)
    .eq("claim_token_hash", hashClaimToken(claimToken));
  if (error) throw error;
}

function stripeObjectId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function pendingMetadata(session: Stripe.Checkout.Session) {
  const pendingId = session.metadata?.pending_purchase_id ?? "";
  const claimToken = session.metadata?.pending_claim_token ?? "";
  if (!UUID_PATTERN.test(pendingId) || !CLAIM_TOKEN_PATTERN.test(claimToken)) return null;
  return { pendingId, claimToken };
}

export function isPendingGardenCheckout(session: Stripe.Checkout.Session) {
  return Boolean(pendingMetadata(session));
}

async function provisionPaidGardenAccount(input: {
  row: PendingPurchaseRow;
  claimToken: string;
  buyerEmail: string;
  session: Stripe.Checkout.Session;
}) {
  const supabase = getSupabaseAdmin();
  const activationTime = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("garden_pending_purchases")
    .update({
      status: "activating",
      activation_started_at: activationTime,
      last_error: null,
      updated_at: activationTime,
    })
    .eq("id", input.row.id)
    .is("activation_started_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { status: "already_processing" as const };

  try {
    const temporaryPassword = randomBytes(36).toString("base64url");
    const account = await sendGardenAccountEmail({
      email: input.buyerEmail,
      password: temporaryPassword,
      requestedIntent: "signup",
      origin: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bygoetz.com",
      continueToCheckout: false,
      paidPurchase: true,
      requiresPassword: true,
    });
    if (!account.sent || !account.userId) {
      throw new Error("Basil could not provision the purchased account.");
    }

    const gardenName = createGardenName(account.userId);
    const now = new Date().toISOString();
    const { data: steward, error: stewardError } = await supabase
      .from("garden_stewards")
      .upsert(
        { user_id: account.userId, garden_name: gardenName, updated_at: now },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (stewardError) throw stewardError;

    const { error: entitlementError } = await supabase
      .from("garden_entitlements")
      .upsert(
        {
          steward_id: steward.id,
          product_key: GARDEN_STEWARD_ORDER_TYPE,
          provider: "stripe",
          provider_purchase_id: input.session.id,
          provider_customer_id: stripeObjectId(input.session.customer),
          provider_payment_id: stripeObjectId(input.session.payment_intent),
          amount_paid_cents: input.session.amount_total,
          currency: input.session.currency,
          status: "active",
          purchased_at: new Date(input.session.created * 1000).toISOString(),
          updated_at: now,
        },
        { onConflict: "provider,provider_purchase_id" },
      );
    if (entitlementError) throw entitlementError;

    await importMyGardenPreview(steward.id, input.row.preview);

    const { error: completeError } = await supabase
      .from("garden_pending_purchases")
      .update({
        status: "activation_sent",
        activation_sent_at: now,
        claimed_user_id: account.userId,
        last_error: null,
        updated_at: now,
      })
      .eq("id", input.row.id);
    if (completeError) throw completeError;

    if (input.row.launch_session_id) {
      await Promise.allSettled([
        recordBasilFunnelEvent({
          launchSessionId: input.row.launch_session_id,
          event: "signup_started",
          sourceKey: `paid-account:${input.session.id}`,
        }),
        recordBasilFunnelEvent({
          launchSessionId: input.row.launch_session_id,
          event: "verification_sent",
          sourceKey: `paid-verification:${input.session.id}`,
        }),
      ]);
    }

    return { status: "activation_sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown activation error";
    await supabase
      .from("garden_pending_purchases")
      .update({
        status: "failed",
        activation_started_at: null,
        last_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.row.id);
    throw error;
  }
}

export async function fulfillPendingGardenCheckout(session: Stripe.Checkout.Session) {
  const metadata = pendingMetadata(session);
  if (!metadata) return { status: "skipped" as const };
  if (session.metadata?.order_type !== GARDEN_STEWARD_ORDER_TYPE) {
    return { status: "skipped" as const };
  }
  if (session.payment_status !== "paid") {
    throw new Error("The Basil checkout has not been paid.");
  }
  if (
    session.amount_total !== GARDEN_STEWARD_PRICE_CENTS ||
    session.currency !== GARDEN_STEWARD_CURRENCY
  ) {
    throw new Error("The Basil checkout total does not match the Garden Membership price.");
  }

  const buyerEmail = session.customer_details?.email?.trim().toLowerCase();
  if (!buyerEmail) throw new Error("The paid Basil checkout is missing an email address.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garden_pending_purchases")
    .select(
      "id,claim_token_hash,launch_session_id,preview,stripe_session_id,status,activation_started_at,activation_sent_at,claimed_user_id,expires_at",
    )
    .eq("id", metadata.pendingId)
    .eq("claim_token_hash", hashClaimToken(metadata.claimToken))
    .single();
  if (error) throw error;
  const row = data as PendingPurchaseRow;
  if (row.stripe_session_id && row.stripe_session_id !== session.id) {
    throw new Error("The Basil checkout does not match its saved garden.");
  }

  const now = new Date().toISOString();
  const { error: paidError } = await supabase
    .from("garden_pending_purchases")
    .update({
      stripe_session_id: session.id,
      stripe_customer_id: stripeObjectId(session.customer),
      stripe_payment_id: stripeObjectId(session.payment_intent),
      buyer_email: buyerEmail,
      status: row.activation_sent_at ? row.status : "paid",
      paid_at: row.activation_sent_at ? undefined : now,
      updated_at: now,
    })
    .eq("id", row.id);
  if (paidError) throw paidError;

  if (row.launch_session_id) {
    await Promise.allSettled([
      recordBasilFunnelEvent({
        launchSessionId: row.launch_session_id,
        event: "paywall_viewed",
        sourceKey: `stripe-paywall:${session.id}`,
      }),
      recordBasilFunnelEvent({
        launchSessionId: row.launch_session_id,
        event: "checkout_started",
        sourceKey: `stripe-checkout:${session.id}`,
      }),
      recordBasilFunnelEvent({
        launchSessionId: row.launch_session_id,
        event: "purchase_completed",
        sourceKey: `stripe:${session.id}`,
      }),
    ]);
  }

  if (row.activation_sent_at && row.claimed_user_id) {
    return { status: "activation_sent" as const };
  }
  return provisionPaidGardenAccount({
    row,
    claimToken: metadata.claimToken,
    buyerEmail,
    session,
  });
}
