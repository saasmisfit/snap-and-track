'use client';

import { useEffect, useMemo, useState } from 'react';
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
  logDate?: string;
  logTime?: string;
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
  textLight: '#cccccc',
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

function todayUTCStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getEntryDate(e: LogEntry): string {
  return typeof e.logDate === 'string' && e.logDate ? e.logDate : todayUTCStr();
}

function getEntryTime(e: LogEntry): string {
  if (typeof e.logTime === 'string' && e.logTime) return e.logTime;
  const d = new Date(e.loggedAt);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const today = todayUTCStr();
  if (dateStr === today) return 'Today';

  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  if (dateStr === y.toISOString().split('T')[0]) return 'Yesterday';

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const yr = Number(parts[0]);
  const mo = Number(parts[1]);
  const da = Number(parts[2]);
  if (!Number.isFinite(yr) || !Number.isFinite(mo) || !Number.isFinite(da)) return dateStr;
  const date = new Date(Date.UTC(yr, mo - 1, da));
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${weekday} ${da} ${month}`;
}

function fmtMacro(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toString();
}

function dayTotals(entries: LogEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (Number.isFinite(e.calories) ? e.calories : 0),
      protein_g: acc.protein_g + (Number.isFinite(e.protein_g) ? e.protein_g : 0),
      carbs_g: acc.carbs_g + (Number.isFinite(e.carbs_g) ? e.carbs_g : 0),
      fat_g: acc.fat_g + (Number.isFinite(e.fat_g) ? e.fat_g : 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export default function MealLogPage() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openDates, setOpenDates] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setEntries(readAll());
    setOpenDates(new Set([todayUTCStr()]));
  }, []);

  function removeEntry(id: string) {
    const all = readAll();
    const remaining = all.filter((e) => e.id !== id);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    } catch {
      // best-effort
    }
    setEntries(remaining);
  }

  function toggleExpanded(id: string) {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }

  function toggleDate(dateStr: string) {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  const dateGroups = useMemo<Array<[string, LogEntry[]]>>(() => {
    if (!entries) return [];
    const groups = new Map<string, LogEntry[]>();
    entries.forEach((e) => {
      const d = getEntryDate(e);
      const list = groups.get(d);
      if (list) list.push(e);
      else groups.set(d, [e]);
    });
    groups.forEach((arr) => arr.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)));
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

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
          <Link href="/app" className="snap-link" style={{ color: '#ffffff', textDecoration: 'none' }}>
            ＋ Snap a meal
          </Link>
        </header>

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
            <Link href="/app" className="snap-cta" style={{ color: '#ffffff', textDecoration: 'none' }}>
              Snap a meal →
            </Link>
          </div>
        )}

        {/* Date-grouped collapsible sections */}
        {entries !== null && entries.length > 0 && (
          <div style={styles.dateGroups}>
            {dateGroups.map(([dateStr, dayEntries]) => {
              const t = dayTotals(dayEntries);
              const isOpen = openDates.has(dateStr);
              return (
                <section key={dateStr} style={styles.dateSection}>
                  <button
                    type="button"
                    onClick={() => toggleDate(dateStr)}
                    className="date-header"
                    aria-expanded={isOpen}
                  >
                    <span style={styles.dateHeaderLeft}>
                      <span style={styles.chevron} aria-hidden="true">
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span style={styles.dateLabel}>{formatDateLabel(dateStr)}</span>
                    </span>
                    <span style={styles.dateTotals}>
                      {fmtMacro(t.calories)} kcal &nbsp;·&nbsp; {fmtMacro(t.protein_g)}g protein &nbsp;·&nbsp; {fmtMacro(t.carbs_g)}g carbs &nbsp;·&nbsp; {fmtMacro(t.fat_g)}g fat
                    </span>
                  </button>
                  {isOpen && (
                    <div style={styles.entriesList}>
                      {dayEntries.map((e) => (
                        <article key={e.id} style={styles.entryCard}>
                          <div style={styles.entryTopRow}>
                            <div style={styles.entryDish}>{e.dish}</div>
                            <div style={styles.entryTime}>{getEntryTime(e)}</div>
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

                          {e.stacy_insight ? (
                            <p style={{ ...styles.insight, color: '#ffffff' }}>{e.stacy_insight}</p>
                          ) : null}

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
                </section>
              );
            })}
          </div>
        )}

        <div style={styles.footerNote}>Meals are kept for 7 days</div>
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

        .date-header {
          width: 100%;
          background: ${COLOURS.card};
          border: 1px solid ${COLOURS.border};
          border-radius: 14px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          font-family: var(--body-font), 'Barlow', sans-serif;
          color: ${COLOURS.white};
          text-align: left;
          transition: background 0.15s;
        }
        .date-header:hover {
          background: ${COLOURS.cardRaised};
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
  dateGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  dateSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  dateHeaderLeft: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  chevron: {
    color: COLOURS.textMuted,
    fontSize: 13,
    width: 14,
    display: 'inline-block',
    textAlign: 'center',
  },
  dateLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 18,
    color: COLOURS.white,
    letterSpacing: '-0.01em',
  },
  dateTotals: {
    fontSize: 12,
    color: COLOURS.textLight,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
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
  entryTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  entryTime: {
    fontSize: 12,
    color: COLOURS.textFaint,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
    paddingTop: 4,
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
