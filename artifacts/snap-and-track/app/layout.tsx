import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Munch Snapper — Snap Your Macros in Seconds',
  description:
    "The only food tracking app with a real PT's voice on every meal. Photo snap, barcode scanner, voice logging, AI coaching — all in one place.",
  icons: {
    icon: '/munch-snapper-logo.png',
    apple: '/munch-snapper-logo.png',
  },
  openGraph: {
    title: 'Munch Snapper — Snap Your Macros in Seconds',
    description:
      'Snap any meal. Get instant macros + a coaching note from Stacy. Photo, voice, barcode — all in one app.',
    url: 'https://www.munchsnapper.com',
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
    title: 'Munch Snapper — Snap Your Macros in Seconds',
    description:
      'Snap any meal. Get instant macros + a coaching note from Stacy. Photo, voice, barcode — all in one app.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app">
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@700;800&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
