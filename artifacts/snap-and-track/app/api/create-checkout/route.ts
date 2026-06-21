import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => ({}));
  const requestedPriceId =
    body && typeof body === 'object' && 'priceId' in body
      ? String((body as { priceId: unknown }).priceId ?? '')
      : '';

  const monthlyPriceId = process.env.STRIPE_PRICE_ID as string;
  const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID as string;

  let priceId: string;
  if (!requestedPriceId) {
    priceId = monthlyPriceId;
  } else if (requestedPriceId === 'annual') {
    priceId = annualPriceId;
  } else if (requestedPriceId === 'monthly') {
    priceId = monthlyPriceId;
  } else {
    priceId = requestedPriceId;
  }

  const isMonthly = priceId === monthlyPriceId;

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
      success_url: `${appUrl}/subscribe/success`,
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
