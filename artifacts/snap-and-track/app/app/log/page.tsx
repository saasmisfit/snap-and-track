'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface FoodItem {
  name: string;
  calories: number;
}

interface LogEntry {
  id: string;
  dish: string;
  portion_estimate: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  foods_identified: FoodItem[];
  stacy_insight: string;
  loggedAt: string;
}

const STORAGE_KEY = 'snaptrack_log';

const COLOURS = {
  magenta: '#B0185E',
  magentaDark: '#8a1249',
  magentaSoft: 'rgba(176,24,94,0.12)',
  magentaTint: 'rgba(176,24,94,0.18)',
  nearBlack: '#0E0E10',
  card: '#1a1a1e',
  cardRaised: '#22222a',
  border: '#2a2a30',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.35)',
  danger: '#fca5a5',
};

function isLogEntry(v: unknown): v is LogEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.dish === 'string' &&
    typeof o.loggedAt === 'string' &&
    typeof o.calories === 'number' &&
    Array.isArray(o.foods_identified)
  );
}

function readAll(): LogEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLogEntry) : [];
  } catch {
    return [];
  }
}

function filterToday(all: LogEntry[]): LogEntry[] {
  const todayStr = new Date().toDateString();
  return all
    .filter((e) => {
      const d = new Date(e.loggedAt);
      return !Number.isNaN(d.valueOf()) && d.toDateString() === todayStr;
    })
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

function fmtMacro(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toString();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function MealLogPage() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setEntries(filterToday(readAll()));
  }, []);

  function removeEntry(id: string) {
    const all = readAll();
    const remaining = all.filter((e) => e.id !== id);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    } catch {
      // best-effort
    }
    setEntries(filterToday(remaining));
  }

  function toggleExpanded(id: string) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }

  const totals = (entries ?? []).reduce(
    (acc, e) => ({
      calories: acc.calories + (Number.isFinite(e.calories) ? e.calories : 0),
      protein_g: acc.protein_g + (Number.isFinite(e.protein_g) ? e.protein_g : 0),
      carbs_g: acc.carbs_g + (Number.isFinite(e.carbs_g) ? e.carbs_g : 0),
      fat_g: acc.fat_g + (Number.isFinite(e.fat_g) ? e.fat_g : 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerMark} aria-hidden="true">
            🍽️
          </div>
          <div style={styles.headerTitleGroup}>
            <div style={styles.headerTitle}>Today&apos;s Log</div>
            <div style={styles.headerSub}>by Stacy Kundu</div>
          </div>
          <Link href="/app" className="snap-link">
            ＋ Snap a meal
          </Link>
        </header>

        {/* Sticky daily totals — only shown when there are entries */}
        {entries !== null && entries.length > 0 && (
          <div style={styles.totalsBar}>
            <Stat label="Calories" value={fmtMacro(totals.calories)} unit="kcal" accent />
            <Stat label="Protein" value={fmtMacro(totals.protein_g)} unit="g" />
            <Stat label="Carbs" value={fmtMacro(totals.carbs_g)} unit="g" />
            <Stat label="Fat" value={fmtMacro(totals.fat_g)} unit="g" />
          </div>
        )}

        {/* Loading shimmer — only while reading localStorage on first paint */}
        {entries === null && <div style={styles.loadingHint}>Loading your log…</div>}

        {/* Empty state */}
        {entries !== null && entries.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon} aria-hidden="true">
              📷
            </div>
            <div style={styles.emptyTitle}>Nothing logged yet</div>
            <div style={styles.emptySub}>Snap your first meal to get started</div>
            <Link href="/app" className="snap-cta">
              Snap a meal →
            </Link>
          </div>
        )}

        {/* Entries list */}
        {entries !== null && entries.length > 0 && (
          <div style={styles.entriesList}>
            {entries.map((e) => (
              <article key={e.id} style={styles.entryCard}>
                <div>
                  <div style={styles.entryDish}>{e.dish}</div>
                  <div style={styles.entryMeta}>
                    Logged at {fmtTime(e.loggedAt)}
                    {e.portion_estimate ? ` · ${e.portion_estimate}` : ''}
                  </div>
                </div>

                <div style={styles.macroPills}>
                  <MacroPill value={fmtMacro(e.calories)} unit="kcal" accent />
                  <MacroPill value={`${fmtMacro(e.protein_g)}g`} unit="protein" />
                  <MacroPill value={`${fmtMacro(e.carbs_g)}g`} unit="carbs" />
                  <MacroPill value={`${fmtMacro(e.fat_g)}g`} unit="fat" />
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpanded(e.id)}
                  className="see-toggle"
                  aria-expanded={!!expanded[e.id]}
                >
                  What I could see {expanded[e.id] ? '▴' : '▾'}
                </button>
                {expanded[e.id] && (
                  <ul style={styles.foodList}>
                    {e.foods_identified.map((f, i) => (
                      <li key={`${e.id}-${i}`} style={styles.foodItem}>
                        <span style={styles.foodName}>{f.name}</span>
                        <span style={styles.foodCal}>{fmtMacro(f.calories)} kcal</span>
                      </li>
                    ))}
                  </ul>
                )}

                {e.stacy_insight ? <p style={styles.insight}>{e.stacy_insight}</p> : null}

                <div style={styles.entryFoot}>
                  <button
                    type="button"
                    onClick={() => removeEntry(e.id)}
                    className="remove-link"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div style={styles.footerNote}>Log resets at midnight each day</div>
      </div>

      <style jsx>{`
        :global(body) {
          background: ${COLOURS.nearBlack};
        }

        .snap-link {
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
          padding: 8px 16px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.2s, transform 0.1s;
        }
        .snap-link:hover {
          background: ${COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .snap-cta {
          margin-top: 1.25rem;
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
          padding: 14px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-decoration: none;
          display: inline-block;
          transition: background 0.2s, transform 0.1s;
        }
        .snap-cta:hover {
          background: ${COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .see-toggle {
          background: transparent;
          color: ${COLOURS.magenta};
          border: none;
          padding: 0;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          align-self: flex-start;
          transition: color 0.2s;
        }
        .see-toggle:hover {
          color: ${COLOURS.white};
        }

        .remove-link {
          background: transparent;
          color: ${COLOURS.textFaint};
          border: none;
          padding: 0;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s;
        }
        .remove-link:hover {
          color: ${COLOURS.danger};
        }
      `}</style>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 24,
            lineHeight: 1,
            color: accent ? COLOURS.magenta : COLOURS.white,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 10, color: COLOURS.textFaint }}>{unit}</span>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function MacroPill({
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
        background: accent ? COLOURS.magentaTint : COLOURS.cardRaised,
        border: `1px solid ${accent ? 'rgba(176,24,94,0.45)' : COLOURS.border}`,
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
          color: accent ? COLOURS.magenta : COLOURS.white,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{unit}</span>
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: COLOURS.nearBlack,
    color: COLOURS.white,
    fontFamily: "'Barlow', sans-serif",
    padding: '2rem 1.25rem 4rem',
    display: 'flex',
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.5rem 0 1rem',
    borderBottom: `1px solid ${COLOURS.border}`,
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerMark: {
    width: 44,
    height: 44,
    background: COLOURS.magenta,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  headerTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 20,
    color: COLOURS.white,
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLOURS.magenta,
  },
  totalsBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 14,
    padding: '12px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  loadingHint: {
    color: COLOURS.textMuted,
    fontSize: 13,
    padding: '2rem 0',
    textAlign: 'center',
  },
  empty: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 18,
    padding: '3rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    lineHeight: 1,
    marginBottom: 8,
    opacity: 0.7,
  },
  emptyTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 24,
    color: COLOURS.white,
    letterSpacing: '-0.01em',
  },
  emptySub: {
    fontSize: 14,
    color: COLOURS.textMuted,
  },
  entriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  entryCard: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  entryDish: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    color: COLOURS.white,
    lineHeight: 1.15,
    letterSpacing: '-0.01em',
  },
  entryMeta: {
    fontSize: 12,
    color: COLOURS.textFaint,
    marginTop: 4,
  },
  macroPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  foodList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    border: `1px solid ${COLOURS.border}`,
  },
  foodItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: `1px solid ${COLOURS.border}`,
    fontSize: 13,
  },
  foodName: {
    color: 'rgba(255,255,255,0.85)',
  },
  foodCal: {
    color: COLOURS.textMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  insight: {
    fontSize: 14,
    lineHeight: 1.6,
    color: COLOURS.magenta,
    fontStyle: 'italic',
    background: COLOURS.magentaSoft,
    border: `1px solid rgba(176,24,94,0.25)`,
    borderRadius: 12,
    padding: '12px 14px',
    margin: 0,
  },
  entryFoot: {
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: `1px solid ${COLOURS.border}`,
    paddingTop: 10,
    marginTop: 2,
  },
  footerNote: {
    fontSize: 12,
    color: COLOURS.textFaint,
    textAlign: 'center',
    padding: '1rem 0',
  },
};
