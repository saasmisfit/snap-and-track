import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';

const clerkAppearance = {
  variables: {
    colorPrimary: '#B0185E',
    colorBackground: '#1a1a1e',
    colorInputBackground: '#0E0E10',
    colorText: '#ffffff',
    colorTextSecondary: '#888888',
    colorInputText: '#ffffff',
    borderRadius: '12px',
  },
  elements: {
    card: { border: '1px solid #2a2a30', boxShadow: 'none' },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    socialButtonsBlockButton: {
      backgroundColor: '#ffffff',
      color: '#111827',
      border: '1px solid #d1d5db',
    },
    socialButtonsBlockButtonText: {
      color: '#111827',
      fontWeight: '500',
    },
  },
};

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0E0E10',
        color: '#ffffff',
        fontFamily: "'Barlow', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.25rem 3rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        {/* Logo header — matches /app header pattern */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              background: '#B0185E',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 20,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            S&amp;T
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontSize: 28,
                lineHeight: 1.1,
                color: '#ffffff',
                letterSpacing: '-0.01em',
              }}
            >
              Snap &amp; Track
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#B0185E',
                marginTop: 6,
              }}
            >
              by Metaburn
            </div>
          </div>
        </div>

        <SignUp appearance={clerkAppearance} />

        <Link
          href="/"
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
