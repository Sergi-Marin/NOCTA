import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

/** Maps our Plan enum values to Stripe Price IDs (set in env). */
export const STRIPE_PRICES = {
  PRO: process.env.STRIPE_PRICE_PRO!,
  PREMIUM: process.env.STRIPE_PRICE_PREMIUM!,
} as const;

export type StripePlan = keyof typeof STRIPE_PRICES;
