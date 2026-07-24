import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meal Plans — Munch Snapper',
  description:
    "Pre-built fat loss, maintain, and build meal plans written in Stacy's voice — log any meal straight to your day.",
  openGraph: {
    title: 'Meal Plans — Munch Snapper',
    description:
      "Pre-built fat loss, maintain, and build meal plans written in Stacy's voice — log any meal straight to your day.",
    url: 'https://www.munchsnapper.com/app/plans',
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
    title: 'Meal Plans — Munch Snapper',
    description:
      "Pre-built fat loss, maintain, and build meal plans written in Stacy's voice — log any meal straight to your day.",
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
