export function MacroPill({
  value,
  unit,
  accent = false,
}: {
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        background: accent ? 'rgba(176,24,94,0.18)' : '#22222a',
        border: `1px solid ${accent ? 'rgba(176,24,94,0.45)' : '#2a2a30'}`,
        borderRadius: 999,
        padding: '5px 11px',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: 14,
          lineHeight: 1,
          color: accent ? '#B0185E' : '#ffffff',
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{unit}</span>
    </span>
  );
}
