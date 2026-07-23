import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const SUBSCRIPTION_METADATA_KEY = 'clerkUserId';

// Stripe subscription status → whether the user should have Pro access.
// Partial<Record<...>> keeps the lookup `boolean | undefined` so an unrecognised
// status (e.g. one Stripe adds later) falls through to the deny-by-default path
// instead of being narrowed away by the compiler.
const STATUS_GRANTS_ACCESS: Partial<Record<Stripe.Subscription.Status, boolean>> = {
  active: true,
  trialing: true,
  past_due: false,
  unpaid: false,
  canceled: false,
  incomplete: false,
  incomplete_expired: false,
  paused: false,
};

function logWebhook(
  level: 'warn' | 'error',
  message: string,
  context: Record<string, unknown> = {}
): void {
  const line = `[stripe-webhook] ${message}`;
  if (level === 'error') console.error(line, context);
  else console.warn(line, context);
}

function grantsAccess(status: Stripe.Subscription.Status): boolean {
  const mapped = STATUS_GRANTS_ACCESS[status];
  if (mapped === undefined) {
    logWebhook('warn', 'Unrecognised subscription status — denying access', { status });
    return false;
  }
  return mapped;
}

function customerIdOf(
  customer: string | { id: string } | null | undefined
): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

/**
 * Merge-patch Clerk metadata. Reads the current user first and spreads the
 * existing objects so unrelated keys are never dropped.
 */
async function patchUserMetadata(
  userId: string,
  patch: { publicPatch?: Record<string, unknown>; privatePatch?: Record<string, unknown> }
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const params: Parameters<typeof client.users.updateUserMetadata>[1] = {};
  if (patch.publicPatch) {
    params.publicMetadata = {
      ...(user.publicMetadata ?? {}),
      ...patch.publicPatch,
    };
  }
  if (patch.privatePatch) {
    params.privateMetadata = {
      ...(user.privateMetadata ?? {}),
      ...patch.privatePatch,
    };
  }

  await client.users.updateUserMetadata(userId, params);
}

/**
 * Set Pro access. Granting access always clears any outstanding
 * payment-failure marker; revoking leaves it in place so the UI can still
 * prompt for a new card.
 */
async function setAccess(userId: string, subscribed: boolean): Promise<void> {
  await patchUserMetadata(userId, {
    publicPatch: subscribed
      ? { subscribed: true, paymentFailedAt: null }
      : { subscribed: false },
  });
}

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

/**
 * Stamp the Clerk user ID onto the Stripe subscription so every future event
 * for it resolves directly, without the Clerk-wide scan. Best-effort: a
 * failure here must never block an access change.
 */
async function attachClerkUserId(
  subscriptionId: string,
  clerkUserId: string,
  knownMetadata?: Stripe.Metadata | null
): Promise<void> {
  try {
    const existing =
      knownMetadata ?? (await stripe.subscriptions.retrieve(subscriptionId)).metadata ?? {};
    if (existing[SUBSCRIPTION_METADATA_KEY] === clerkUserId) return;
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { ...existing, [SUBSCRIPTION_METADATA_KEY]: clerkUserId },
    });
  } catch (err) {
    logWebhook('warn', 'Could not write clerkUserId onto subscription metadata', {
      subscriptionId,
      clerkUserId,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolve a subscription to a Clerk user ID.
 *   1. subscription.metadata.clerkUserId (set at checkout, or backfilled below)
 *   2. Clerk user whose privateMetadata.stripeCustomerId matches — then backfill
 *      the subscription metadata so step 1 wins next time.
 * Returns null when neither resolves; the caller logs and acks.
 */
async function resolveClerkUserId(
  subscription: Stripe.Subscription,
  options: { backfill: boolean }
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.[SUBSCRIPTION_METADATA_KEY];
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) return fromMetadata;

  const customerId = customerIdOf(subscription.customer);
  if (!customerId) return null;

  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return null;

  if (options.backfill) {
    await attachClerkUserId(subscription.id, user.id, subscription.metadata);
  }
  return user.id;
}

function unresolved(
  eventType: string,
  context: Record<string, unknown>
): NextResponse {
  logWebhook('error', 'Could not resolve a Clerk user — access unchanged', {
    eventType,
    ...context,
  });
  // Ack so Stripe stops retrying; the log line above is the investigation hook.
  return NextResponse.json({ received: true, unresolved: true, eventType });
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
      const customerId = customerIdOf(session.customer);
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null;

      if (!userId) {
        return unresolved(event.type, { sessionId: session.id, customerId });
      }

      await patchUserMetadata(userId, {
        publicPatch: { subscribed: true, paymentFailedAt: null },
        ...(customerId ? { privatePatch: { stripeCustomerId: customerId } } : {}),
      });

      // Carry the Clerk user ID onto the subscription so subsequent
      // customer.subscription.* events resolve without the Clerk-wide scan.
      if (subscriptionId) {
        await attachClerkUserId(subscriptionId, userId);
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveClerkUserId(subscription, { backfill: true });

      if (!userId) {
        return unresolved(event.type, {
          subscriptionId: subscription.id,
          customerId: customerIdOf(subscription.customer),
          status: subscription.status,
        });
      }

      await setAccess(userId, grantsAccess(subscription.status));
      return NextResponse.json({ received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      // No backfill — the subscription is gone, so writing metadata to it is pointless.
      const userId = await resolveClerkUserId(subscription, { backfill: false });

      if (!userId) {
        return unresolved(event.type, {
          subscriptionId: subscription.id,
          customerId: customerIdOf(subscription.customer),
        });
      }

      await setAccess(userId, false);
      return NextResponse.json({ received: true });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = customerIdOf(invoice.customer);

      if (!customerId) {
        return unresolved(event.type, { invoiceId: invoice.id });
      }

      const user = await findUserByStripeCustomerId(customerId);
      if (!user) {
        return unresolved(event.type, { invoiceId: invoice.id, customerId });
      }

      // Marker only. customer.subscription.updated is the source of truth for
      // access and Stripe sends it alongside, so `subscribed` is untouched here.
      await patchUserMetadata(user.id, {
        publicPatch: { paymentFailedAt: new Date(event.created * 1000).toISOString() },
      });

      return NextResponse.json({ received: true });
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (!userId) {
        return unresolved(event.type, {
          sessionId: session.id,
          customerId: customerIdOf(session.customer),
        });
      }

      // The session may already have written subscribed: true — revoke it.
      await patchUserMetadata(userId, {
        publicPatch: {
          subscribed: false,
          paymentFailedAt: new Date(event.created * 1000).toISOString(),
        },
      });

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    logWebhook('error', 'Handler threw', { eventType: event.type, detail: message });
    // 500 so Stripe retries — a transient Clerk/Stripe outage must not silently
    // drop an access change.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
