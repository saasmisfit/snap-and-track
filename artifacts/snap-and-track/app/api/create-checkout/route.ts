import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

type Plan = 'monthly' | 'annual';

function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'annual';
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => ({}));
  const rawPriceId =
    body && typeof body === 'object' && 'priceId' in body
      ? (body as { priceId: unknown }).priceId
      : undefined;

  if (!isPlan(rawPriceId)) {
    return NextResponse.json(
      { error: 'Invalid "priceId" — expected "monthly" or "annual"' },
      { status: 400 }
    );
  }
  const plan: Plan = rawPriceId;

  const priceIdByPlan: Record<Plan, string | undefined> = {
    monthly: process.env.STRIPE_PRICE_ID,
    annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  };
  const priceId = priceIdByPlan[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: `Server is not configured with a Stripe price ID for the "${plan}" plan` },
      { status: 500 }
    );
  }

  const isMonthly = plan === 'monthly';

  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      ...(isMonthly ? { subscription_data: { trial_period_days: 3 } } : {}),
      success_url: `${appUrl}/subscribe/success?plan=${plan}`,
      cancel_url: `${appUrl}/subscribe`,
      ...(email ? { customer_email: email } : {}),
      metadata: { userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
