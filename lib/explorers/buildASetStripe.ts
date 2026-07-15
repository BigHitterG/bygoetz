import "server-only";
import type Stripe from "stripe";

const shippingRateId = process.env.STRIPE_EXPLORERS_SET_SHIPPING_RATE_ID;
const parsedShippingAmount = Number.parseInt(
  process.env.STRIPE_EXPLORERS_SET_SHIPPING_CENTS ?? "1200",
  10,
);
const shippingAmountCents = Number.isFinite(parsedShippingAmount)
  ? parsedShippingAmount
  : 1200;
const allowedCountries = (process.env.STRIPE_EXPLORERS_SET_ALLOWED_COUNTRIES ?? "")
  .split(",")
  .map((country) => country.trim().toUpperCase())
  .filter(Boolean) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

const checkoutCountries = allowedCountries.length
  ? allowedCountries
  : (["US"] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[]);

export function getExplorerSetStripeConfiguration() {
  return {
    shippingRateId,
    shippingAmountCents,
    allowedCountries: checkoutCountries,
    checkoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

export function isExplorerSetCheckoutConfigured() {
  return getExplorerSetStripeConfiguration().checkoutConfigured;
}

