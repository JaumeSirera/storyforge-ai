// Server-only Stripe client. Never import from client code.
import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_TEST_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_TEST_API_KEY no configurado");
  _stripe = new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });
  return _stripe;
}
