import { createHash, createHmac, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { sendBasilPurchaseConversion } from "@/lib/analytics/basilMetaServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createPaidGardenSessionHandoff,
  sendPaidGardenVerificationEmail,
} from "./accountEmails";
import { recordBasilFunnelEvent } from "./funnel";
import type { PendingGardenPreview } from "./pendingGardenPreview";
import {
  createGardenName,
  GARDEN_STEWARD_CURRENCY,
  GARDEN_STEWARD_ORDER_TYPE,
  GARDEN_STEWARD_PRICE_CENTS,
} from "./stewards";
import { getBasilOrigin } from "./urls";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;
export const PENDING_GARDEN_CLAIM_COOKIE = "basil_pending_purchase";

export { normalizePendingGardenPreview } from "./pendingGardenPreview";
export type { PendingGardenPreview } from "./pendingGardenPreview";

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
  stripe_customer_id: string | null;
  status: string;
  buyer_email: string | null;
  garden_saved_at: string | null;
  activation_started_at: string | null;
  activation_sent_at: string | null;
  handoff_issued_at: string | null;
  claimed_user_id: string | null;
  last_error: string | null;
  expires_at: string;
};

export type BasilAccountLookup = {
  userId: string;
  emailConfirmed: boolean;
  hasMembership: boolean;
};

function hashClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPendingGardenPurchase(input: {
  preview: PendingGardenPreview;
  launchSessionId: string | null;
  requestIp: string;
  buyerEmail?: string;
  claimedUserId?: string;
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
      buyer_email: input.buyerEmail ?? null,
      claimed_user_id: input.claimedUserId ?? null,
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

export function serializePendingGardenClaim(id: string, claimToken: string) {
  return `${id}.${claimToken}`;
}

function parsePendingGardenClaim(value: string | null | undefined) {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const claimToken = value.slice(separator + 1);
  if (!UUID_PATTERN.test(id) || !CLAIM_TOKEN_PATTERN.test(claimToken)) return null;
  return { id, claimToken };
}

export async function getPendingGardenPurchaseByClaim(
  serializedClaim: string | null | undefined,
) {
  const claim = parsePendingGardenClaim(serializedClaim);
  if (!claim) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .select(
      "id,claim_token_hash,launch_session_id,preview,stripe_session_id,stripe_customer_id,status,buyer_email,garden_saved_at,activation_started_at,activation_sent_at,handoff_issued_at,claimed_user_id,last_error,expires_at",
    )
    .eq("id", claim.id)
    .eq("claim_token_hash", hashClaimToken(claim.claimToken))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data
    ? { row: data as PendingPurchaseRow, claimToken: claim.claimToken }
    : null;
}

export async function refreshPendingGardenPreview(
  pendingId: string,
  claimToken: string,
  preview: PendingGardenPreview,
) {
  const { error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .update({ preview, updated_at: new Date().toISOString() })
    .eq("id", pendingId)
    .eq("claim_token_hash", hashClaimToken(claimToken))
    .is("paid_at", null);
  if (error) throw error;
}

export async function lookupBasilAccountByEmail(
  email: string,
): Promise<BasilAccountLookup | null> {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_basil_account_status_by_email",
    { p_email: email },
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.user_id) return null;
  return {
    userId: String(row.user_id),
    emailConfirmed: row.email_confirmed === true,
    hasMembership: row.has_membership === true,
  };
}

export async function createPendingBasilAccount(email: string, password: string) {
  const existing = await lookupBasilAccountByEmail(email);
  if (existing) return { status: "existing" as const, account: existing };

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });
  if (error || !data.user) {
    const racedAccount = await lookupBasilAccountByEmail(email);
    if (racedAccount) {
      return { status: "existing" as const, account: racedAccount };
    }
    throw error ?? new Error("Basil could not create this account.");
  }
  return { status: "created" as const, userId: data.user.id };
}

export async function removeUnusedPendingBasilAccount(
  userId: string,
  pendingId?: string,
) {
  const supabase = getSupabaseAdmin();
  if (pendingId) {
    await supabase
      .from("garden_pending_purchases")
      .delete()
      .eq("id", pendingId)
      .is("paid_at", null);
  }
  await supabase.auth.admin.deleteUser(userId, false);
}

