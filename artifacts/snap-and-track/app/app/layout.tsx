import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Dashboard — Munch Snapper',
  description:
    'Snap a photo, scan a barcode, or log by voice — get instant calories and macros with a coaching note from Stacy.',
  openGraph: {
    title: 'Your Dashboard — Munch Snapper',
    description:
      'Snap a photo, scan a barcode, or log by voice — get instant calories and macros with a coaching note from Stacy.',
    url: 'https://www.munchsnapper.com/app',
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
    title: 'Your Dashboard — Munch Snapper',
    description:
      'Snap a photo, scan a barcode, or log by voice — get instant calories and macros with a coaching note from Stacy.',
    images: ['https://www.munchsnapper.com/opengraph.jpg'],
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
