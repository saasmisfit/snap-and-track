import Link from 'next/link';
import { APP_COLOURS } from '../lib/app-colours';

export const metadata = {
  title: 'Privacy Policy — Munch Snapper',
  description:
    'How Munch Snapper collects, stores, and protects your data — meal logs, account information, and the third-party services we use.',
};

const SECTIONS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: '1. Who we are',
    body: (
      <>
        Munch Snapper is a nutrition tracking application created by Stacy Kundu, a certified personal trainer. Contact:{' '}
        <a
          href="mailto:help@munchsnapper.com"
          style={{ color: APP_COLOURS.magenta, textDecoration: 'underline', fontWeight: 600 }}
        >
          help@munchsnapper.com
        </a>
      </>
    ),
  },
  {
    title: '2. What data we collect',
    body: (
      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li>
          Account information: your email address and name, provided when you sign up via Google or email through Clerk
        </li>
        <li>
          Meal log data: meal names, macro estimates, coaching notes, timestamps, and log dates stored in our database
        </li>
        <li>
          Preference data: your goal selection, calorie targets, water logs, weight logs, streak data, and notification preferences stored locally on your device
        </li>
        <li>Progress photos: stored locally on your device only — never uploaded to our servers</li>
        <li>Usage data: standard analytics such as page views, collected anonymously</li>
      </ul>
    ),
  },
  {
    title: '3. How we use your data',
    body: 'We use your data solely to provide the Munch Snapper service — to show you your meal history, calculate your daily totals, and power the AI Coach. We do not sell your data to any third party. We do not use your data for advertising.',
  },
  {
    title: '4. Third-party services',
    body: (
      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li>Clerk: handles authentication and user account management. Privacy policy at clerk.com/privacy</li>
        <li>
          Anthropic: powers the AI photo analysis and coaching notes. Your meal photos are sent to Anthropic&apos;s API for analysis and are not stored by Anthropic beyond the duration of the API request. See anthropic.com/privacy
        </li>
        <li>Vercel and Neon: our hosting and database infrastructure. Data is stored in the London (UK West) region.</li>
        <li>Stripe: handles payment processing. We never store your card details. See stripe.com/privacy</li>
        <li>Open Food Facts: used for barcode lookups. No personal data is sent to Open Food Facts.</li>
      </ul>
    ),
  },
  {
    title: '5. Data retention',
    body: (
      <>
        Your meal log entries are kept for 7 days on a rolling basis. Account data is retained while your account is active. You can request deletion of your account and data at any time by emailing{' '}
        <a
          href="mailto:help@munchsnapper.com"
          style={{ color: APP_COLOURS.magenta, textDecoration: 'underline', fontWeight: 600 }}
        >
          help@munchsnapper.com
        </a>
        .
      </>
    ),
  },
  {
    title: '6. Your rights',
    body: (
      <>
        You have the right to access, correct, or delete your personal data. Email{' '}
        <a
          href="mailto:help@munchsnapper.com"
          style={{ color: APP_COLOURS.magenta, textDecoration: 'underline', fontWeight: 600 }}
        >
          help@munchsnapper.com
        </a>{' '}
        for any data requests. If you are based in the UK or EU, you have rights under UK GDPR and GDPR respectively.
      </>
    ),
  },
  {
    title: '7. Cookies',
    body: 'We use only essential cookies required for authentication and session management. We do not use advertising or tracking cookies.',
  },
  {
    title: '8. Changes to this policy',
    body: 'We may update this policy from time to time. The updated date at the top of this page reflects when changes were last made. Continued use of the app after changes constitutes acceptance.',
  },
  {
    title: '9. Contact',
    body: (
      <>
        For any privacy questions:{' '}
        <a
          href="mailto:help@munchsnapper.com"
          style={{ color: APP_COLOURS.magenta, textDecoration: 'underline', fontWeight: 600 }}
        >
          help@munchsnapper.com
        </a>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: APP_COLOURS.pageBg,
        color: APP_COLOURS.text,
        fontFamily: "'Barlow', sans-serif",
        padding: '3rem 1.25rem 5rem',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {/* Matches the page behind the wrapper so no dark body shows on overscroll */}
      <style>{`body { background: ${APP_COLOURS.pageBg}; }`}</style>
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        <Link
          href="/"
          style={{
            color: APP_COLOURS.textMuted,
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          ← Back to Munch Snapper
        </Link>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: APP_COLOURS.magenta,
            }}
          >
            Munch Snapper
          </span>
          <h1
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(2.4rem, 6vw, 3.5rem)',
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: '-0.01em',
              color: APP_COLOURS.heading,
            }}
          >
            Privacy Policy
          </h1>
          <div style={{ fontSize: 16, color: APP_COLOURS.textMuted }}>Last updated: June 2026</div>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              style={{
                borderTop: `1px solid ${APP_COLOURS.border}`,
                paddingTop: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <h2
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 26,
                  lineHeight: 1.15,
                  color: APP_COLOURS.heading,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {s.title}
              </h2>
              <div
                style={{
                  fontSize: 17.5,
                  lineHeight: 1.7,
                  color: APP_COLOURS.text,
                }}
              >
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <Link
          href="/"
          style={{
            color: APP_COLOURS.textMuted,
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '0.02em',
            alignSelf: 'flex-start',
          }}
        >
          ← Back to Munch Snapper
        </Link>
      </div>
    </main>
  );
}