export async function attachPendingGardenCheckout(
  pendingId: string,
  claimToken: string,
  stripeSessionId: string,
  stripeCustomerId: string | null,
) {
  const { error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .update({
      stripe_session_id: stripeSessionId,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
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

export function getPendingGardenClaimCookieValue(session: Stripe.Checkout.Session) {
  const metadata = pendingMetadata(session);
  return metadata
    ? serializePendingGardenClaim(metadata.pendingId, metadata.claimToken)
    : null;
}

async function provisionPaidGardenAccount(input: {
  row: PendingPurchaseRow;
  buyerEmail: string;
  session: Stripe.Checkout.Session;
}) {
  const supabase = getSupabaseAdmin();
  let gardenSaved = Boolean(input.row.garden_saved_at);
  const activationTime = new Date().toISOString();
  const staleActivation = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("garden_pending_purchases")
    .update({
      status: "activating",
      activation_started_at: activationTime,
      last_error: null,
      updated_at: activationTime,
    })
    .eq("id", input.row.id)
    .or(
      `activation_started_at.is.null,activation_started_at.lt.${staleActivation}`,
    )
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { status: "already_processing" as const };

  try {
    let userId = input.row.claimed_user_id;
    if (!userId) {
      const existing = await lookupBasilAccountByEmail(input.buyerEmail);
      if (!existing) {
        throw new Error("The paid Basil account could not be recovered.");
      }
      userId = existing.userId;
      const { error: attachUserError } = await supabase
        .from("garden_pending_purchases")
        .update({ claimed_user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", input.row.id);
      if (attachUserError) throw attachUserError;
    }

    const gardenName = createGardenName(userId);
    const now = new Date().toISOString();
    const { error: fulfillmentError } = await supabase.rpc(
      "finalize_basil_pending_purchase",
      {
        p_pending_id: input.row.id,
        p_user_id: userId,
        p_garden_name: gardenName,
        p_provider_purchase_id: input.session.id,
        p_provider_customer_id: stripeObjectId(input.session.customer),
        p_provider_payment_id: stripeObjectId(input.session.payment_intent),
        p_amount_paid_cents: input.session.amount_total,
        p_currency: input.session.currency,
        p_purchased_at: new Date(input.session.created * 1000).toISOString(),
      },
    );
    if (fulfillmentError) throw fulfillmentError;
    gardenSaved = true;

    const { data: paidAccount, error: paidAccountError } =
      await supabase.auth.admin.getUserById(userId);
    if (paidAccountError || !paidAccount.user) {
      throw paidAccountError ?? new Error("The paid Basil account could not be loaded.");
    }
    const needsVerification = !paidAccount.user.email_confirmed_at;
    if (needsVerification) {
      const verification = await sendPaidGardenVerificationEmail({
        email: input.buyerEmail,
        origin: getBasilOrigin(),
        idempotencyKey: input.session.id,
      });
      if (verification.userId !== userId) {
        throw new Error("The Basil verification link belongs to another account.");
      }
    }

    const { error: completeError } = await supabase
      .from("garden_pending_purchases")
      .update({
        status: "activation_sent",
        activation_sent_at: now,
        claimed_user_id: userId,
        last_error: null,
        updated_at: now,
      })
      .eq("id", input.row.id);
    if (completeError) throw completeError;

    if (needsVerification && input.row.launch_session_id) {
      await recordBasilFunnelEvent({
        launchSessionId: input.row.launch_session_id,
        event: "verification_sent",
        sourceKey: `paid-verification:${input.session.id}`,
      }).catch(() => undefined);
    }

    return { status: "activation_sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown activation error";
    await supabase
      .from("garden_pending_purchases")
      .update({
        status: gardenSaved ? "paid" : "failed",
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
      "id,claim_token_hash,launch_session_id,preview,stripe_session_id,stripe_customer_id,status,buyer_email,garden_saved_at,activation_started_at,activation_sent_at,handoff_issued_at,claimed_user_id,last_error,expires_at",
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
  if (row.buyer_email && row.buyer_email !== buyerEmail) {
    throw new Error(
      "Stripe used a different email than the Basil account created for this garden.",
    );
  }
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

  if (row.garden_saved_at && row.activation_sent_at && row.claimed_user_id) {
    await sendBasilPurchaseConversion({
      stripeSessionId: session.id,
      launchSessionId: row.launch_session_id,
      email: buyerEmail,
      orderType: session.metadata?.order_type,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    }).catch((metaError) => {
      console.error("Basil Meta Purchase delivery could not start", {
        event: "Purchase",
        message: metaError instanceof Error ? metaError.message : "Unknown error",
      });
    });
    return { status: "activation_sent" as const };
  }
  const result = await provisionPaidGardenAccount({
    row,
    buyerEmail,
    session,
  });
  if (result.status === "activation_sent") {
    await sendBasilPurchaseConversion({
      stripeSessionId: session.id,
      launchSessionId: row.launch_session_id,
      email: buyerEmail,
      orderType: session.metadata?.order_type,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    }).catch((metaError) => {
      console.error("Basil Meta Purchase delivery could not start", {
        event: "Purchase",
        message: metaError instanceof Error ? metaError.message : "Unknown error",
      });
    });
  }
  return result;
}

async function getPendingAccountUser(row: PendingPurchaseRow) {
  if (!row.claimed_user_id) return null;
  const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(
    row.claimed_user_id,
  );
  if (error) throw error;
  return data.user;
}

export async function getPendingGardenAccountStatus(
  serializedClaim: string | null | undefined,
) {
  const pending = await getPendingGardenPurchaseByClaim(serializedClaim);
  if (!pending) return null;
  const user = await getPendingAccountUser(pending.row);
  return {
    pendingId: pending.row.id,
    email: pending.row.buyer_email ?? user?.email ?? "",
    paid: Boolean(pending.row.garden_saved_at),
    verificationSent: Boolean(pending.row.activation_sent_at),
    verified: Boolean(user?.email_confirmed_at),
    finalized: pending.row.status === "claimed",
    status: pending.row.status,
    error: pending.row.last_error ?? null,
  };
}

export async function resendPendingGardenVerification(
  serializedClaim: string | null | undefined,
  resendKey: string,
) {
  const pending = await getPendingGardenPurchaseByClaim(serializedClaim);
  if (!pending?.row.garden_saved_at || !pending.row.claimed_user_id) {
    throw new Error("This paid garden is not ready for account verification yet.");
  }
  const user = await getPendingAccountUser(pending.row);
  const email = pending.row.buyer_email ?? user?.email;
  if (!email) throw new Error("The purchased Basil account has no email address.");
  const verification = await sendPaidGardenVerificationEmail({
    email,
    origin: getBasilOrigin(),
    idempotencyKey: `${pending.row.id}-${resendKey}`,
  });
  if (verification.userId !== pending.row.claimed_user_id) {
    throw new Error("The Basil verification link belongs to another account.");
  }
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .update({
      status: "activation_sent",
      activation_started_at: now,
      activation_sent_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", pending.row.id);
  if (error) throw error;
  if (pending.row.launch_session_id) {
    await recordBasilFunnelEvent({
      launchSessionId: pending.row.launch_session_id,
      event: "verification_sent",
      sourceKey: `paid-verification-resend:${pending.row.id}`,
    });
  }
  return { sent: true as const, email };
}

export async function createPendingGardenSessionHandoff(
  serializedClaim: string | null | undefined,
) {
  const pending = await getPendingGardenPurchaseByClaim(serializedClaim);
  if (!pending?.row.garden_saved_at || !pending.row.claimed_user_id) {
    throw new Error("This paid garden is not ready to sign in yet.");
  }
  const user = await getPendingAccountUser(pending.row);
  const email = pending.row.buyer_email ?? user?.email;
  if (!user?.email_confirmed_at || !email) {
    throw new Error("Confirm the Basil account email before continuing.");
  }
  const previousIssue = pending.row.handoff_issued_at
    ? Date.parse(pending.row.handoff_issued_at)
    : 0;
  if (Number.isFinite(previousIssue) && Date.now() - previousIssue < 15_000) {
    throw new Error("Basil is already finishing this sign-in. Please wait a moment.");
  }
  const handoff = await createPaidGardenSessionHandoff(email);
  if (handoff.userId !== pending.row.claimed_user_id) {
    throw new Error("The Basil sign-in belongs to another account.");
  }
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("garden_pending_purchases")
    .update({ handoff_issued_at: now, updated_at: now })
    .eq("id", pending.row.id);
  if (error) throw error;
  return { tokenHash: handoff.tokenHash, type: handoff.type };
}
