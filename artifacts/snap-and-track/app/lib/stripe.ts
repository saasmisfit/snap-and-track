import Stripe from 'stripe';

let client: Stripe | null = null;

// Created on first use rather than at import, so a build without
// STRIPE_SECRET_KEY (e.g. a Preview with no Stripe vars) still succeeds.
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  client = new Stripe(key);
  return client;
}
