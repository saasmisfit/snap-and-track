'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

interface FoodItem {
  name: string;
  calories: number;
}

interface LogEntry {
  id: number;
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

const LEGACY_LOG_KEY = 'snaptrack_log';
const LEGACY_MIGRATION_DONE_KEY = 'munchsnapper_log_migrated';
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
const ACTIVE_GOAL_KEY = 'munchsnapper_active_goal';
const FAST_KEY = 'munchsnapper_fast';
const FAST_COMPLETE_MESSAGE =
  '⏰ Your fast is complete! Your eating window is now open.';

type FastPlan = '16:8' | '18:6' | '20:4' | 'custom';
type FastPhase = 'fasting' | 'eating';

interface FastState {
  active: boolean;
  startTime: string;
  planHours: number;
  eatingWindowHours: number;
  notifiedComplete?: boolean;
}

const FAST_PRESETS: Array<{ plan: FastPlan; label: string; fastHours: number; eatHours: number }> = [
  { plan: '16:8', label: '16:8', fastHours: 16, eatHours: 8 },
  { plan: '18:6', label: '18:6', fastHours: 18, eatHours: 6 },
  { plan: '20:4', label: '20:4', fastHours: 20, eatHours: 4 },
  { plan: 'custom', label: 'Custom', fastHours: 16, eatHours: 8 },
];

const PROGRESS_PHOTOS_KEY = 'munchsnapper_progress_photos';
const PROGRESS_PHOTOS_MAX = 12;
const PROGRESS_PHOTO_MAX_WIDTH = 800;
const PROGRESS_PHOTO_JPEG_QUALITY = 0.85;

interface ProgressPhoto {
  date: string;
  weekLabel: string;
  dataUrl: string;
}
const COACH_INITIAL_QUESTION =
  'Give me a brief overview of how my nutrition has looked this week and one thing to focus on.';

type CoachGoal = 'fat_loss' | 'maintain' | 'build';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

function readActiveGoal(): CoachGoal {
  try {
    const raw = window.localStorage.getItem(ACTIVE_GOAL_KEY);
    if (raw === 'fat_loss' || raw === 'maintain' || raw === 'build') return raw;
  } catch {
    // best-effort
  }
  return 'maintain';
}

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
    typeof o.id === 'number' &&
    typeof o.dish === 'string' &&
    typeof o.loggedAt === 'string' &&
    typeof o.calories === 'number' &&
    Array.isArray(o.foods_identified)
  );
}

async function fetchEntries(userId: string, days = 7): Promise<LogEntry[]> {
  const res = await fetch(`/api/log?userId=${encodeURIComponent(userId)}&days=${days}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GET /api/log failed (${res.status})`);
  const data: unknown = await res.json().catch(() => ({}));
  const entries =
    data && typeof data === 'object' && 'entries' in data
      ? (data as { entries: unknown }).entries
      : null;
  if (!Array.isArray(entries)) return [];
  return entries.filter(isLogEntry);
}

interface LegacyLogEntry {
  dish: string;
  portion_estimate?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g?: number;
  foods_identified?: FoodItem[];
  stacy_insight?: string;
  loggedAt?: string;
  logDate?: string;
  logTime?: string;
}

function isLegacyLogEntry(v: unknown): v is LegacyLogEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.dish === 'string' &&
    typeof o.calories === 'number' &&
    typeof o.protein_g === 'number' &&
    typeof o.carbs_g === 'number' &&
    typeof o.fat_g === 'number'
  );
}

