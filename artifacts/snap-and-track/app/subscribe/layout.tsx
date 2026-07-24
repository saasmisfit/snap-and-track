import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscribe — Munch Snapper Pro',
  description:
    'Unlock unlimited AI meal analysis, voice logging, and coaching for £5.99/month or £49.99/year. 3 free snaps to start, no card required.',
  openGraph: {
    title: 'Subscribe — Munch Snapper Pro',
    description:
      'Unlock unlimited AI meal analysis, voice logging, and coaching for £5.99/month or £49.99/year. 3 free snaps to start, no card required.',
    url: 'https://www.munchsnapper.com/subscribe',
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
    title: 'Subscribe — Munch Snapper Pro',
    description:
      'Unlock unlimited AI meal analysis, voice logging, and coaching for £5.99/month or £49.99/year. 3 free snaps to start, no card required.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
