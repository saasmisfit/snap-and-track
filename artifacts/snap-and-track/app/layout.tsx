import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Munch Snapper — Snap Your Food, Track Your Macros',
  description:
    'The easiest macro tracker for women. Snap a photo of your meal and get instant AI nutrition analysis. No more calorie counting the hard way.',
  icons: {
    icon: '/munch-snapper-logo.png',
    apple: '/munch-snapper-logo.png',
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
