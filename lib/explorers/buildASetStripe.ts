import "server-only";
import type Stripe from "stripe";
import type { ExplorerSetOptionId } from "./buildASet";

// This is the single Stripe configuration point for the physical three-print set.
// Add one Price ID per existing option plus the shipping settings in Vercel, then redeploy.
const stripePriceIds: Record<ExplorerSetOptionId, string | undefined> = {
  "8x10-print": process.env.STRIPE_EXPLORERS_SET_8X10_PRINT_PRICE_ID ?? "price_1Tt7GbDAkj43M87SnZv0ukPM",
  "8x10-matted": process.env.STRIPE_EXPLORERS_SET_8X10_MATTED_PRICE_ID ?? "price_1Tt7HNDAkj43M87SfBxVDKIp",
  "11x14-print": process.env.STRIPE_EXPLORERS_SET_11X14_PRINT_PRICE_ID ?? "price_1Tt7HODAkj43M87SaV9we9RN",
  "11x14-matted": process.env.STRIPE_EXPLORERS_SET_11X14_MATTED_PRICE_ID ?? "price_1Tt7HODAkj43M87SHJyNXYkU",
};

const shippingRateId = process.env.STRIPE_EXPLORERS_SET_SHIPPING_RATE_ID;
const parsedShippingAmount = Number.parseInt(process.env.STRIPE_EXPLORERS_SET_SHIPPING_CENTS ?? "1200", 10);
const shippingAmountCents = Number.isFinite(parsedShippingAmount) ? parsedShippingAmount : 1200;
const allowedCountries = (process.env.STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES ?? "")
  .split(",")
  .map((country) => country.trim().toUpperCase())
  .filter(Boolean) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

const checkoutCountries = allowedCountries.length
  ? allowedCountries
  : (["US"] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[]);

export function getExplorerSetStripeConfiguration(optionId?: ExplorerSetOptionId) {
  const priceId = optionId ? stripePriceIds[optionId] : undefined;

  return {
    priceId,
    shippingRateId,
    shippingAmountCents,
    allowedCountries: checkoutCountries,
    optionConfigured: Boolean(priceId),
    allOptionsConfigured: Object.values(stripePriceIds).every(Boolean),
  };
}

export function isExplorerSetCheckoutConfigured() {
  const configuration = getExplorerSetStripeConfiguration();
  return configuration.allOptionsConfigured;
}

