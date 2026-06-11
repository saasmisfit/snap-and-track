import { SignIn } from '@clerk/nextjs';

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
        gap: '1.75rem',
        padding: '2rem 1.25rem',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 32,
            color: '#ffffff',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          Snap &amp; Track
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#B0185E',
            marginTop: 6,
          }}
        >
          by Metaburn
        </div>
      </div>
      <SignIn />
    </main>
  );
}
