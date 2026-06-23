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
  fibre_g?: number;
  foods_identified: FoodItem[];
  stacy_insight: string;
  loggedAt: string;
  logDate?: string;
  logTime?: string;
}

const STORAGE_KEY = 'snaptrack_log';
const NET_CARBS_KEY = 'munchsnapper_netcarbs';
const WATER_KEY_PREFIX = 'munchsnapper_water_';
const WATER_NOTIF_KEY = 'munchsnapper_water_notif';
const GLASS_GOAL = 8;
const REMINDER_HOURS = [8, 10, 12, 14, 16, 18, 20];
const WATER_REMINDER_MESSAGE = "💧 Don't forget to drink water! Tap to log a glass.";
const WEIGHT_UNIT_KEY = 'munchsnapper_weight_unit';
const WEIGHT_LOG_KEY = 'munchsnapper_weight_log';
const WEIGHT_MAX_DAYS = 90;
const WEIGHT_GRAPH_DAYS = 30;
const STREAK_KEY = 'munchsnapper_streak';

interface Streak {
  currentStreak: number;
  lastLogDate: string;
  longestStreak: number;
}

const EMPTY_STREAK: Streak = { currentStreak: 0, lastLogDate: '', longestStreak: 0 };

type WeightUnit = 'kg' | 'lbs';

interface WeightEntry {
  date: string;
  value: number;
  unit: WeightUnit;
}

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

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function waterKey(dateStr: string): string {
  return `${WATER_KEY_PREFIX}${dateStr}`;
}

function readWaterCount(dateStr: string): number {
  try {
    const raw = window.localStorage.getItem(waterKey(dateStr));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, GLASS_GOAL);
  } catch {
    return 0;
  }
}

function daysAgoLocalStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function isWeightEntry(v: unknown): v is WeightEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === 'string' &&
    typeof o.value === 'number' &&
    Number.isFinite(o.value) &&
    (o.unit === 'kg' || o.unit === 'lbs')
  );
}

function readWeightLog(): WeightEntry[] {
  try {
    const raw = window.localStorage.getItem(WEIGHT_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWeightEntry) : [];
  } catch {
    return [];
  }
}

function kgFromEntry(e: WeightEntry): number {
  return e.unit === 'kg' ? e.value : e.value * 0.45359237;
}

function convertWeight(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * 2.20462262;
}

function fmtWeight(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function isStreak(v: unknown): v is Streak {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.currentStreak === 'number' &&
    typeof o.lastLogDate === 'string' &&
    typeof o.longestStreak === 'number'
  );
}

function readStreak(): Streak {
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { ...EMPTY_STREAK };
    const parsed: unknown = JSON.parse(raw);
    if (isStreak(parsed)) return parsed;
  } catch {
    // best-effort
  }
  return { ...EMPTY_STREAK };
}

