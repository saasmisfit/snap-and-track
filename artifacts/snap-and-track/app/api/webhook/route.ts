import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function findUserByStripeCustomerId(customerId: string) {
  const client = await clerkClient();
  let offset = 0;
  const limit = 100;
  // Paginate through Clerk users and match on privateMetadata.stripeCustomerId.
  // Fine for low volumes; swap for a DB lookup once we have more than a few hundred users.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await client.users.getUserList({ limit, offset });
    const users = page.data;
    const match = users.find(
      (u) => (u.privateMetadata as { stripeCustomerId?: string } | null)?.stripeCustomerId === customerId,
    );
    if (match) return match;
    if (users.length < limit) return null;
    offset += limit;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const body = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;

      if (userId) {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { subscribed: true },
          ...(customerId ? { privateMetadata: { stripeCustomerId: customerId } } : {}),
        });
      }
      return NextResponse.json({ received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      const user = await findUserByStripeCustomerId(customerId);
      if (user) {
        const client = await clerkClient();
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: { subscribed: false },
        });
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
