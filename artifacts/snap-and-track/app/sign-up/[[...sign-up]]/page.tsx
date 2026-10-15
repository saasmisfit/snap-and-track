import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { APP_COLOURS } from '../../lib/app-colours';
import { clerkAppearance } from '../../lib/clerk-appearance';

export const metadata: Metadata = {
  title: 'Sign Up — Munch Snapper',
  description: 'Create your free Munch Snapper account — 3 free AI meal snaps, no card needed for those.',
  openGraph: {
    title: 'Sign Up — Munch Snapper',
    description: 'Create your free Munch Snapper account — 3 free AI meal snaps, no card needed for those.',
    url: 'https://www.munchsnapper.com/sign-up',
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
    title: 'Sign Up — Munch Snapper',
    description: 'Create your free Munch Snapper account — 3 free AI meal snaps, no card needed for those.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function SignUpPage() {
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
        padding: '2.5rem 1.25rem 3rem',
      }}
    >
      {/* Matches the page behind the wrapper so no dark body shows on overscroll */}
      <style>{`body { background: ${APP_COLOURS.softBg}; }`}</style>
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
        {/* Logo header — the PNG is white line art, so it is darkened for the light page */}
        <Link href="/" aria-label="Munch Snapper home" style={{ textDecoration: 'none' }}>
          <Image
            src="/munch-snapper-logo.png"
            alt="Munch Snapper"
            width={220}
            height={82}
            priority
            style={{
              width: 'auto',
              height: 72,
              display: 'block',
              filter: 'brightness(0)',
              opacity: 0.92,
            }}
          />
        </Link>

        <SignUp appearance={clerkAppearance} />

        <Link
          href="/"
          style={{
            fontSize: 15,
            color: APP_COLOURS.textMuted,
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
