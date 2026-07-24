import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Sign In — Munch Snapper',
  description: 'Sign in to Munch Snapper to log your meals and track your macros.',
  openGraph: {
    title: 'Sign In — Munch Snapper',
    description: 'Sign in to Munch Snapper to log your meals and track your macros.',
    url: 'https://www.munchsnapper.com/sign-in',
    siteName: 'Munch Snapper',
    images: [
      {
        url: 'https://www.munchsnapper.com/opengraph.jpg',
        width: 1200,
        height: 630,
        alt: 'Munch Snapper — Snap Your Macros in Seconds',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign In — Munch Snapper',
    description: 'Sign in to Munch Snapper to log your meals and track your macros.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

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

export default function SignInPage() {
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
        <Link href="/" aria-label="Munch Snapper home" style={{ textDecoration: 'none' }}>
          <Image
            src="/munch-snapper-logo.png"
            alt="Munch Snapper"
            width={220}
            height={82}
            priority
            style={{ width: 'auto', height: 72, display: 'block' }}
          />
        </Link>

        <SignIn appearance={clerkAppearance} />

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
