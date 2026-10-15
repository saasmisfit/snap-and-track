'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { APP_COLOURS } from '../lib/app-colours';

type Plan = 'monthly' | 'annual';

export default function SubscribePage() {
  const { isLoaded, isSignedIn } = useUser();
  const [plan, setPlan] = useState<Plan>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('annual') === 'true') setPlan('annual');
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const here = window.location.pathname + window.location.search;
    window.location.replace(`/sign-in?redirect_url=${encodeURIComponent(here)}`);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: APP_COLOURS.softBg,
        }}
      >
        <style>{`body { background: ${APP_COLOURS.softBg}; }`}</style>
      </main>
    );
  }

  async function handleSubscribe() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceId: plan }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${res.status})`;
        throw new Error(detail);
      }
      const url =
        data && typeof data === 'object' && 'url' in data
          ? String((data as { url: unknown }).url)
          : '';
      if (!url) throw new Error('No checkout URL returned');
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: APP_COLOURS.softBg,
        color: APP_COLOURS.text,
        fontFamily: "'Barlow', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.25rem 4rem',
      }}
    >
      {/* Matches the page behind the wrapper so no dark body shows on overscroll */}
      <style>{`body { background: ${APP_COLOURS.softBg}; }`}</style>
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            background: APP_COLOURS.magenta,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 22,
            color: APP_COLOURS.onMagenta,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          MS
        </div>

        {/* Headline + sub */}
        <div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: APP_COLOURS.magenta,
              display: 'block',
              marginBottom: 10,
            }}
          >
            Munch Snapper Pro
          </span>
          <h1
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(2.6rem, 6vw, 3.6rem)',
              lineHeight: 1.05,
              color: APP_COLOURS.heading,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Unlock unlimited snaps
          </h1>
          <p
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: APP_COLOURS.text,
              lineHeight: 1.6,
              marginTop: '1rem',
            }}
          >
            {plan === 'annual'
              ? '£49.99/year — save £21.89 vs monthly. Cancel anytime.'
              : 'Start your 3-day free trial — £5.99/month after. Cancel anytime.'}
          </p>
        </div>

        {/* Plan toggle */}
        <div
          role="radiogroup"
          aria-label="Plan"
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
            background: APP_COLOURS.card,
            border: `1px solid ${APP_COLOURS.border}`,
            boxShadow: APP_COLOURS.shadowCard,
            borderRadius: 999,
            padding: 5,
          }}
        >
          {(['monthly', 'annual'] as Plan[]).map((p) => {
            const active = p === plan;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPlan(p)}
                style={{
                  background: active ? APP_COLOURS.magenta : 'transparent',
                  color: active ? APP_COLOURS.onMagenta : APP_COLOURS.heading,
                  border: 'none',
                  padding: '13px 12px',
                  borderRadius: 999,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {p === 'monthly' ? 'Monthly · £5.99' : 'Annual · £49.99'}
              </button>
            );
          })}
        </div>

        {/* Feature card */}
        <div
          style={{
            width: '100%',
            background: APP_COLOURS.card,
            border: `1px solid ${APP_COLOURS.border}`,
            boxShadow: APP_COLOURS.shadowCard,
            borderRadius: 16,
            padding: '26px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            textAlign: 'left',
          }}
        >
          {[
            'All logging methods (photo, voice, barcode, menu, gallery)',
            'AI macro analysis on every meal',
            'Stacy’s coaching note on every result',
            'AI Coach — ask about your week',
            'Pre-built meal plans in Stacy’s voice',
            'Water tracker + reminders',
            'Weight logging + trend graph',
            'Streak tracker + daily nudges',
            'Intermittent fasting timer',
            'Progress photos with comparison',
            'Net carbs mode',
            '7-day meal history synced to cloud',
            'No ads, ever',
          ].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.45,
                color: APP_COLOURS.text,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: APP_COLOURS.magentaSoft,
                  color: APP_COLOURS.magenta,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {feature}
            </div>
          ))}
        </div>

        {/* Error state */}
        {error ? (
          <div
            role="alert"
            style={{
              width: '100%',
              background: APP_COLOURS.dangerSoft,
              border: `1px solid ${APP_COLOURS.dangerBorder}`,
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 16,
              fontWeight: 500,
              color: APP_COLOURS.danger,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={isLoading}
          aria-busy={isLoading}
          style={{
            width: '100%',
            background: isLoading ? APP_COLOURS.magentaDark : APP_COLOURS.magenta,
            color: APP_COLOURS.onMagenta,
            border: 'none',
            padding: '18px 24px',
            borderRadius: 999,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: isLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'background 0.2s',
          }}
        >
          {isLoading ? (
            <>
              <span className="sub-spinner" aria-hidden="true" />
              Redirecting…
            </>
          ) : plan === 'annual' ? (
            'Start annual plan — £49.99'
          ) : (
            'Start 3-day free trial'
          )}
        </button>

        {/* Secondary links */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            marginTop: '0.5rem',
          }}
        >
          <div style={{ fontSize: 15, color: APP_COLOURS.textMuted }}>
            Already subscribed?{' '}
            <Link
              href="/sign-in"
              style={{
                color: APP_COLOURS.magenta,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Sign in
            </Link>
          </div>
          <Link
            href="/app"
            style={{
              fontSize: 15,
              color: APP_COLOURS.textMuted,
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            ← Back to Munch Snapper
          </Link>
          <div style={{ fontSize: 15, color: APP_COLOURS.textMuted, marginTop: '0.25rem' }}>
            Need help? Email{' '}
            <a
              href="mailto:help@munchsnapper.com"
              style={{
                color: APP_COLOURS.magenta,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              help@munchsnapper.com
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sub-spinner {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid ${APP_COLOURS.onMagentaFaint};
          border-top-color: ${APP_COLOURS.onMagenta};
          animation: sub-spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes sub-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
