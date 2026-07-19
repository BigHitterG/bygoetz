import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const GARDEN_STEWARD_PRICE_CENTS = 699;
export const GARDEN_STEWARD_CURRENCY = "usd";
export const GARDEN_STEWARD_ORDER_TYPE = "basil_founding_gardener";

export const GARDEN_FEEDBACK_CATEGORIES = [
  "plants",
  "care",
  "exploration",
  "almanac",
  "accessibility",
  "other",
] as const;

export type GardenFeedbackCategory = (typeof GARDEN_FEEDBACK_CATEGORIES)[number];

const CATEGORY_CANDIDATES: Record<GardenFeedbackCategory, string | null> = {
  plants: "new_global_plant",
  care: "care_interactions",
  exploration: "shareable_coordinates",
  almanac: "almanac_expansion",
  accessibility: "accessibility",
  other: null,
};

const NAME_ADJECTIVES = [
  "Amber",
  "Breezy",
  "Clever",
  "Dewy",
  "Gentle",
  "Golden",
  "Green",
  "Happy",
  "Hidden",
  "Kind",
  "Little",
  "Misty",
  "Mossy",
  "Quiet",
  "Sunny",
  "Wild",
];

const NAME_NOUNS = [
  "Badger",
  "Bee",
  "Finch",
  "Fox",
  "Frog",
  "Hare",
  "Heron",
  "Moth",
  "Otter",
  "Robin",
  "Snail",
  "Sparrow",
  "Toad",
  "Turtle",
  "Wren",
  "Yarrow",
];

export type GardenStewardRecord = {
  id: string;
  user_id: string;
  garden_name: string;
  purchased_at: string;
};

export function createGardenName(userId: string) {
  const digest = createHash("sha256").update(userId).digest("hex");
  const adjective = NAME_ADJECTIVES[Number.parseInt(digest.slice(0, 2), 16) % NAME_ADJECTIVES.length];
  const noun = NAME_NOUNS[Number.parseInt(digest.slice(2, 4), 16) % NAME_NOUNS.length];
  return `${adjective} ${noun} ${digest.slice(4, 8).toUpperCase()}`;
}

function getStripeObjectId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function getPaidGardenSessionDetails(session: Stripe.Checkout.Session) {
  if (session.metadata?.order_type !== GARDEN_STEWARD_ORDER_TYPE) return null;
  if (session.payment_status !== "paid") {
    throw new Error("The Basil checkout has not been paid.");
  }
  if (
    session.amount_total !== GARDEN_STEWARD_PRICE_CENTS ||
    session.currency !== GARDEN_STEWARD_CURRENCY
  ) {
    throw new Error("The Basil checkout total does not match the Garden Membership price.");
  }

  const userId = session.metadata.user_id ?? "";
  const gardenName = (session.metadata.garden_name ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
    !/^[A-Za-z]+ [A-Za-z]+ [0-9A-F]{4}$/.test(gardenName)
  ) {
    throw new Error("The Basil checkout is missing a valid account.");
  }

  return { userId, gardenName };
}

export async function fulfillGardenStewardCheckout(session: Stripe.Checkout.Session) {
  const details = getPaidGardenSessionDetails(session);
  if (!details) return { status: "skipped" as const };

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: steward, error: stewardError } = await supabase
    .from("garden_stewards")
    .upsert(
      {
        user_id: details.userId,
        garden_name: details.gardenName,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select("id,user_id,garden_name")
    .single();

  if (stewardError) throw stewardError;

  const entitlement = {
    steward_id: steward.id,
    product_key: GARDEN_STEWARD_ORDER_TYPE,
    provider: "stripe",
    provider_purchase_id: session.id,
    provider_customer_id: getStripeObjectId(session.customer),
    provider_payment_id: getStripeObjectId(session.payment_intent),
    amount_paid_cents: session.amount_total,
    currency: session.currency,
    status: "active",
    purchased_at: new Date(session.created * 1000).toISOString(),
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("garden_entitlements")
    .upsert(entitlement, { onConflict: "provider,provider_purchase_id" })
    .select("purchased_at")
    .single();

  if (error) throw error;

  return {
    status: "fulfilled" as const,
    steward: {
      ...steward,
      purchased_at: data.purchased_at,
    } as GardenStewardRecord,
  };
}

export async function getGardenStewardByUserId(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: steward, error: stewardError } = await supabase
    .from("garden_stewards")
    .select("id,user_id,garden_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (stewardError) throw stewardError;
  if (!steward) return null;

  const { data: entitlement, error: entitlementError } = await supabase
    .from("garden_entitlements")
    .select("purchased_at")
    .eq("steward_id", steward.id)
    .eq("product_key", GARDEN_STEWARD_ORDER_TYPE)
    .eq("status", "active")
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (entitlementError) throw entitlementError;
  if (!entitlement) return null;

  return {
    ...steward,
    purchased_at: entitlement.purchased_at,
  } as GardenStewardRecord;
}

async function countPlants(filters?: {
  plantType?: string;
  plantedAfter?: string;
  wateredAfter?: string;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("community_garden_roses")
    .select("id", { count: "exact", head: true });

  if (filters?.plantType) query = query.eq("plant_type", filters.plantType);
  if (filters?.plantedAfter) query = query.gte("planted_at", filters.plantedAfter);
  if (filters?.wateredAfter) query = query.gte("last_watered_at", filters.wateredAfter);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getGardenAlmanac() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [total, roses, sunflowers, lavender, planted24h, active24h] = await Promise.all([
    countPlants(),
    countPlants({ plantType: "rose" }),
    countPlants({ plantType: "sunflower" }),
    countPlants({ plantType: "lavender" }),
    countPlants({ plantedAfter: since }),
    countPlants({ wateredAfter: since }),
  ]);

  return {
    total,
    planted24h,
    active24h,
    byType: { rose: roses, sunflower: sunflowers, lavender },
    measuredAt: new Date().toISOString(),
  };
}

export async function getGardenFeedback(stewardId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garden_feedback")
    .select("id,category,message,status,created_at,matched_candidate_key")
    .eq("steward_id", stewardId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function submitGardenFeedback(
  stewardId: string,
  category: GardenFeedbackCategory,
  message: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("garden_feedback")
    .insert({
      steward_id: stewardId,
      category,
      message,
      status: "received",
      matched_candidate_key: CATEGORY_CANDIDATES[category],
    })
    .select("id,category,message,status,created_at,matched_candidate_key")
    .single();

  if (error) throw error;
  return data;
}
