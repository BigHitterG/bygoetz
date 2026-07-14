import "server-only";
import type Stripe from "stripe";
import type { ExplorerSetOptionId } from "./buildASet";

// This is the single Stripe configuration point for the physical three-print set.
// Add one Price ID per existing option plus the shipping settings in Vercel, then redeploy.
const stripePriceIds: Record<ExplorerSetOptionId, string | undefined> = {
  "8x10-print": process.env.STRIPE_EXPLORERS_SET_8X10_PRINT_PRICE_ID,
  "8x10-matted": process.env.STRIPE_EXPLORERS_SET_8X10_MATTED_PRICE_ID,
  "11x14-print": process.env.STRIPE_EXPLORERS_SET_11X14_PRINT_PRICE_ID,
  "11x14-matted": process.env.STRIPE_EXPLORERS_SET_11X14_MATTED_PRICE_ID,
};

const shippingRateId = process.env.STRIPE_EXPLORERS_SET_SHIPPING_RATE_ID;
const allowedCountries = (process.env.STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES ?? "")
  .split(",")
  .map((country) => country.trim().toUpperCase())
  .filter(Boolean) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

export function getExplorerSetStripeConfiguration(optionId?: ExplorerSetOptionId) {
  const priceId = optionId ? stripePriceIds[optionId] : undefined;

  return {
    priceId,
    shippingRateId,
    allowedCountries,
    optionConfigured: Boolean(priceId && shippingRateId && allowedCountries.length),
    allOptionsConfigured: Object.values(stripePriceIds).every(Boolean),
  };
}

export function isExplorerSetCheckoutConfigured() {
  const configuration = getExplorerSetStripeConfiguration();
  return Boolean(
    configuration.allOptionsConfigured &&
      configuration.shippingRateId &&
      configuration.allowedCountries.length,
  );
}