async function migrateLegacyEntries(userId: string): Promise<boolean> {
  let raw: string | null = null;
  try {
    if (window.localStorage.getItem(LEGACY_MIGRATION_DONE_KEY) === '1') return false;
    raw = window.localStorage.getItem(LEGACY_LOG_KEY);
  } catch {
    return false;
  }
  if (!raw) {
    try {
      window.localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, '1');
    } catch {
      // best-effort
    }
    return false;
  }

  let legacy: LegacyLogEntry[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    legacy = Array.isArray(parsed) ? parsed.filter(isLegacyLogEntry) : [];
  } catch {
    legacy = [];
  }

  if (legacy.length === 0) {
    try {
      window.localStorage.removeItem(LEGACY_LOG_KEY);
      window.localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, '1');
    } catch {
      // best-effort
    }
    return false;
  }

  const results = await Promise.allSettled(
    legacy.map((e) =>
      fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          logDate: e.logDate ?? new Date().toISOString().split('T')[0],
          logTime: e.logTime ?? '',
          mealName: e.dish,
          description: e.portion_estimate ?? '',
          calories: e.calories,
          protein: e.protein_g,
          carbs: e.carbs_g,
          fat: e.fat_g,
          fibre: typeof e.fibre_g === 'number' ? e.fibre_g : 0,
          ingredients: Array.isArray(e.foods_identified) ? e.foods_identified : [],
          coachingNote: typeof e.stacy_insight === 'string' ? e.stacy_insight : '',
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(`POST failed (${r.status})`);
      })
    )
  );
  const allOk = results.every((r) => r.status === 'fulfilled');
  if (allOk) {
    try {
      window.localStorage.removeItem(LEGACY_LOG_KEY);
      window.localStorage.setItem(LEGACY_MIGRATION_DONE_KEY, '1');
    } catch {
      // best-effort
    }
    return true;
  }
  return false;
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

function isFastState(v: unknown): v is FastState {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.active === 'boolean' &&
    typeof o.startTime === 'string' &&
    typeof o.planHours === 'number' &&
    Number.isFinite(o.planHours) &&
    typeof o.eatingWindowHours === 'number' &&
    Number.isFinite(o.eatingWindowHours)
  );
}

