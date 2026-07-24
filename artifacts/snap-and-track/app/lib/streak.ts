export interface Streak {
  currentStreak: number;
  lastLogDate: string;
  longestStreak: number;
}

export const EMPTY_STREAK: Streak = { currentStreak: 0, lastLogDate: '', longestStreak: 0 };

const STREAK_KEY = 'munchsnapper_streak';

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function daysAgoLocalStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
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

export function readStreak(): Streak {
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

export function writeStreak(s: Streak): void {
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

export function checkAndResetStreak(): Streak {
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
