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

function formatTrialEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SubscribeSuccessPage() {
  const [trialEnd, setTrialEnd] = useState<string>('');

  useEffect(() => {
    setTrialEnd(formatTrialEnd());
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
          Your 3-day free trial has started.
          <br />
          You won&apos;t be charged until{' '}
          <span style={{ color: COLOURS.white, fontWeight: 600 }}>
            {trialEnd || '…'}
          </span>
          .
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
