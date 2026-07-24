import type { Streak } from '../lib/streak';

export function StreakBadge({ streak }: { streak: Streak }) {
  const active = streak.currentStreak > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 14px',
        background: '#1a1a1e',
        border: '1px solid #2a2a30',
        borderRadius: 999,
        alignSelf: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-label={
        active
          ? `${streak.currentStreak} day logging streak`
          : 'No active streak — start today'
      }
    >
      {active ? (
        <>
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
            🔥
          </span>
          <span
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}
          >
            {streak.currentStreak} day streak
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.02em',
            }}
          >
            · Keep it going
          </span>
        </>
      ) : (
        <span
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 12,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.02em',
          }}
        >
          Start your streak today
        </span>
      )}
    </div>
  );
}
