import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "You're In! — Munch Snapper",
  description: 'Your Munch Snapper subscription is confirmed — start snapping your meals.',
  openGraph: {
    title: "You're In! — Munch Snapper",
    description: 'Your Munch Snapper subscription is confirmed — start snapping your meals.',
    url: 'https://www.munchsnapper.com/subscribe/success',
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
    title: "You're In! — Munch Snapper",
    description: 'Your Munch Snapper subscription is confirmed — start snapping your meals.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function SubscribeSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
