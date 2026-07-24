import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Meal Log — Munch Snapper',
  description:
    'Review your 7-day meal history, track water and weight, run a fasting timer, and ask Stacy your nutrition questions — all synced to the cloud.',
  openGraph: {
    title: 'Your Meal Log — Munch Snapper',
    description:
      'Review your 7-day meal history, track water and weight, run a fasting timer, and ask Stacy your nutrition questions — all synced to the cloud.',
    url: 'https://www.munchsnapper.com/app/log',
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
    title: 'Your Meal Log — Munch Snapper',
    description:
      'Review your 7-day meal history, track water and weight, run a fasting timer, and ask Stacy your nutrition questions — all synced to the cloud.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function LogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
