'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COLOURS = {
  magenta: '#B0185E',
  magentaDark: '#8a1249',
  nearBlack: '#0E0E10',
  card: '#1a1a1e',
  border: '#2a2a30',
  white: '#ffffff',
  green: '#4ade80',
  greenSoft: 'rgba(74,222,128,0.12)',
  textMuted: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.35)',
};

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
        background: COLOURS.nearBlack,
        color: COLOURS.white,
        fontFamily: "'Barlow', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.25rem 4rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          textAlign: 'center',
        }}
      >
        {/* Checkmark */}
        <div
          aria-hidden="true"
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: COLOURS.greenSoft,
            border: `2px solid ${COLOURS.green}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            lineHeight: 1,
            color: COLOURS.green,
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
            fontSize: 'clamp(2.4rem, 6vw, 3.2rem)',
            lineHeight: 1.05,
            color: COLOURS.white,
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          You&apos;re in! 🎉
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: 16,
            color: COLOURS.textMuted,
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
            background: COLOURS.magenta,
            color: COLOURS.white,
            border: 'none',
            padding: '16px 24px',
            borderRadius: 999,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 15,
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
            fontSize: 12,
            color: COLOURS.textFaint,
            marginTop: '0.5rem',
            lineHeight: 1.5,
          }}
        >
          Manage your subscription any time from your account settings.
        </div>
      </div>

      <style jsx>{`
        .start-snapping-cta:hover {
          background: ${COLOURS.magentaDark} !important;
          transform: translateY(-1px);
        }
      `}</style>
    </main>
  );
}