function writeStreak(s: Streak): void {
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

function checkAndResetStreak(): Streak {
  const s = readStreak();
  if (!s.lastLogDate || s.currentStreak === 0) return s;
  const today = todayLocalStr();
  const yesterday = daysAgoLocalStr(1);
  if (s.lastLogDate !== today && s.lastLogDate !== yesterday) {
    const next: Streak = { ...s, currentStreak: 0 };
    writeStreak(next);
    return next;
  }
  return s;
}

function fmtShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const yr = Number(parts[0]);
  const mo = Number(parts[1]);
  const da = Number(parts[2]);
  if (!Number.isFinite(yr) || !Number.isFinite(mo) || !Number.isFinite(da)) return dateStr;
  const d = new Date(yr, mo - 1, da);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

function carbsForDisplay(e: LogEntry, netCarbs: boolean): number {
  const carbs = Number.isFinite(e.carbs_g) ? e.carbs_g : 0;
  if (!netCarbs) return carbs;
  const fibre = typeof e.fibre_g === 'number' && Number.isFinite(e.fibre_g) ? e.fibre_g : 0;
  return Math.max(0, carbs - fibre);
}

function dayTotals(entries: LogEntry[], netCarbs: boolean) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (Number.isFinite(e.calories) ? e.calories : 0),
      protein_g: acc.protein_g + (Number.isFinite(e.protein_g) ? e.protein_g : 0),
      carbs_g: acc.carbs_g + carbsForDisplay(e, netCarbs),
      fat_g: acc.fat_g + (Number.isFinite(e.fat_g) ? e.fat_g : 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export default function MealLogPage() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openDates, setOpenDates] = useState<Set<string>>(() => new Set());
  const [netCarbs, setNetCarbs] = useState(false);
  const [waterCount, setWaterCount] = useState(0);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported' | 'unknown'>(
    'unknown'
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weightInput, setWeightInput] = useState<string>('');
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);
  const [streak, setStreak] = useState<Streak>(EMPTY_STREAK);

  useEffect(() => {
    setEntries(readAll());
    setOpenDates(new Set([todayUTCStr()]));
    try {
      setNetCarbs(window.localStorage.getItem(NET_CARBS_KEY) === '1');
    } catch {
      // best-effort
    }
    setWaterCount(readWaterCount(todayLocalStr()));
    try {
      const storedUnit = window.localStorage.getItem(WEIGHT_UNIT_KEY);
      if (storedUnit === 'kg' || storedUnit === 'lbs') setWeightUnit(storedUnit);
    } catch {
      // best-effort
    }
    setWeightLog(readWeightLog());
    setStreak(checkAndResetStreak());
  }, []);

  // Notification permission — ask once, remember result
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setNotifPerm('unsupported');
      return;
    }
    setNotifPerm(Notification.permission);
    let asked: string | null = null;
    try {
      asked = window.localStorage.getItem(WATER_NOTIF_KEY);
    } catch {
      // best-effort
    }
    if (asked) return;
    if (Notification.permission !== 'default') {
      try {
        window.localStorage.setItem(WATER_NOTIF_KEY, Notification.permission);
      } catch {
        // best-effort
      }
      return;
    }
    Notification.requestPermission()
      .then((p) => {
        setNotifPerm(p);
        try {
          window.localStorage.setItem(WATER_NOTIF_KEY, p);
        } catch {
          // best-effort
        }
      })
      .catch(() => {
        // best-effort
      });
  }, []);

  // Schedule reminders — every 2h between 8am and 8pm local, skip if goal met
  useEffect(() => {
    if (notifPerm !== 'granted') return;
    if (waterCount >= GLASS_GOAL) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    const now = new Date();
    const timers: number[] = [];
    for (const hour of REMINDER_HOURS) {
      const slot = new Date(now);
      slot.setHours(hour, 0, 0, 0);
      const delay = slot.getTime() - now.getTime();
      if (delay <= 0) continue;
      const id = window.setTimeout(() => {
        const current = readWaterCount(todayLocalStr());
        if (current >= GLASS_GOAL) return;
        try {
          new Notification(WATER_REMINDER_MESSAGE);
        } catch {
          // best-effort
        }
      }, delay);
      timers.push(id);
    }
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [notifPerm, waterCount]);

  function updateWater(n: number) {
    const clamped = Math.max(0, Math.min(GLASS_GOAL, Math.round(n)));
    setWaterCount(clamped);
    try {
      window.localStorage.setItem(waterKey(todayLocalStr()), String(clamped));
    } catch {
      // best-effort
    }
  }

  function changeWeightUnit(u: WeightUnit) {
    setWeightUnit(u);
    try {
      window.localStorage.setItem(WEIGHT_UNIT_KEY, u);
    } catch {
      // best-effort
    }
  }

  function logWeight() {
    const v = parseFloat(weightInput);
    if (!Number.isFinite(v) || v <= 0) return;
    const today = todayLocalStr();
    const cutoff = daysAgoLocalStr(WEIGHT_MAX_DAYS - 1);
    const next: WeightEntry = {
      date: today,
      value: Math.round(v * 10) / 10,
      unit: weightUnit,
    };
    const filtered = weightLog.filter((e) => e.date !== today && e.date >= cutoff);
    const updated = [...filtered, next].sort((a, b) => a.date.localeCompare(b.date));
    try {
      window.localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(updated));
    } catch {
      // best-effort
    }
    setWeightLog(updated);
    setWeightInput('');
  }

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

  const weightGraphData = useMemo<Array<{ date: string; value: number }>>(() => {
    const cutoff = daysAgoLocalStr(WEIGHT_GRAPH_DAYS - 1);
    return weightLog
      .filter((e) => e.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ date: e.date, value: convertWeight(kgFromEntry(e), weightUnit) }));
  }, [weightLog, weightUnit]);

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

        {/* Streak badge */}
        <StreakBadge streak={streak} />

        {/* Water tracker — daily glasses goal */}
        <section
          aria-label="Water intake today"
          style={{
            background: COLOURS.card,
            border: `1px solid ${COLOURS.border}`,
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                color: COLOURS.white,
                letterSpacing: '-0.01em',
              }}
            >
              Water Today
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: COLOURS.magenta,
              }}
            >
              Goal · {GLASS_GOAL} glasses
            </div>
          </div>

          <div
            role="group"
            aria-label={`${waterCount} of ${GLASS_GOAL} glasses logged`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            {Array.from({ length: GLASS_GOAL }).map((_, i) => {
              const filled = i < waterCount;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => updateWater(filled ? i : i + 1)}
                  aria-label={`Glass ${i + 1} of ${GLASS_GOAL}: ${filled ? 'filled' : 'empty'}`}
                  aria-pressed={filled}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 2,
                    margin: 0,
                    cursor: 'pointer',
                    lineHeight: 0,
                    borderRadius: 8,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 2 C12 2 5 10 5 15 a7 7 0 0 0 14 0 c0-5-7-13-7-13z"
                      fill={filled ? COLOURS.magenta : 'transparent'}
                      stroke={filled ? COLOURS.magenta : COLOURS.border}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: COLOURS.textMuted,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {waterCount} of {GLASS_GOAL} glasses
            </div>
            {waterCount > 0 ? (
              <button
                type="button"
                onClick={() => updateWater(0)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: COLOURS.textFaint,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
        </section>

        {/* Weight tracker — daily logging + 30-day SVG trend */}
        <section
          aria-label="Weight log"
          style={{
            background: COLOURS.card,
            border: `1px solid ${COLOURS.border}`,
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 18,
              color: COLOURS.white,
              letterSpacing: '-0.01em',
            }}
          >
            Weight
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              logWeight();
            }}
            style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}
          >
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={weightUnit === 'kg' ? 'e.g. 63.5' : 'e.g. 140'}
              aria-label="Weight"
              style={{
                flex: '1 1 120px',
                minWidth: 0,
                background: COLOURS.nearBlack,
                color: COLOURS.white,
                border: `1px solid ${COLOURS.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontFamily: "'Barlow', sans-serif",
                fontSize: 15,
                outline: 'none',
                appearance: 'textfield',
              }}
            />
            <div
              role="radiogroup"
              aria-label="Weight unit"
              style={{
                display: 'inline-flex',
                background: COLOURS.nearBlack,
                border: `1px solid ${COLOURS.border}`,
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {(['kg', 'lbs'] as WeightUnit[]).map((u) => {
                const active = u === weightUnit;
                return (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => changeWeightUnit(u)}
                    style={{
                      background: active ? COLOURS.magenta : 'transparent',
                      color: active ? COLOURS.white : COLOURS.textMuted,
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      minWidth: 40,
                    }}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
            <button
              type="submit"
              disabled={!weightInput || !Number.isFinite(parseFloat(weightInput)) || parseFloat(weightInput) <= 0}
              style={{
                background: COLOURS.magenta,
                color: COLOURS.white,
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                opacity:
                  !weightInput || !Number.isFinite(parseFloat(weightInput)) || parseFloat(weightInput) <= 0
                    ? 0.5
                    : 1,
              }}
            >
              Log weight
            </button>
          </form>

          {weightGraphData.length < 2 ? (
            <div
              style={{
                fontSize: 12,
                color: COLOURS.textMuted,
                textAlign: 'center',
                padding: '24px 8px',
                lineHeight: 1.5,
              }}
            >
              Log your weight for a few days to see your trend
            </div>
          ) : (
            (() => {
              const W = 560;
              const H = 120;
              const LEFT = 40;
              const RIGHT = 14;
              const TOP = 14;
              const BOTTOM = 22;
              const firstDate = new Date(`${weightGraphData[0].date}T00:00:00`);
              const lastDate = new Date(
                `${weightGraphData[weightGraphData.length - 1].date}T00:00:00`
              );
              const totalDays = Math.max(
                1,
                (lastDate.getTime() - firstDate.getTime()) / 86400000
              );
              const vals = weightGraphData.map((d) => d.value);
              let minV = Math.min(...vals);
              let maxV = Math.max(...vals);
              if (minV === maxV) {
                minV -= 1;
                maxV += 1;
              }
              const points = weightGraphData.map((d) => {
                const t = new Date(`${d.date}T00:00:00`);
                const days = (t.getTime() - firstDate.getTime()) / 86400000;
                const x = LEFT + (days / totalDays) * (W - LEFT - RIGHT);
                const y =
                  H -
                  BOTTOM -
                  ((d.value - minV) / (maxV - minV)) * (H - BOTTOM - TOP);
                return { x, y };
              });
              const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <svg
                  width="100%"
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Weight trend over the last ${WEIGHT_GRAPH_DAYS} days`}
                  style={{ display: 'block' }}
                >
                  <text
                    x={LEFT - 4}
                    y={TOP + 4}
                    fill={COLOURS.textFaint}
                    fontSize="11"
                    fontFamily="'Barlow', sans-serif"
                    textAnchor="end"
                  >
                    {fmtWeight(maxV)}
                  </text>
                  <text
                    x={LEFT - 4}
                    y={H - BOTTOM}
                    fill={COLOURS.textFaint}
                    fontSize="11"
                    fontFamily="'Barlow', sans-serif"
                    textAnchor="end"
                  >
                    {fmtWeight(minV)}
                  </text>
                  <text
                    x={LEFT}
                    y={H - 4}
                    fill={COLOURS.textFaint}
                    fontSize="11"
                    fontFamily="'Barlow', sans-serif"
                    textAnchor="start"
                  >
                    {fmtShortDate(weightGraphData[0].date)}
                  </text>
                  <text
                    x={W - RIGHT}
                    y={H - 4}
                    fill={COLOURS.textFaint}
                    fontSize="11"
                    fontFamily="'Barlow', sans-serif"
                    textAnchor="end"
                  >
                    {fmtShortDate(weightGraphData[weightGraphData.length - 1].date)}
                  </text>
                  <polyline
                    fill="none"
                    stroke={COLOURS.white}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={polylinePoints}
                  />
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={5} fill={COLOURS.magenta} />
                  ))}
                </svg>
              );
            })()
          )}
        </section>

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
              const t = dayTotals(dayEntries, netCarbs);
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
                      {fmtMacro(t.calories)} kcal &nbsp;·&nbsp; {fmtMacro(t.protein_g)}g protein &nbsp;·&nbsp; {fmtMacro(t.carbs_g)}g {netCarbs ? 'net carbs' : 'carbs'} &nbsp;·&nbsp; {fmtMacro(t.fat_g)}g fat
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
                            <MacroPill value={`${fmtMacro(carbsForDisplay(e, netCarbs))}g`} unit={netCarbs ? 'net carbs' : 'carbs'} />
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

function StreakBadge({ streak }: { streak: Streak }) {
  const active = streak.currentStreak > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '8px 14px',
        background: COLOURS.card,
        border: `1px solid ${COLOURS.border}`,
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
              color: COLOURS.white,
              letterSpacing: '0.02em',
            }}
          >
            {streak.currentStreak} day streak
          </span>
          <span
            style={{
              fontSize: 11,
              color: COLOURS.textMuted,
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
            color: COLOURS.textMuted,
            letterSpacing: '0.02em',
          }}
        >
          Start your streak today
        </span>
      )}
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
