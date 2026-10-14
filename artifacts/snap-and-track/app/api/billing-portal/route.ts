import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const PORTAL_UNAVAILABLE =
  'Billing portal is not available right now. Please email help@munchsnapper.com';

// Opens the Stripe customer portal (cancel, update card, invoices) for the
// signed-in user. The customer ID comes only from the user's Clerk
// privateMetadata, written by the webhook on checkout.session.completed —
// never from the request.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[billing-portal] STRIPE_SECRET_KEY is not set');
    return NextResponse.json({ error: PORTAL_UNAVAILABLE }, { status: 500 });
  }

  const user = await currentUser();
  const stored = (user?.privateMetadata as { stripeCustomerId?: unknown } | undefined)
    ?.stripeCustomerId;
  const customerId = typeof stored === 'string' && stored.length > 0 ? stored : null;
  if (!customerId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/app`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Typically: no portal configuration saved in the Stripe dashboard, or the
    // customer no longer exists. Log type and message only.
    const detail =
      err instanceof Stripe.errors.StripeError
        ? { type: err.type, code: err.code, message: err.message }
        : { message: err instanceof Error ? err.message : String(err) };
    console.error('[billing-portal] Could not create portal session', { userId, ...detail });
    return NextResponse.json({ error: PORTAL_UNAVAILABLE }, { status: 502 });
  }
}
