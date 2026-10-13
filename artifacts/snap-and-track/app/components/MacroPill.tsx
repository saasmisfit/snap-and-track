import { APP_COLOURS } from '../lib/app-colours';

export function MacroPill({
  value,
  unit,
  accent = false,
  size = 'default',
}: {
  value: string;
  unit: string;
  accent?: boolean;
  // 'large' meets the 16px / 14px reading sizes; 'default' keeps the original compact pill
  size?: 'default' | 'large';
}) {
  const large = size === 'large';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        background: accent ? APP_COLOURS.magentaSoft : APP_COLOURS.softBg,
        border: `1px solid ${accent ? APP_COLOURS.magentaTint : APP_COLOURS.border}`,
        borderRadius: 999,
        padding: large ? '6px 13px' : '5px 11px',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: large ? 17 : 14,
          lineHeight: 1,
          color: accent ? APP_COLOURS.magenta : APP_COLOURS.heading,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: large ? 14 : 10, color: APP_COLOURS.textMuted }}>{unit}</span>
    </span>
  );
}
