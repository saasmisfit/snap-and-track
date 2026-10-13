'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { APP_COLOURS } from '../../lib/app-colours';

type Plan = 'monthly' | 'annual';

function isPlan(value: string | null): value is Plan {
  return value === 'monthly' || value === 'annual';
}

export default function SubscribeSuccessPage() {
  // Which plan was purchased, read from the ?plan= query param create-checkout
  // appends to the Stripe success_url. Null covers a missing/unrecognised param
  // (e.g. someone lands here without completing checkout) — in that case we
  // deliberately show the no-trial-claim copy rather than risk repeating the
  // false trial claim this page used to show unconditionally.
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('plan');
      setPlan(isPlan(raw) ? raw : null);
    } catch {
      setPlan(null);
    }
  }, []);

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
          background: APP_COLOURS.card,
          border: `1px solid ${APP_COLOURS.border}`,
          boxShadow: APP_COLOURS.shadowCard,
          borderRadius: 20,
          padding: '2.75rem 2rem 2.5rem',
        }}
      >
        {/* Checkmark */}
        <div
          aria-hidden="true"
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: APP_COLOURS.successSoft,
            border: `2px solid ${APP_COLOURS.success}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            lineHeight: 1,
            color: APP_COLOURS.success,
            fontWeight: 800,
          }}
        >
          ✓
        </div>

        {/* Headline */}
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
          You&apos;re in! 🎉
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: APP_COLOURS.text,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {plan === 'monthly' ? (
            <>
              Your 3-day free trial has started.
              <br />
              You won&apos;t be charged again until your trial ends.
            </>
          ) : plan === 'annual' ? (
            <>You&apos;re all set — your annual subscription is active.</>
          ) : (
            <>You&apos;re all set — your subscription is active.</>
          )}
        </p>

        {/* CTA */}
        <Link
          href="/app"
          style={{
            width: '100%',
            background: APP_COLOURS.magenta,
            color: APP_COLOURS.onMagenta,
            border: 'none',
            padding: '18px 24px',
            borderRadius: 999,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: '0.5rem',
            transition: 'background 0.2s, transform 0.1s',
          }}
          className="start-snapping-cta"
        >
          Start snapping →
        </Link>

        {/* Footnote */}
        <div
          style={{
            fontSize: 15,
            color: APP_COLOURS.textMuted,
            marginTop: '0.5rem',
            lineHeight: 1.5,
          }}
        >
          Manage your subscription any time from your account settings.
        </div>
      </div>

      <style jsx>{`
        .start-snapping-cta:hover {
          background: ${APP_COLOURS.magentaDark} !important;
          transform: translateY(-1px);
        }
      `}</style>
    </main>
  );
}
