import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { claimGardenAccountEmailRequest } from "./accountEmails";
import { importMyGardenPreview } from "./myGarden";
import type { PendingGardenPreview } from "./pendingGardenPreview";
import {
  hashGardenPromoCode,
  normalizeGardenPromoCode,
} from "./promoCode";
import {
  createGardenName,
  GARDEN_STEWARD_ORDER_TYPE,
} from "./stewards";

const GIFT_CODE_HASH =
  "28aaf815a9d2cb8a6f79d1c73c015d1e7fab50fb5f26fdd4768ab7b950aa809e";
const GIFT_PROVIDER_PURCHASE_ID = "promo:private-friend-gift-2026";

export class GardenPromoRateLimitError extends Error {
  constructor() {
    super("Too many gift-code attempts. Please wait and try again.");
    this.name = "GardenPromoRateLimitError";
  }
}

export async function claimGardenPromoAttempt(
  accountReference: string,
  requestIp: string,
) {
  const allowed = await claimGardenAccountEmailRequest(
    `gift:${accountReference}`,
    requestIp,
    "signup",
  );
  if (!allowed) throw new GardenPromoRateLimitError();
}

export async function createComplimentaryBasilAccount(
  email: string,
  password: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("Basil could not create this account.");
  }
  return data.user.id;
}

export async function removeUnusedComplimentaryBasilAccount(userId: string) {
  await getSupabaseAdmin().auth.admin.deleteUser(userId, false);
}

export function isRecognizedGardenPromoCode(value: unknown) {
  const normalizedCode = normalizeGardenPromoCode(value);
  if (!normalizedCode) return false;
  const submittedHash = Buffer.from(hashGardenPromoCode(normalizedCode), "hex");
  const expectedHash = Buffer.from(GIFT_CODE_HASH, "hex");
  return (
    submittedHash.length === expectedHash.length &&
    timingSafeEqual(submittedHash, expectedHash)
  );
}

export async function redeemGardenPromo(input: {
  userId: string;
  code: unknown;
  preview: PendingGardenPreview;
}) {
  if (!isRecognizedGardenPromoCode(input.code)) {
    throw new Error("That gift code is invalid or has already been used.");
  }

  const supabase = getSupabaseAdmin();
  const { data: existingGrant, error: existingGrantError } = await supabase
    .from("garden_entitlements")
    .select("steward_id,status")
    .eq("provider", "promo")
    .eq("provider_purchase_id", GIFT_PROVIDER_PURCHASE_ID)
    .maybeSingle();
  if (existingGrantError) throw existingGrantError;

  let stewardId: string;
  if (existingGrant) {
    const { data: existingSteward, error: existingStewardError } = await supabase
      .from("garden_stewards")
      .select("id,user_id")
      .eq("id", existingGrant.steward_id)
      .maybeSingle();
    if (existingStewardError) throw existingStewardError;
    if (
      !existingSteward ||
      existingSteward.user_id !== input.userId ||
      existingGrant.status !== "active"
    ) {
      throw new Error("That gift code is invalid or has already been used.");
    }
    stewardId = String(existingSteward.id);
  } else {
    const { data: steward, error: stewardError } = await supabase
      .from("garden_stewards")
      .upsert(
        {
          user_id: input.userId,
          garden_name: createGardenName(input.userId),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (stewardError) throw stewardError;
    stewardId = String(steward.id);

    const { error: entitlementError } = await supabase
      .from("garden_entitlements")
      .insert({
        steward_id: stewardId,
        product_key: GARDEN_STEWARD_ORDER_TYPE,
        provider: "promo",
        provider_purchase_id: GIFT_PROVIDER_PURCHASE_ID,
        amount_paid_cents: 0,
        currency: "usd",
        status: "active",
        purchased_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    if (entitlementError) {
      // The provider/purchase uniqueness constraint is the durable one-use lock.
      if (entitlementError.code !== "23505") throw entitlementError;
      throw new Error("That gift code is invalid or has already been used.");
    }
  }

  let previewImported = false;
  try {
    const garden = await importMyGardenPreview(stewardId, input.preview);
    previewImported = Boolean(garden);
  } catch (error) {
    // Access is durable; the client retains and retries the guest preview import.
    console.error("Basil gift preview import will be retried", {
      userId: input.userId,
      message: error instanceof Error ? error.message : "Unknown import error",
    });
  }
  return {
    stewardId,
    previewImported,
  };
}