function readFastState(): FastState | null {
  try {
    const raw = window.localStorage.getItem(FAST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isFastState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeFastState(state: FastState | null): void {
  try {
    if (state) {
      window.localStorage.setItem(FAST_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(FAST_KEY);
    }
  } catch {
    // best-effort
  }
}

function fastEndMs(state: FastState): number {
  return new Date(state.startTime).getTime() + state.planHours * 3_600_000;
}

function eatingEndMs(state: FastState): number {
  return fastEndMs(state) + state.eatingWindowHours * 3_600_000;
}

function currentFastPhase(state: FastState, nowMs: number): FastPhase | null {
  if (!state.active) return null;
  const startMs = new Date(state.startTime).getTime();
  if (!Number.isFinite(startMs)) return null;
  if (nowMs < fastEndMs(state)) return 'fasting';
  if (nowMs < eatingEndMs(state)) return 'eating';
  return null;
}

function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function startOfWeekLocal(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekIdLocal(d: Date = new Date()): string {
  const start = startOfWeekLocal(d);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const da = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function weekLabelLocal(d: Date = new Date()): string {
  const start = startOfWeekLocal(d);
  const day = start.getDate();
  const month = start.toLocaleDateString('en-GB', { month: 'long' });
  return `Week of ${day} ${month}`;
}

function isProgressPhoto(v: unknown): v is ProgressPhoto {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === 'string' &&
    typeof o.weekLabel === 'string' &&
    typeof o.dataUrl === 'string' &&
    o.dataUrl.startsWith('data:')
  );
}

function readProgressPhotos(): ProgressPhoto[] {
  try {
    const raw = window.localStorage.getItem(PROGRESS_PHOTOS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProgressPhoto) : [];
  } catch {
    return [];
  }
}

function writeProgressPhotos(photos: ProgressPhoto[]): boolean {
  try {
    window.localStorage.setItem(PROGRESS_PHOTOS_KEY, JSON.stringify(photos));
    return true;
  } catch {
    return false;
  }
}

function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Empty file'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const ratio =
          img.width > PROGRESS_PHOTO_MAX_WIDTH ? PROGRESS_PHOTO_MAX_WIDTH / img.width : 1;
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', PROGRESS_PHOTO_JPEG_QUALITY));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Canvas export failed'));
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
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

function fmtPhotoDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const yr = Number(parts[0]);
  const mo = Number(parts[1]);
  const da = Number(parts[2]);
  if (!Number.isFinite(yr) || !Number.isFinite(mo) || !Number.isFinite(da)) return dateStr;
  const d = new Date(yr, mo - 1, da);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

function buildMealHistorySummary(entries: LogEntry[] | null): string {
  if (!entries || entries.length === 0) return '';
  const groups = new Map<string, LogEntry[]>();
  entries.forEach((e) => {
    const d = getEntryDate(e);
    const list = groups.get(d);
    if (list) list.push(e);
    else groups.set(d, [e]);
  });
  const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  return sorted
    .map(([date, meals]) => {
      const label = formatDateLabel(date);
      const items = meals
        .map(
          (m) =>
            `${m.dish} ${fmtMacro(m.calories)}kcal/${fmtMacro(m.protein_g)}p/${fmtMacro(m.carbs_g)}c/${fmtMacro(m.fat_g)}f`
        )
        .join(', ');
      return `${label}: ${items}`;
    })
    .join('\n');
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
  const { user, isLoaded, isSignedIn } = useUser();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [coachGoal, setCoachGoal] = useState<CoachGoal>('maintain');
  const [fastOpen, setFastOpen] = useState(false);
  const [fastState, setFastState] = useState<FastState | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FastPlan>('16:8');
  const [customFastHours, setCustomFastHours] = useState<string>('16');
  const [customEatingHours, setCustomEatingHours] = useState<string>('8');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const previousPhaseRef = useRef<FastPhase | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const autoQuestionFiredRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // One-time hydration for localStorage-backed bits + initial UI state
  useEffect(() => {
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
    setCoachGoal(readActiveGoal());
    setProgressPhotos(readProgressPhotos());

    const stored = readFastState();
    if (stored && stored.active) {
      const phase = currentFastPhase(stored, Date.now());
      if (phase === null) {
        writeFastState(null);
        setFastState(null);
      } else {
        previousPhaseRef.current = phase;
        setFastState(stored);
      }
    }
  }, []);

  // Tick every 60 seconds while a fast is active so the countdown re-renders
  useEffect(() => {
    if (!fastState?.active) return;
    setNowTick(Date.now());
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [fastState?.active, fastState?.startTime]);

  // When the fast transitions fasting → eating, fire a single notification.
  // When eating completes, clear the active fast.
  useEffect(() => {
    if (!fastState?.active) return;
    const phase = currentFastPhase(fastState, nowTick);
    if (phase === null) {
      previousPhaseRef.current = null;
      writeFastState(null);
      setFastState(null);
      return;
    }
    if (
      previousPhaseRef.current === 'fasting' &&
      phase === 'eating' &&
      !fastState.notifiedComplete
    ) {
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(FAST_COMPLETE_MESSAGE);
        } catch {
          // best-effort
        }
      }
      const updated: FastState = { ...fastState, notifiedComplete: true };
      writeFastState(updated);
      setFastState(updated);
    }
    previousPhaseRef.current = phase;
  }, [fastState, nowTick]);

  // Migrate legacy localStorage entries (one-time) then fetch from API
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    let cancelled = false;
    const userId = user.id;
    (async () => {
      try {
        await migrateLegacyEntries(userId);
        const fetched = await fetchEntries(userId, 7);
        if (cancelled) return;
        setEntries(fetched);
        setLoadError(null);
      } catch {
        if (cancelled) return;
        setEntries([]);
        setLoadError('Could not load meals — please refresh.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id]);

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

  async function removeEntry(id: number) {
    if (!user?.id) return;
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    try {
      await fetch('/api/log', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, userId: user.id }),
      });
    } catch {
      // best-effort — leave optimistic removal in place
    }
  }

  function toggleExpanded(id: number) {
    setExpanded((m) => ({ ...m, [String(id)]: !m[String(id)] }));
  }

  function toggleDate(dateStr: string) {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  function startFast() {
    let fastHours = 16;
    let eatHours = 8;
    if (selectedPlan === 'custom') {
      const fh = parseFloat(customFastHours);
      const eh = parseFloat(customEatingHours);
      if (!Number.isFinite(fh) || fh <= 0 || fh > 48) return;
      if (!Number.isFinite(eh) || eh <= 0 || eh > 24) return;
      fastHours = fh;
      eatHours = eh;
    } else {
      const preset = FAST_PRESETS.find((p) => p.plan === selectedPlan);
      if (!preset) return;
      fastHours = preset.fastHours;
      eatHours = preset.eatHours;
    }
    const next: FastState = {
      active: true,
      startTime: new Date().toISOString(),
      planHours: fastHours,
      eatingWindowHours: eatHours,
      notifiedComplete: false,
    };
    writeFastState(next);
    previousPhaseRef.current = 'fasting';
    setFastState(next);
    setNowTick(Date.now());
  }

  function endFast() {
    writeFastState(null);
    previousPhaseRef.current = null;
    setFastState(null);
  }

  async function handleProgressPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setPhotoError('Please pick an image file.');
      return;
    }
    if (f.size > 20_000_000) {
      setPhotoError('Photo too large (over 20MB).');
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(f);
      const now = new Date();
      const date = weekIdLocal(now);
      const weekLabel = weekLabelLocal(now);
      const filtered = progressPhotos.filter((p) => p.date !== date);
      const next = [...filtered, { date, weekLabel, dataUrl }].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const pruned = next.slice(-PROGRESS_PHOTOS_MAX);
      const stored = writeProgressPhotos(pruned);
      if (!stored) {
        setPhotoError("Couldn't save the photo — your browser storage may be full.");
        return;
      }
      setProgressPhotos(pruned);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not process that photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function sendChat(question: string) {
    if (!user?.id) return;
    const trimmed = question.trim();
    if (!trimmed) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setChatInput('');
    setIsChatLoading(true);
    setChatError(null);
    try {
      const mealHistory = buildMealHistorySummary(entries);
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          question: trimmed,
          mealHistory,
          goal: coachGoal,
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Coach error (${res.status})`;
        throw new Error(detail);
      }
      const data: unknown = await res.json().catch(() => null);
      const reply =
        data && typeof data === 'object' && 'reply' in data
          ? String((data as { reply: unknown }).reply)
          : '';
      if (!reply) throw new Error('Empty reply from coach');
      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Coach failed.');
    } finally {
      setIsChatLoading(false);
    }
  }

  // First time the chat opens (and entries are loaded), auto-fire the opening question
  useEffect(() => {
    if (!chatOpen) return;
    if (autoQuestionFiredRef.current) return;
    if (!user?.id) return;
    if (entries === null) return;
    autoQuestionFiredRef.current = true;
    void sendChat(COACH_INITIAL_QUESTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, user?.id, entries]);

  // Keep the chat scrolled to the latest message as it grows
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, isChatLoading, chatError]);

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

        {/* Ask Stacy — AI coach chat */}
        <section
          aria-label="Ask Stacy"
          style={{
            background: COLOURS.card,
            border: `1px solid ${COLOURS.border}`,
            borderRadius: 16,
            padding: chatOpen ? '14px 16px 16px' : '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            aria-expanded={chatOpen}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              color: COLOURS.white,
              fontFamily: "'Barlow', sans-serif",
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                💬
              </span>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: '-0.01em',
                  color: COLOURS.white,
                }}
              >
                Ask Stacy
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: COLOURS.magenta,
                }}
              >
                AI coach
              </span>
            </span>
            <span style={{ color: COLOURS.textMuted, fontSize: 14 }} aria-hidden="true">
              {chatOpen ? '▾' : '▸'}
            </span>
          </button>

          {chatOpen && (
            <>
              <div
                ref={chatScrollRef}
                style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingRight: 2,
                }}
              >
                {chatMessages.length === 0 && !isChatLoading ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: COLOURS.textMuted,
                      padding: '12px 4px',
                      lineHeight: 1.5,
                    }}
                  >
                    Loading your weekly snapshot…
                  </div>
                ) : null}

                {chatMessages.map((m, i) =>
                  m.role === 'user' ? (
                    <div
                      key={i}
                      style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        background: COLOURS.cardRaised,
                        border: `1px solid ${COLOURS.border}`,
                        borderRadius: 14,
                        padding: '10px 14px',
                        color: COLOURS.white,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </div>
                  ) : (
                    <div
                      key={i}
                      style={{
                        alignSelf: 'flex-start',
                        maxWidth: '85%',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          width: 24,
                          height: 24,
                          background: COLOURS.magenta,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 800,
                          fontSize: 10,
                          color: COLOURS.white,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        MS
                      </div>
                      <div
                        style={{
                          background: 'transparent',
                          color: COLOURS.white,
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          paddingTop: 2,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  )
                )}

                {isChatLoading && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      color: COLOURS.textMuted,
                      fontSize: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: 24,
                        height: 24,
                        background: COLOURS.magenta,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800,
                        fontSize: 10,
                        color: COLOURS.white,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                        opacity: 0.85,
                      }}
                    >
                      MS
                    </div>
                    <span>Stacy is typing</span>
                    <span className="coach-typing-dots" aria-hidden="true">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </span>
                  </div>
                )}

                {chatError && (
                  <div
                    role="alert"
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '85%',
                      fontSize: 12,
                      color: COLOURS.danger,
                      lineHeight: 1.5,
                    }}
                  >
                    {chatError}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isChatLoading) return;
                  void sendChat(chatInput);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask me anything about your nutrition this week..."
                  aria-label="Ask Stacy a question"
                  disabled={isChatLoading}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: COLOURS.nearBlack,
                    color: COLOURS.white,
                    border: `1px solid ${COLOURS.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  style={{
                    background: COLOURS.magenta,
                    color: COLOURS.white,
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 16px',
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: isChatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: isChatLoading || !chatInput.trim() ? 0.5 : 1,
                  }}
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>

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

        {/* Fasting timer — 16:8 / 18:6 / 20:4 / custom */}
        {(() => {
          const phase = fastState ? currentFastPhase(fastState, nowTick) : null;
          const isActive = !!fastState?.active && phase !== null;
          const remainingMs =
            isActive && fastState
              ? phase === 'fasting'
                ? fastEndMs(fastState) - nowTick
                : eatingEndMs(fastState) - nowTick
              : 0;
          const fastHoursForLabel = fastState
            ? fastState.planHours
            : selectedPlan === 'custom'
              ? Math.max(0, parseFloat(customFastHours) || 0)
              : FAST_PRESETS.find((p) => p.plan === selectedPlan)?.fastHours ?? 16;
          const eatHoursForLabel = fastState
            ? fastState.eatingWindowHours
            : selectedPlan === 'custom'
              ? Math.max(0, parseFloat(customEatingHours) || 0)
              : FAST_PRESETS.find((p) => p.plan === selectedPlan)?.eatHours ?? 8;
          const windowStartMs = fastState ? fastEndMs(fastState) : null;
          const windowEndMs = fastState ? eatingEndMs(fastState) : null;
          const canStart =
            selectedPlan === 'custom'
              ? Number.isFinite(parseFloat(customFastHours)) &&
                parseFloat(customFastHours) > 0 &&
                Number.isFinite(parseFloat(customEatingHours)) &&
                parseFloat(customEatingHours) > 0
              : true;
          return (
            <section
              aria-label="Fasting timer"
              style={{
                background: COLOURS.card,
                border: `1px solid ${COLOURS.border}`,
                borderRadius: 16,
                padding: fastOpen ? '14px 16px 16px' : '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setFastOpen((o) => !o)}
                aria-expanded={fastOpen}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  color: COLOURS.white,
                  fontFamily: "'Barlow', sans-serif",
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                    ⏱
                  </span>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: '-0.01em',
                      color: COLOURS.white,
                    }}
                  >
                    Fasting Timer
                  </span>
                  {isActive && (
                    <span
                      aria-label="Fast in progress"
                      title="Fast in progress"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: COLOURS.magenta,
                      }}
                    >
                      <span aria-hidden="true">🔒</span>
                      {phase === 'eating' ? 'Eating' : 'Fasting'}
                    </span>
                  )}
                </span>
                <span style={{ color: COLOURS.textMuted, fontSize: 14 }} aria-hidden="true">
                  {fastOpen ? '▾' : '▸'}
                </span>
              </button>

              {fastOpen && (
                <>
                  {!isActive && (
                    <>
                      <div
                        role="radiogroup"
                        aria-label="Fasting plan"
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}
                      >
                        {FAST_PRESETS.map((p) => {
                          const active = p.plan === selectedPlan;
                          return (
                            <button
                              key={p.plan}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setSelectedPlan(p.plan)}
                              style={{
                                background: active ? COLOURS.magenta : 'transparent',
                                color: active ? COLOURS.white : 'rgba(255,255,255,0.85)',
                                border: `1.5px solid ${active ? COLOURS.magenta : COLOURS.border}`,
                                borderRadius: 999,
                                padding: '8px 6px',
                                fontFamily: "'Barlow', sans-serif",
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      {selectedPlan === 'custom' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: COLOURS.textMuted,
                              }}
                            >
                              Fast hours
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={48}
                              step="0.5"
                              value={customFastHours}
                              onChange={(e) => setCustomFastHours(e.target.value)}
                              style={{
                                background: COLOURS.nearBlack,
                                color: COLOURS.white,
                                border: `1px solid ${COLOURS.border}`,
                                borderRadius: 10,
                                padding: '10px 12px',
                                fontFamily: "'Barlow', sans-serif",
                                fontSize: 14,
                                outline: 'none',
                                appearance: 'textfield',
                              }}
                            />
                          </label>
                          <label
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: COLOURS.textMuted,
                              }}
                            >
                              Eating window
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={24}
                              step="0.5"
                              value={customEatingHours}
                              onChange={(e) => setCustomEatingHours(e.target.value)}
                              style={{
                                background: COLOURS.nearBlack,
                                color: COLOURS.white,
                                border: `1px solid ${COLOURS.border}`,
                                borderRadius: 10,
                                padding: '10px 12px',
                                fontFamily: "'Barlow', sans-serif",
                                fontSize: 14,
                                outline: 'none',
                                appearance: 'textfield',
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  <div
                    style={{
                      background: COLOURS.nearBlack,
                      border: `1px solid ${COLOURS.border}`,
                      borderRadius: 12,
                      padding: '18px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 800,
                        fontSize: 28,
                        lineHeight: 1.1,
                        color: isActive ? COLOURS.magenta : COLOURS.textMuted,
                        letterSpacing: '-0.01em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isActive
                        ? phase === 'eating'
                          ? `🍽️ Eating window open — ${fmtRemaining(remainingMs)} left`
                          : `⏱ ${fmtRemaining(remainingMs)} remaining`
                        : `Ready: ${fastHoursForLabel}h fast · ${eatHoursForLabel}h window`}
                    </div>
                    {isActive && windowStartMs !== null && windowEndMs !== null ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: COLOURS.textMuted,
                          letterSpacing: '0.02em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Eating window: {fmtClock(windowStartMs)} – {fmtClock(windowEndMs)}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: COLOURS.textMuted,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Pick a plan and start when you&apos;re ready.
                      </div>
                    )}
                  </div>

                  {isActive ? (
                    <button
                      type="button"
                      onClick={endFast}
                      style={{
                        background: 'transparent',
                        color: COLOURS.magenta,
                        border: `2px solid ${COLOURS.magenta}`,
                        borderRadius: 999,
                        padding: '12px 18px',
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      End fast early
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startFast}
                      disabled={!canStart}
                      style={{
                        background: canStart ? COLOURS.magenta : '#2a2a30',
                        color: canStart ? COLOURS.white : 'rgba(255,255,255,0.4)',
                        border: 'none',
                        borderRadius: 999,
                        padding: '12px 18px',
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: canStart ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Start fast
                    </button>
                  )}
                </>
              )}
            </section>
          );
        })()}

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

        {/* Progress photos — weekly photo + side-by-side compare */}
        <section
          aria-label="Progress photos"
          style={{
            background: COLOURS.card,
            border: `1px solid ${COLOURS.border}`,
            borderRadius: 16,
            padding: photosOpen ? '14px 16px 16px' : '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setPhotosOpen((o) => !o)}
            aria-expanded={photosOpen}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              color: COLOURS.white,
              fontFamily: "'Barlow', sans-serif",
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                📸
              </span>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: '-0.01em',
                  color: COLOURS.white,
                }}
              >
                Progress photos
              </span>
              {progressPhotos.length > 0 ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: COLOURS.magenta,
                  }}
                >
                  {progressPhotos.length}
                </span>
              ) : null}
            </span>
            <span style={{ color: COLOURS.textMuted, fontSize: 14 }} aria-hidden="true">
              {photosOpen ? '▾' : '▸'}
            </span>
          </button>

          {photosOpen && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handleProgressPhotoSelected}
                style={{ display: 'none' }}
              />

              {progressPhotos.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: COLOURS.textMuted,
                    lineHeight: 1.55,
                    padding: '8px 4px',
                  }}
                >
                  Track your transformation — add a weekly progress photo to see how far you&apos;ve come.
                </div>
              ) : (
                <div
                  className="progress-scroll"
                  style={{
                    display: 'flex',
                    gap: 10,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    paddingBottom: 2,
                    marginLeft: -2,
                    marginRight: -2,
                    paddingLeft: 2,
                    paddingRight: 2,
                  }}
                >
                  {progressPhotos.map((p) => (
                    <div
                      key={p.date}
                      style={{
                        flex: '0 0 auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        alignItems: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.dataUrl}
                        alt={p.weekLabel}
                        style={{
                          width: 90,
                          height: 120,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: `1px solid ${COLOURS.border}`,
                          display: 'block',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: COLOURS.textMuted,
                          fontVariantNumeric: 'tabular-nums',
                          textAlign: 'center',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {fmtPhotoDate(p.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'stretch',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  style={{
                    flex: '1 1 200px',
                    background: COLOURS.magenta,
                    color: COLOURS.white,
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 18px',
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: photoUploading ? 'wait' : 'pointer',
                    opacity: photoUploading ? 0.7 : 1,
                  }}
                >
                  {photoUploading ? 'Adding…' : "＋ Add this week's photo"}
                </button>
                {progressPhotos.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    style={{
                      flex: '0 0 auto',
                      background: 'transparent',
                      color: COLOURS.white,
                      border: `1px solid ${COLOURS.border}`,
                      borderRadius: 10,
                      padding: '12px 18px',
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Compare
                  </button>
                )}
              </div>

              {photoError && (
                <div
                  role="alert"
                  style={{
                    fontSize: 12,
                    color: COLOURS.danger,
                    lineHeight: 1.5,
                  }}
                >
                  {photoError}
                </div>
              )}
            </>
          )}
        </section>

        {/* Loading state — while we fetch entries from the API */}
        {entries === null && !loadError && (
          <div style={styles.loadingHint}>Loading your meals...</div>
        )}

        {/* Error state */}
        {loadError && (
          <div
            role="alert"
            style={{
              background: COLOURS.card,
              border: `1px solid ${COLOURS.border}`,
              borderRadius: 14,
              padding: '16px 18px',
              color: COLOURS.danger,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {loadError}
          </div>
        )}

        {/* Empty state */}
        {entries !== null && entries.length === 0 && !loadError && (
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
                            aria-expanded={!!expanded[String(e.id)]}
                          >
                            What I could see {expanded[String(e.id)] ? '▴' : '▾'}
                          </button>
                          {expanded[String(e.id)] && (
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

        .coach-typing-dots {
          display: inline-flex;
          gap: 1px;
        }
        .coach-typing-dots span {
          animation: coachDotPulse 1.2s infinite;
          opacity: 0.3;
        }
        .coach-typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .coach-typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes coachDotPulse {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }

        .progress-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {compareOpen && progressPhotos.length >= 2
        ? (() => {
            const sorted = [...progressPhotos].sort((a, b) => a.date.localeCompare(b.date));
            const newest = sorted[sorted.length - 1];
            const older = sorted[sorted.length - 2];
            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Progress photo comparison"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(14,14,16,0.96)',
                  zIndex: 120,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem 1rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCompareOpen(false)}
                  aria-label="Close comparison"
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'transparent',
                    border: 'none',
                    color: COLOURS.white,
                    fontSize: 16,
                    fontFamily: "'Barlow', sans-serif",
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    padding: 8,
                  }}
                >
                  × Close
                </button>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 720,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                  }}
                >
                  <figure
                    style={{
                      flex: 1,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={older.dataUrl}
                      alt={`Older photo from ${older.weekLabel}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        borderRadius: 10,
                        background: '#000',
                      }}
                    />
                    <figcaption
                      style={{
                        fontSize: 12,
                        color: COLOURS.textMuted,
                        textAlign: 'center',
                        letterSpacing: '0.02em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {older.weekLabel}
                    </figcaption>
                  </figure>
                  <figure
                    style={{
                      flex: 1,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newest.dataUrl}
                      alt={`Most recent photo from ${newest.weekLabel}`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        borderRadius: 10,
                        background: '#000',
                      }}
                    />
                    <figcaption
                      style={{
                        fontSize: 12,
                        color: COLOURS.textMuted,
                        textAlign: 'center',
                        letterSpacing: '0.02em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {newest.weekLabel}
                    </figcaption>
                  </figure>
                </div>
              </div>
            );
          })()
        : null}
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
