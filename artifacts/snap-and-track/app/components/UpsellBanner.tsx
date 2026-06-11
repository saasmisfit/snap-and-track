'use client';

import { useState } from 'react';

export default function UpsellBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="complementary"
      aria-label="Metaburn membership upsell"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: '#1a1a1e',
        borderTop: '1px solid #2a2a30',
        padding: '12px 20px',
        fontFamily: "'Barlow', sans-serif",
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 10,
          rowGap: 4,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.4,
          }}
        >
          Want programmes, coaching &amp; community?
        </span>
        <a
          href="https://metaburn.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#B0185E',
            textDecoration: 'none',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          Join Metaburn from £24.99/month →
        </a>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 18,
          lineHeight: 1,
          width: 32,
          height: 32,
          borderRadius: 999,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
