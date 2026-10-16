'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';
import { StreakBadge } from '../components/StreakBadge';
import { EMPTY_STREAK, checkAndResetStreak, readStreak, writeStreak, type Streak } from '../lib/streak';
import { APP_COLOURS } from '../lib/app-colours';
import { convertHeicToJpeg, isHeic, shrinkImage } from '../lib/shrink-image';
import { makeMealThumb, saveMealThumb } from '../lib/meal-thumbs';

const userButtonAppearance = {
  variables: {
    colorPrimary: APP_COLOURS.magenta,
    colorBackground: APP_COLOURS.card,
    colorText: APP_COLOURS.heading,
    colorTextSecondary: APP_COLOURS.textMuted,
  },
  elements: {
    userButtonAvatarBox: { width: 32, height: 32 },
    userButtonPopoverCard: {
      background: APP_COLOURS.card,
      border: `1px solid ${APP_COLOURS.border}`,
      boxShadow: APP_COLOURS.shadowFloat,
    },
    userButtonPopoverActionButton: { color: APP_COLOURS.heading },
  },
};

const FREE_SNAP_LIMIT = 3;
const NET_CARBS_KEY = 'munchsnapper_netcarbs';
const ONBOARDING_KEY = 'munchsnapper_onboarding_complete';
const GOALS_KEY = 'munchsnapper_goals';
const ACTIVE_GOAL_KEY = 'munchsnapper_active_goal';
const BURNED_KEY_PREFIX = 'munchsnapper_burned_today_';
const NOTIF_ASKED_KEY = 'munchsnapper_notif_asked';
const DAILY_SCHEDULED_PREFIX = 'munchsnapper_daily_reminders_scheduled_';
const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30];
const DAILY_REMINDERS: ReadonlyArray<{ hour: number; minute: number; message: string }> = [
  { hour: 8, minute: 0, message: "🍳 Good morning! Don't forget to log your breakfast." },
  { hour: 13, minute: 0, message: '🥗 Lunchtime! Snap your meal and stay on track.' },
  { hour: 19, minute: 0, message: '🍽️ Log your dinner to keep your streak alive.' },
];

type Goal = 'fat_loss' | 'maintain' | 'build';
type AnalyseMode = 'meal' | 'menu';
type MacroKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g';
type Sex = 'male' | 'female';
type Activity = 'sedentary' | 'light' | 'moderate' | 'very';
type WeightUnit = 'kg' | 'lbs';
type HeightUnit = 'cm' | 'ftin';

interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  netcarbs_fibre: number;
}

interface OnboardingForm {
  age: string;
  weightValue: string;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  sex: Sex | null;
  activity: Activity | null;
  goal: Goal | null;
}

const ACTIVITY_OPTIONS: Array<{ value: Activity; label: string; multiplier: number }> = [
  { value: 'sedentary', label: 'Sedentary', multiplier: 1.2 },
  { value: 'light', label: 'Lightly active', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderately active', multiplier: 1.55 },
  { value: 'very', label: 'Very active', multiplier: 1.725 },
];

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  fat_loss: 0.8,
  maintain: 1.0,
  build: 1.15,
};

interface FoodItem {
  name: string;
  calories: number;
}

interface AnalyseResponse {
  dish: string;
  portion_estimate: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  foods_identified: FoodItem[];
  stacy_insight: string;
  // Server-authoritative free-tier counters, returned by /api/analyse only.
  // Absent on results built client-side (e.g. barcode scans).
  freeSnapsUsed?: number;
  freeSnapsRemaining?: number | null;
}

function readFreeSnapsUsed(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object') return 0;
  const raw = (metadata as Record<string, unknown>).freeSnapsUsed;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 0;
}

const GOALS: Array<{ value: Goal; label: string }> = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'build', label: 'Build & tone' },
];

function isGoal(v: unknown): v is Goal {
  return GOALS.some((g) => g.value === v);
}

const LOADING_MESSAGES = [
  'Spotting the ingredients…',
  'Estimating portion sizes…',
  'Calculating your macros…',
  'Almost there…',
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result'));
        return;
      }
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function fmtMacro(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toString();
}

function parsePositive(raw: string): number | null {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function weightToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * 0.45359237;
}

function heightToCm(form: OnboardingForm): number | null {
  if (form.heightUnit === 'cm') {
    return parsePositive(form.heightCm);
  }
  const ft = parsePositive(form.heightFt);
  if (ft === null) return null;
  const inches = form.heightIn.trim() === '' ? 0 : parseFloat(form.heightIn);
  if (!Number.isFinite(inches) || inches < 0) return null;
  return ft * 30.48 + inches * 2.54;
}

function computeGoals(form: OnboardingForm): UserGoals | null {
  const age = parsePositive(form.age);
  const weightVal = parsePositive(form.weightValue);
  const cm = heightToCm(form);
  if (age === null || weightVal === null || cm === null || !form.sex || !form.activity || !form.goal) {
    return null;
  }
  const kg = weightToKg(weightVal, form.weightUnit);
  const bmr =
    form.sex === 'male'
      ? 10 * kg + 6.25 * cm - 5 * age + 5
      : 10 * kg + 6.25 * cm - 5 * age - 161;
  const multiplier = ACTIVITY_OPTIONS.find((a) => a.value === form.activity)?.multiplier ?? 1.2;
  const tdee = bmr * multiplier;
  const calories = Math.round(tdee * GOAL_ADJUSTMENT[form.goal]);
  const protein = Math.round((2.0 * kg) / 5) * 5;
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, netcarbs_fibre: 0 };
}

function isUserGoals(v: unknown): v is UserGoals {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.calories === 'number' &&
    typeof o.protein === 'number' &&
    typeof o.carbs === 'number' &&
    typeof o.fat === 'number'
  );
}

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

interface SavedLogEntry {
  id?: number;
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

interface RecentMealItem {
  key: string;
  dish: string;
  calories: number;
  template: SavedLogEntry;
}

function isSavedLogEntry(v: unknown): v is SavedLogEntry {
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

function buildRecentMealsFromEntries(entries: SavedLogEntry[]): RecentMealItem[] {
  const seen = new Set<string>();
  const items: RecentMealItem[] = [];
  for (const e of entries) {
    const dish = e.dish.trim();
    if (!dish) continue;
    const key = dish.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ key, dish, calories: e.calories, template: e });
    if (items.length >= 5) break;
  }
  return items;
}

async function fetchLogEntries(userId: string): Promise<SavedLogEntry[]> {
  const res = await fetch(`/api/log?userId=${encodeURIComponent(userId)}&days=7`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GET /api/log failed (${res.status})`);
  const data: unknown = await res.json().catch(() => ({}));
  const entries =
    data && typeof data === 'object' && 'entries' in data
      ? (data as { entries: unknown }).entries
      : null;
  if (!Array.isArray(entries)) return [];
  return entries.filter(isSavedLogEntry);
}

function recordMealLogged(): { streak: Streak; milestone: number | null } {
  const prev = readStreak();
  const today = todayLocalStr();
  const yesterday = daysAgoLocalStr(1);
  let next: Streak;
  if (prev.lastLogDate === today) {
    next = prev;
  } else if (prev.lastLogDate === yesterday) {
    const newCur = prev.currentStreak + 1;
    next = {
      currentStreak: newCur,
      lastLogDate: today,
      longestStreak: Math.max(prev.longestStreak, newCur),
    };
  } else {
    next = {
      currentStreak: 1,
      lastLogDate: today,
      longestStreak: Math.max(prev.longestStreak, 1),
    };
  }
  if (next !== prev) writeStreak(next);
  const milestone =
    next.currentStreak !== prev.currentStreak && STREAK_MILESTONES.includes(next.currentStreak)
      ? next.currentStreak
      : null;
  return { streak: next, milestone };
}

export default function SnapAndTrackApp() {
  const { user, isLoaded, isSignedIn } = useUser();
  const isSubscribed = user?.publicMetadata?.subscribed === true;

  const [goal, setGoal] = useState<Goal>('fat_loss');
  const [goalHydrated, setGoalHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<AnalyseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [snapCount, setSnapCount] = useState<number | null>(null);
  const [editingTile, setEditingTile] = useState<MacroKey | null>(null);
  const [loggedEntryId, setLoggedEntryId] = useState<number | null>(null);
  const [netCarbs, setNetCarbs] = useState(false);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [streak, setStreak] = useState<Streak>(EMPTY_STREAK);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported' | 'unknown'>(
    'unknown'
  );
  const [recentMeals, setRecentMeals] = useState<RecentMealItem[]>([]);
  const [logEntryCount, setLogEntryCount] = useState(0);
  const [showRelogToast, setShowRelogToast] = useState(false);
  const [relogBusyKey, setRelogBusyKey] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showVoiceLog, setShowVoiceLog] = useState(false);
  const [mode, setMode] = useState<AnalyseMode>('meal');
  const [burnedToday, setBurnedToday] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  // Each result shown gets a token. A save is tied to the token it started on,
  // so one result is saved at most once and a late reply never marks a newer
  // result as logged.
  const resultTokenRef = useRef(0);
  const savingTokenRef = useRef<number | null>(null);
  const savedTokenRef = useRef<number | null>(null);
  // The small photo thumbnail for the current result, kept so a manual retry
  // after a failed automatic save still stores it. Released once saved or when
  // a new result begins.
  const pendingThumbRef = useRef<{ token: number; blob: Promise<Blob | null> } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Revoke object URLs when they change or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Rotate loading messages while analysing
  useEffect(() => {
    if (!isAnalysing) return;
    setLoadingIdx(0);
    const id = window.setInterval(() => {
      setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [isAnalysing]);

  // Hydrate the free-snap count from Clerk publicMetadata — the server is the
  // sole source of truth, this is display only. Refreshed from each
  // /api/analyse response so it stays accurate within the session.
  useEffect(() => {
    if (!isLoaded) return;
    setSnapCount(readFreeSnapsUsed(user?.publicMetadata));
  }, [isLoaded, user?.id, user?.publicMetadata]);

  // Load Net carbs preference on mount
  useEffect(() => {
    try {
      setNetCarbs(window.localStorage.getItem(NET_CARBS_KEY) === '1');
    } catch {
      // best-effort
    }
  }, []);

  // Load saved goals on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GOALS_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isUserGoals(parsed)) setGoals(parsed);
    } catch {
      // best-effort
    }
  }, []);

  // Trigger onboarding the first time an authenticated user opens the app
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    try {
      if (window.localStorage.getItem(ONBOARDING_KEY) !== '1') {
        setShowOnboarding(true);
      }
    } catch {
      // best-effort
    }
  }, [isLoaded, isSignedIn]);

  // Hydrate streak + apply break-reset if last log is older than yesterday
  useEffect(() => {
    setStreak(checkAndResetStreak());
  }, []);

  // Restore the active goal after mount (not during render, to avoid a hydration mismatch)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTIVE_GOAL_KEY);
      if (isGoal(stored)) setGoal(stored);
    } catch {
      // best-effort
    }
    setGoalHydrated(true);
  }, []);

  // Persist the active goal so other pages (log/coach) can read it.
  // Waits for the restore above so the default never overwrites the saved value.
  useEffect(() => {
    if (!goalHydrated) return;
    try {
      window.localStorage.setItem(ACTIVE_GOAL_KEY, goal);
    } catch {
      // best-effort
    }
  }, [goal, goalHydrated]);

  // Hydrate today's burned-calories input (per-day key, so it resets automatically)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${BURNED_KEY_PREFIX}${todayLocalStr()}`);
      const n = raw ? parseFloat(raw) : 0;
      setBurnedToday(Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
    } catch {
      // best-effort
    }
  }, []);

  function handleBurnedChange(raw: string) {
    const n = parseFloat(raw);
    const clean = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    setBurnedToday(clean);
    try {
      window.localStorage.setItem(`${BURNED_KEY_PREFIX}${todayLocalStr()}`, String(clean));
    } catch {
      // best-effort
    }
  }

  // Hydrate recent meals from the API (skips silently if not signed in or on error)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    let cancelled = false;
    fetchLogEntries(user.id)
      .then((entries) => {
        if (cancelled) return;
        setRecentMeals(buildRecentMealsFromEntries(entries));
        setLogEntryCount(entries.length);
      })
      .catch(() => {
        // best-effort: leave defaults
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id]);

  // Auto-hide the "Logged ✓" toast after 2 seconds
  useEffect(() => {
    if (!showRelogToast) return;
    const id = window.setTimeout(() => setShowRelogToast(false), 2000);
    return () => window.clearTimeout(id);
  }, [showRelogToast]);

  // Notification permission — ask once on first load, remember result
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setNotifPerm('unsupported');
      return;
    }
    setNotifPerm(Notification.permission);
    let asked: string | null = null;
    try {
      asked = window.localStorage.getItem(NOTIF_ASKED_KEY);
    } catch {
      // best-effort
    }
    if (asked) return;
    if (Notification.permission !== 'default') {
      try {
        window.localStorage.setItem(NOTIF_ASKED_KEY, Notification.permission);
      } catch {
        // best-effort
      }
      return;
    }
    Notification.requestPermission()
      .then((p) => {
        setNotifPerm(p);
        try {
          window.localStorage.setItem(NOTIF_ASKED_KEY, p);
        } catch {
          // best-effort
        }
      })
      .catch(() => {
        // best-effort
      });
  }, []);

  // Schedule daily meal reminders — best-effort, once per session per day
  useEffect(() => {
    if (notifPerm !== 'granted') return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    const today = todayLocalStr();
    const sessionKey = `${DAILY_SCHEDULED_PREFIX}${today}`;
    try {
      if (window.sessionStorage.getItem(sessionKey)) return;
    } catch {
      // best-effort
    }
    const now = new Date();
    for (const r of DAILY_REMINDERS) {
      const slot = new Date(now);
      slot.setHours(r.hour, r.minute, 0, 0);
      const delay = slot.getTime() - now.getTime();
      if (delay <= 0) continue;
      window.setTimeout(() => {
        try {
          new Notification(r.message);
        } catch {
          // best-effort
        }
      }, delay);
    }
    try {
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // best-effort
    }
  }, [notifPerm]);

  function completeOnboarding(next: UserGoals, chosenGoal: Goal) {
    try {
      window.localStorage.setItem(GOALS_KEY, JSON.stringify(next));
      window.localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // best-effort
    }
    setGoals(next);
    setGoal(chosenGoal);
    setShowOnboarding(false);
  }

  function toggleNetCarbs() {
    setNetCarbs((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NET_CARBS_KEY, next ? '1' : '0');
      } catch {
        // best-effort
      }
      return next;
    });
  }

  function pickFile() {
    setMode('meal');
    fileInputRef.current?.click();
  }

  function pickCamera() {
    setMode('meal');
    cameraInputRef.current?.click();
  }

  function pickGallery() {
    setMode('meal');
    galleryInputRef.current?.click();
  }

  function pickBarcode() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setMode('meal');
    setShowBarcodeScanner(true);
  }

  function pickMenu() {
    setMode('menu');
    cameraInputRef.current?.click();
  }

  function pickVoice() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setMode('meal');
    setShowVoiceLog(true);
  }

  // Starts a fresh save state for the next result (or for no result).
  function beginNewResult() {
    resultTokenRef.current += 1;
    pendingThumbRef.current = null;
    setJustLogged(false);
    setIsSaving(false);
    setSaveFailed(false);
    setLoggedEntryId(null);
  }

  // Barcode scans make no AI call, so they never consume a free snap.
  function handleBarcodeResult(data: AnalyseResponse) {
    setShowBarcodeScanner(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setEditingTile(null);
    beginNewResult();
    setMode('meal');
    setResult(data);
    void logMeal(data);
  }

  function handleVoiceResult(data: AnalyseResponse) {
    setShowVoiceLog(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setEditingTile(null);
    beginNewResult();
    setMode('meal');
    setResult(data);
    if (typeof data.freeSnapsUsed === 'number') setSnapCount(data.freeSnapsUsed);
    void logMeal(data);
  }

  function updateMacro(key: MacroKey, raw: string) {
    const parsed = parseFloat(raw);
    const clean = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
    setResult((r) => (r ? { ...r, [key]: clean } : r));
    if (loggedEntryId !== null && user?.id) {
      const payload: Record<string, unknown> = { id: loggedEntryId, userId: user.id };
      if (key === 'calories') payload.calories = clean;
      else if (key === 'protein_g') payload.protein = clean;
      else if (key === 'carbs_g') payload.carbs = clean;
      else if (key === 'fat_g') payload.fat = clean;
      fetch('/api/log', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // best-effort
      });
    }
    setEditingTile(null);
  }

  async function acceptFile(picked: File) {
    let f = picked;
    // iPhone HEIC photos are converted to JPEG here, so the preview, compression,
    // analysis and log thumbnail all work on an ordinary JPEG.
    if (isHeic(picked)) {
      const converted = await convertHeicToJpeg(picked);
      if (!converted) {
        setError(
          'We couldn’t open that iPhone (HEIC) photo in this browser. Please choose a JPG or PNG instead.'
        );
        return;
      }
      f = converted;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('That file type isn’t supported. Please use JPG, PNG, WebP or HEIC.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setError(null);
    beginNewResult();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    void acceptFile(f);
  }

  function handleDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    setMode('meal');
    void acceptFile(f);
  }

  function reset(keepGoal = true) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setIsAnalysing(false);
    setEditingTile(null);
    beginNewResult();
    setMode('meal');
    if (!keepGoal) setGoal('fat_loss');
  }

  async function analyse() {
    if (!file) return;
    // UI-level short-circuit only. The server enforces the real limit — this
    // just avoids a pointless round trip when we already know it's exhausted.
    if (!isSubscribed && snapCount !== null && snapCount >= FREE_SNAP_LIMIT) return;
    setIsAnalysing(true);
    setError(null);
    setResult(null);
    try {
      // Every photo (camera, gallery, drag-and-drop, menu) passes through here.
      // shrinkImage returns the original file whenever shrinking is not possible.
      const upload = await shrinkImage(file);
      const base64 = await fileToBase64(upload);
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: upload.type, goal, mode }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

      // Server says the allowance is gone — sync our counter so the subscribe
      // gate renders instead of a raw error message.
      if (res.status === 403 && payload.limitReached === true) {
        if (typeof payload.freeSnapsUsed === 'number') setSnapCount(payload.freeSnapsUsed);
        else setSnapCount(FREE_SNAP_LIMIT);
        return;
      }
      if (!res.ok) {
        const detail =
          'error' in payload ? String(payload.error) : `Request failed (${res.status})`;
        throw new Error(detail);
      }
      const result = data as AnalyseResponse;
      beginNewResult();
      setResult(result);
      if (typeof result.freeSnapsUsed === 'number') setSnapCount(result.freeSnapsUsed);
      // A menu scan is a recommendation, not a meal eaten, so it is only
      // logged if the user taps the button.
      if (mode === 'meal') {
        pendingThumbRef.current = {
          token: resultTokenRef.current,
          blob: makeMealThumb(upload),
        };
        void logMeal(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong analysing that meal.');
    } finally {
      setIsAnalysing(false);
    }
  }

  // Called automatically after each successful analysis, and by the
  // "Log this meal" button for menu scans or when the automatic save failed.
  // `target` is passed on the automatic path because the new result is not in
  // state yet. A result is saved at most once (see resultTokenRef).
  async function logMeal(target: AnalyseResponse | null = result) {
    const token = resultTokenRef.current;
    if (!target || !user?.id) return;
    if (savedTokenRef.current === token || savingTokenRef.current === token) return;
    savingTokenRef.current = token;
    const isCurrent = () => resultTokenRef.current === token;
    const userId = user.id;
    setIsSaving(true);
    setSaveFailed(false);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const logTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    let saved = false;
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          logDate: todayStr,
          logTime,
          mealName: target.dish,
          description: target.portion_estimate,
          calories: target.calories,
          protein: target.protein_g,
          carbs: target.carbs_g,
          fat: target.fat_g,
          fibre: target.fibre_g,
          ingredients: target.foods_identified,
          coachingNote: target.stacy_insight,
        }),
      });
      if (res.ok) {
        saved = true;
        savedTokenRef.current = token;
        const data: unknown = await res.json().catch(() => ({}));
        const entry =
          data && typeof data === 'object' && 'entry' in data
            ? (data as { entry: unknown }).entry
            : null;
        if (entry && typeof entry === 'object' && 'id' in entry) {
          const id = (entry as { id: unknown }).id;
          if (typeof id === 'number') {
            if (isCurrent()) setLoggedEntryId(id);
            // Browser-only photo for the Log page; never sent anywhere.
            const pending = pendingThumbRef.current;
            if (pending && pending.token === token) {
              pendingThumbRef.current = null;
              void pending.blob.then((blob) =>
                blob ? saveMealThumb(id, userId, blob) : undefined
              );
            }
          }
        }
      }
    } catch {
      // handled below: the result stays on screen with the manual button
    }
    if (savingTokenRef.current === token) savingTokenRef.current = null;
    if (isCurrent()) {
      setIsSaving(false);
      setSaveFailed(!saved);
      if (saved) setJustLogged(true);
    }
    if (!saved) return;

    const { streak: nextStreak, milestone } = recordMealLogged();
    setStreak(nextStreak);
    if (
      milestone !== null &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(
          `🔥 ${milestone} day streak! You're on a roll — keep snapping your meals.`
        );
      } catch {
        // best-effort
      }
    }

    try {
      const entries = await fetchLogEntries(userId);
      setRecentMeals(buildRecentMealsFromEntries(entries));
      setLogEntryCount(entries.length);
    } catch {
      // best-effort
    }
  }

  async function relogMeal(template: SavedLogEntry, key: string) {
    if (!user?.id || relogBusyKey) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const logTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setRelogBusyKey(key);
    setError(null);
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          logDate: todayStr,
          logTime,
          mealName: template.dish,
          description: template.portion_estimate ?? '',
          calories: template.calories,
          protein: template.protein_g,
          carbs: template.carbs_g,
          fat: template.fat_g,
          fibre: typeof template.fibre_g === 'number' ? template.fibre_g : 0,
          ingredients: Array.isArray(template.foods_identified) ? template.foods_identified : [],
          coachingNote: typeof template.stacy_insight === 'string' ? template.stacy_insight : '',
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Save failed (${res.status})`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that meal again.');
      setRelogBusyKey(null);
      return;
    }
    setRelogBusyKey(null);
    setShowRelogToast(true);

    try {
      const entries = await fetchLogEntries(user.id);
      setRecentMeals(buildRecentMealsFromEntries(entries));
      setLogEntryCount(entries.length);
    } catch {
      // best-effort
    }

    const { streak: nextStreak, milestone } = recordMealLogged();
    setStreak(nextStreak);
    if (
      milestone !== null &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(
          `🔥 ${milestone} day streak! You're on a roll — keep snapping your meals.`
        );
      } catch {
        // best-effort
      }
    }
  }

  // Opens the Stripe customer portal (cancel, change card, invoices).
  async function openBillingPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing-portal', { method: 'POST' });
      const data: unknown = await res.json().catch(() => ({}));
      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      if (!res.ok || typeof payload.url !== 'string') {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`
        );
      }
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setPortalLoading(false);
    }
  }

  const canAnalyse = !!file && !isAnalysing && !result;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <header style={styles.header}>
          <Link
            href="/"
            aria-label="Munch Snapper home"
            style={{ display: 'inline-flex', alignItems: 'center', flex: 1, minWidth: 0, textDecoration: 'none' }}
          >
            <Image
              src="/munch-snapper-logo.png"
              alt="Munch Snapper"
              width={160}
              height={60}
              priority
              style={{ width: 'auto', height: 44, display: 'block', background: 'transparent', filter: 'brightness(0)', opacity: 0.92 }}
            />
          </Link>
          <Link href="/app/plans" className="view-log-link" style={{ color: APP_COLOURS.heading }}>
            Meal plans →
          </Link>
          <Link href="/app/log" className="view-log-link" style={{ color: APP_COLOURS.heading }}>
            View log →
          </Link>
          <UserButton afterSignOutUrl="/" appearance={userButtonAppearance} />
        </header>

        {/* Goal selector */}
        <section style={styles.block}>
          <div style={styles.eyebrow}>Your goal</div>
          <div style={styles.pillRow} role="radiogroup" aria-label="Goal">
            {GOALS.map((g) => {
              const active = g.value === goal;
              return (
                <button
                  key={g.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setGoal(g.value)}
                  className={`goal-pill${active ? ' active' : ''}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Daily target bar — pulled from saved goals */}
        {!result && (
          <div
            style={{
              fontSize: 14,
              color: APP_COLOURS.textMuted,
              textAlign: 'center',
              letterSpacing: '0.02em',
              padding: '6px 4px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {goals ? (
              <>
                Daily target: {goals.calories.toLocaleString('en-GB')} kcal &middot;{' '}
                {goals.protein}g protein &middot; {goals.carbs}g carbs &middot; {goals.fat}g fat
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: APP_COLOURS.magenta,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  letterSpacing: '0.02em',
                }}
              >
                Set your targets →
              </button>
            )}
          </div>
        )}

        {/* Calories-burned input — adjusts today's calorie ceiling */}
        {!result && goals ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '0 4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label
                htmlFor="burn-input"
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: APP_COLOURS.textMuted,
                  lineHeight: 1.4,
                  letterSpacing: '0.02em',
                }}
              >
                Calories burned today (Apple Watch / Fitbit / Garmin):
              </label>
              <input
                id="burn-input"
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                value={burnedToday > 0 ? String(burnedToday) : ''}
                onChange={(e) => handleBurnedChange(e.target.value)}
                placeholder="0"
                aria-label="Calories burned today"
                style={{
                  width: 80,
                  background: APP_COLOURS.card,
                  color: APP_COLOURS.text,
                  border: `1px solid ${APP_COLOURS.border}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 16,
                  outline: 'none',
                  textAlign: 'right',
                  appearance: 'textfield',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
            {burnedToday > 0 ? (
              <div
                style={{
                  fontSize: 14,
                  color: APP_COLOURS.magenta,
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                }}
              >
                Adjusted target: {(goals.calories + burnedToday).toLocaleString('en-GB')} kcal
                (original {goals.calories.toLocaleString('en-GB')} + {burnedToday.toLocaleString('en-GB')} burned)
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Streak badge */}
        {!result && <StreakBadge streak={streak} />}

        {/* Recent meals — quick re-log */}
        {!result && logEntryCount >= 2 && recentMeals.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={styles.eyebrow}>Recent meals</div>
            <div
              className="recent-scroll"
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
              {recentMeals.map((m) => (
                <div
                  key={m.key}
                  style={{
                    flex: '0 0 168px',
                    background: APP_COLOURS.card,
                    border: `1px solid ${APP_COLOURS.border}`,
                    boxShadow: APP_COLOURS.shadowCard,
                    borderRadius: 12,
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    title={m.dish}
                    style={{
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 16,
                      fontWeight: 600,
                      color: APP_COLOURS.heading,
                      lineHeight: 1.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: '2.5em',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.dish}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 800,
                      fontSize: 22,
                      color: APP_COLOURS.magenta,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                    }}
                  >
                    {fmtMacro(m.calories)}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: APP_COLOURS.textMuted,
                        letterSpacing: '0.04em',
                      }}
                    >
                      kcal
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => relogMeal(m.template, m.key)}
                    disabled={relogBusyKey !== null}
                    aria-busy={relogBusyKey === m.key}
                    aria-label={`Log ${m.dish} again`}
                    style={{
                      marginTop: 'auto',
                      background: 'transparent',
                      color: APP_COLOURS.magenta,
                      border: `1px solid ${APP_COLOURS.magenta}`,
                      borderRadius: 999,
                      padding: '6px 10px',
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: relogBusyKey !== null ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {relogBusyKey === m.key ? 'Saving…' : '＋ Log again'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upload / preview — hidden once we have a result */}
        {!result && (
          <section style={styles.block}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {!file ? (
              <>
                <button
                  type="button"
                  onClick={pickFile}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`upload-zone${isDragging ? ' dragging' : ''}`}
                  aria-label="Drag your photo here, tap to upload, or take a photo"
                >
                  <div className="upload-icon" aria-hidden="true">
                    📷
                  </div>
                  <div className="upload-title">Drag your photo here, tap to upload, or take a photo</div>
                  <div className="upload-sub">JPG, PNG, WebP or HEIC</div>
                </button>
                <button
                  type="button"
                  onClick={pickCamera}
                  className="camera-btn"
                  aria-label="Take a photo"
                >
                  📷 Take a photo
                </button>
                <button
                  type="button"
                  onClick={pickGallery}
                  aria-label="Upload from gallery"
                  style={{
                    width: '100%',
                    background: APP_COLOURS.card,
                    color: APP_COLOURS.heading,
                    border: `1.5px solid ${APP_COLOURS.border}`,
                    padding: '14px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>🖼️</span>
                  Upload from gallery
                </button>
                <button
                  type="button"
                  onClick={pickBarcode}
                  aria-label="Scan a barcode"
                  style={{
                    width: '100%',
                    background: APP_COLOURS.card,
                    color: APP_COLOURS.heading,
                    border: `1.5px solid ${APP_COLOURS.border}`,
                    padding: '14px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="3" y="6" width="2" height="12" />
                    <rect x="6" y="6" width="1" height="12" />
                    <rect x="9" y="6" width="3" height="12" />
                    <rect x="13" y="6" width="1" height="12" />
                    <rect x="15" y="6" width="2" height="12" />
                    <rect x="18" y="6" width="1" height="12" />
                    <rect x="20" y="6" width="2" height="12" />
                  </svg>
                  Scan barcode
                </button>
                <button
                  type="button"
                  onClick={pickMenu}
                  aria-label="Scan a restaurant menu"
                  style={{
                    width: '100%',
                    background: APP_COLOURS.card,
                    color: APP_COLOURS.heading,
                    border: `1.5px solid ${APP_COLOURS.border}`,
                    padding: '14px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>🍽️</span>
                  Scan menu
                </button>
                <button
                  type="button"
                  onClick={pickVoice}
                  aria-label="Voice log a meal"
                  style={{
                    width: '100%',
                    background: APP_COLOURS.card,
                    color: APP_COLOURS.heading,
                    border: `1.5px solid ${APP_COLOURS.border}`,
                    padding: '14px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>🎙️</span>
                  Voice log
                </button>
              </>
            ) : (
              <div style={styles.previewCard}>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name} style={styles.previewImg} />
                ) : null}
                <div style={styles.previewRow}>
                  <div style={styles.previewName} title={file.name}>
                    {mode === 'menu' ? (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: APP_COLOURS.magenta,
                        }}
                      >
                        🍽️ Menu mode
                      </span>
                    ) : (
                      file.name
                    )}
                  </div>
                  <button type="button" onClick={pickFile} className="change-photo">
                    Change photo
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Analyse button (or subscribe gate if free snaps exhausted) — hidden once we have a result */}
        {!result && (
          <section style={styles.block}>
            {!isSubscribed && snapCount !== null && snapCount >= FREE_SNAP_LIMIT ? (
              <div style={styles.subscribeGate}>
                <div style={styles.gateTitle}>You&apos;ve used your 3 free snaps 🎉</div>
                <div style={styles.gateSub}>Subscribe for unlimited access — £5.99/month</div>
                <Link
                  href="/subscribe"
                  className="subscribe-cta"
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'transparent',
                    color: APP_COLOURS.magenta,
                    border: `2px solid ${APP_COLOURS.magenta}`,
                    textAlign: 'center',
                    padding: '14px 24px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginTop: '0.5rem',
                  }}
                >
                  Subscribe now →
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={analyse}
                  disabled={!canAnalyse}
                  className={`analyse-btn${canAnalyse ? '' : ' disabled'}`}
                >
                  {isAnalysing
                    ? mode === 'menu'
                      ? 'Reading menu…'
                      : 'Analysing…'
                    : mode === 'menu'
                      ? 'Recommend best item ✦'
                      : 'Analyse my meal ✦'}
                </button>
                {isSubscribed ? (
                  <>
                    <div style={styles.proBadge}>✓ Pro</div>
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      aria-busy={portalLoading}
                      style={styles.manageSubLink}
                    >
                      {portalLoading ? 'Opening…' : 'Manage subscription'}
                    </button>
                  </>
                ) : snapCount !== null && snapCount < FREE_SNAP_LIMIT ? (
                  <div style={styles.freeCounter}>
                    {FREE_SNAP_LIMIT - snapCount} of {FREE_SNAP_LIMIT} free snaps remaining
                  </div>
                ) : null}
              </>
            )}
          </section>
        )}

        {/* Loading state */}
        {isAnalysing && (
          <section style={styles.loadingBox} aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <div style={styles.loadingText}>{LOADING_MESSAGES[loadingIdx]}</div>
          </section>
        )}

        {/* Error state */}
        {error && !isAnalysing && (
          <section style={styles.errorBox} role="alert">
            <div style={styles.errorTitle}>Something went wrong</div>
            <div style={styles.errorMsg}>{error}</div>
          </section>
        )}

        {/* Results */}
        {result && (
          <section style={styles.resultsWrap} aria-live="polite">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={result.dish}
                style={{
                  width: '100%',
                  maxHeight: '280px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'block',
                }}
              />
            )}
            <div style={styles.resultHeader}>
              <div style={styles.resultDish}>{result.dish}</div>
              <div style={styles.resultPortion}>{result.portion_estimate}</div>
            </div>

            <div style={styles.macroGrid}>
              <MacroTile
                label="Calories"
                value={result.calories}
                unit="kcal"
                accent
                isEditing={editingTile === 'calories'}
                onStartEdit={() => setEditingTile('calories')}
                onCommit={(raw) => updateMacro('calories', raw)}
              />
              <MacroTile
                label="Protein"
                value={result.protein_g}
                unit="g"
                isEditing={editingTile === 'protein_g'}
                onStartEdit={() => setEditingTile('protein_g')}
                onCommit={(raw) => updateMacro('protein_g', raw)}
              />
              <MacroTile
                label={netCarbs ? 'Net carbs' : 'Carbs'}
                value={
                  netCarbs
                    ? Math.max(
                        0,
                        (Number.isFinite(result.carbs_g) ? result.carbs_g : 0) -
                          (Number.isFinite(result.fibre_g) ? result.fibre_g : 0)
                      )
                    : result.carbs_g
                }
                unit="g"
                isEditing={editingTile === 'carbs_g'}
                onStartEdit={() => setEditingTile('carbs_g')}
                onCommit={(raw) => {
                  if (netCarbs) {
                    const parsed = parseFloat(raw);
                    const clean = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
                    const fibre = Number.isFinite(result.fibre_g) ? Math.round(result.fibre_g) : 0;
                    updateMacro('carbs_g', String(clean + fibre));
                  } else {
                    updateMacro('carbs_g', raw);
                  }
                }}
              />
              <MacroTile
                label="Fat"
                value={result.fat_g}
                unit="g"
                isEditing={editingTile === 'fat_g'}
                onStartEdit={() => setEditingTile('fat_g')}
                onCommit={(raw) => updateMacro('fat_g', raw)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -2,
              }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={netCarbs}
                aria-label="Net carbs"
                onClick={toggleNetCarbs}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: "'Barlow', sans-serif",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: netCarbs ? APP_COLOURS.magenta : APP_COLOURS.textMuted,
                  }}
                >
                  Net carbs
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 22,
                    background: netCarbs ? APP_COLOURS.magenta : APP_COLOURS.controlOutline,
                    borderRadius: 999,
                    transition: 'background 0.2s',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: netCarbs ? 20 : 2,
                      width: 18,
                      height: 18,
                      background: APP_COLOURS.card,
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: APP_COLOURS.shadowKnob,
                    }}
                  />
                </span>
              </button>
            </div>
            <div
              style={{
                fontSize: 14,
                color: APP_COLOURS.textMuted,
                textAlign: 'center',
                letterSpacing: '0.04em',
                marginTop: -4,
              }}
            >
              Tap to edit
            </div>

            {goals && (
              <div
                style={{
                  padding: '8px 4px 2px',
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: APP_COLOURS.textMuted,
                    marginBottom: 4,
                  }}
                >
                  Of your daily target
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: APP_COLOURS.textMuted,
                    letterSpacing: '0.02em',
                    lineHeight: 1.6,
                  }}
                >
                  {fmtMacro(result.calories)} kcal{' '}
                  <span style={{ color: APP_COLOURS.magenta, fontWeight: 600 }}>
                    ({goals.calories > 0 ? Math.round((result.calories / goals.calories) * 100) : 0}%)
                  </span>
                  {' · '}
                  {fmtMacro(result.protein_g)}g protein{' '}
                  <span style={{ color: APP_COLOURS.magenta, fontWeight: 600 }}>
                    ({goals.protein > 0 ? Math.round((result.protein_g / goals.protein) * 100) : 0}%)
                  </span>
                  {' · '}
                  {fmtMacro(result.carbs_g)}g carbs{' '}
                  <span style={{ color: APP_COLOURS.magenta, fontWeight: 600 }}>
                    ({goals.carbs > 0 ? Math.round((result.carbs_g / goals.carbs) * 100) : 0}%)
                  </span>
                  {' · '}
                  {fmtMacro(result.fat_g)}g fat{' '}
                  <span style={{ color: APP_COLOURS.magenta, fontWeight: 600 }}>
                    ({goals.fat > 0 ? Math.round((result.fat_g / goals.fat) * 100) : 0}%)
                  </span>
                </div>
              </div>
            )}

            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabel}>
                {mode === 'menu' ? '📋 Menu recommendation' : 'What I can see'}
              </div>
              <ul style={styles.foodList}>
                {result.foods_identified.map((f, i) => (
                  <li key={`${f.name}-${i}`} style={styles.foodItem}>
                    <span style={styles.foodName}>{f.name}</span>
                    <span style={styles.foodCalories}>{fmtMacro(f.calories)} kcal</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabel}>Stacy’s take</div>
              <p style={styles.insight}>{result.stacy_insight}</p>
            </div>

            {justLogged ? (
              <div className="log-btn logged" role="status">
                ✓ Logged!
              </div>
            ) : (
              <>
                {saveFailed && (
                  <p className="save-failed" role="alert">
                    Not saved to your log yet. Tap below to try again.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void logMeal()}
                  disabled={isSaving}
                  className="log-btn"
                >
                  {isSaving ? 'Saving to your log…' : '✓ Log this meal'}
                </button>
              </>
            )}

            <button type="button" onClick={() => reset()} className="reset-link">
              Analyse another meal →
            </button>
          </section>
        )}
      </div>

      {/* Component-scoped styles for things inline styles can't do (hover, focus,
          keyframes, media queries). Works in App Router client components. */}
      <style jsx>{`
        :global(body) {
          background: ${APP_COLOURS.softBg};
        }

        :global(main input:focus),
        :global(main select:focus),
        :global(main textarea:focus) {
          border-color: ${APP_COLOURS.magenta} !important;
          box-shadow: 0 0 0 3px ${APP_COLOURS.magentaTint};
        }

        .goal-pill {
          flex: 1;
          background: ${APP_COLOURS.card};
          color: ${APP_COLOURS.heading};
          border: 1.5px solid ${APP_COLOURS.border};
          border-radius: 999px;
          padding: 11px 16px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.1s;
        }
        .goal-pill:hover {
          border-color: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.magenta};
        }
        .goal-pill.active {
          background: ${APP_COLOURS.magenta};
          border-color: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.onMagenta};
        }
        .goal-pill.active:hover {
          background: ${APP_COLOURS.magentaDark};
          border-color: ${APP_COLOURS.magentaDark};
        }

        .upload-zone {
          width: 100%;
          background: ${APP_COLOURS.card};
          border: 2px dashed ${APP_COLOURS.controlOutline};
          border-radius: 18px;
          padding: 3rem 1.5rem;
          color: ${APP_COLOURS.text};
          font-family: var(--body-font), 'Barlow', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.1s;
        }
        .upload-zone:hover {
          border-color: ${APP_COLOURS.magenta};
          background: ${APP_COLOURS.cardRaised};
          transform: translateY(-1px);
        }
        .upload-zone.dragging {
          border-color: ${APP_COLOURS.magenta};
          border-style: solid;
          background: ${APP_COLOURS.magentaSoft};
        }
        .upload-icon {
          font-size: 36px;
          line-height: 1;
        }
        .upload-title {
          font-size: 16px;
          font-weight: 600;
          text-align: center;
        }
        .upload-sub {
          font-size: 14px;
          color: ${APP_COLOURS.textMuted};
          letter-spacing: 0.04em;
        }

        .camera-btn {
          width: 100%;
          background: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.onMagenta};
          border: none;
          padding: 14px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .camera-btn:hover {
          background: ${APP_COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .change-photo {
          background: transparent;
          border: none;
          color: ${APP_COLOURS.magenta};
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }
        .change-photo:hover {
          color: ${APP_COLOURS.magentaDark};
        }

        .analyse-btn {
          width: 100%;
          background: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.onMagenta};
          border: none;
          padding: 16px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .analyse-btn:hover {
          background: ${APP_COLOURS.magentaDark};
          transform: translateY(-1px);
        }
        .analyse-btn.disabled,
        .analyse-btn:disabled {
          background: ${APP_COLOURS.border};
          color: ${APP_COLOURS.textMuted};
          cursor: not-allowed;
          transform: none;
        }

        .log-btn {
          width: 100%;
          background: transparent;
          color: ${APP_COLOURS.magenta};
          border: 2px solid ${APP_COLOURS.magenta};
          padding: 14px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          margin-top: 0.5rem;
        }
        .log-btn:hover {
          background: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.onMagenta};
        }
        .log-btn:disabled,
        .log-btn:disabled:hover {
          cursor: default;
          background: transparent;
          color: ${APP_COLOURS.magenta};
        }
        .log-btn.logged {
          text-align: center;
          box-sizing: border-box;
        }
        .save-failed {
          margin: 0.5rem 0 0;
          font-size: 14px;
          font-weight: 600;
          color: ${APP_COLOURS.danger};
          text-align: center;
        }
        .log-btn.logged,
        .log-btn.logged:hover {
          color: ${APP_COLOURS.success};
          border-color: ${APP_COLOURS.success};
          background: ${APP_COLOURS.successSoft};
          cursor: default;
          transform: none;
        }

        .view-log-link {
          font-size: 14px;
          font-weight: 600;
          color: ${APP_COLOURS.heading};
          text-decoration: none;
          letter-spacing: 0.02em;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .view-log-link:hover {
          color: ${APP_COLOURS.magenta};
        }

        .reset-link {
          background: transparent;
          border: none;
          color: ${APP_COLOURS.textMuted};
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 0.5rem;
          margin-top: 0.25rem;
          align-self: center;
          transition: color 0.2s;
        }
        .reset-link:hover {
          color: ${APP_COLOURS.magenta};
        }

        .spinner {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid ${APP_COLOURS.border};
          border-top-color: ${APP_COLOURS.magenta};
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .subscribe-cta {
          display: block;
          width: 100%;
          background: transparent;
          color: ${APP_COLOURS.magenta};
          border: 2px solid ${APP_COLOURS.magenta};
          text-align: center;
          padding: 14px 24px;
          border-radius: 999px;
          text-decoration: none;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: color 0.2s, border-color 0.2s, transform 0.1s;
          margin-top: 0.5rem;
        }
        .subscribe-cta:hover {
          color: ${APP_COLOURS.magentaDark};
          border-color: ${APP_COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .recent-scroll::-webkit-scrollbar {
          display: none;
        }

        .voice-pulse {
          box-shadow: 0 0 0 0 ${APP_COLOURS.magentaPulse};
          animation: voicePulse 1.4s ease-out infinite;
        }
        @keyframes voicePulse {
          0% {
            box-shadow: 0 0 0 0 ${APP_COLOURS.magentaPulse};
          }
          70% {
            box-shadow: 0 0 0 18px ${APP_COLOURS.magentaPulseEnd};
          }
          100% {
            box-shadow: 0 0 0 0 ${APP_COLOURS.magentaPulseEnd};
          }
        }

        @keyframes relogToastFade {
          0% { opacity: 0; transform: translate(-50%, 8px); }
          12% { opacity: 1; transform: translate(-50%, 0); }
          82% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -6px); }
        }
      `}</style>

      {showOnboarding && isSignedIn ? (
        <OnboardingOverlay
          initialGoal={goal}
          allowClose={goals !== null}
          onClose={() => setShowOnboarding(false)}
          onComplete={completeOnboarding}
        />
      ) : null}

      {showBarcodeScanner ? (
        <BarcodeScannerModal
          onClose={() => setShowBarcodeScanner(false)}
          onResult={handleBarcodeResult}
        />
      ) : null}

      {showVoiceLog ? (
        <VoiceLogModal
          goal={goal}
          onClose={() => setShowVoiceLog(false)}
          onResult={handleVoiceResult}
        />
      ) : null}

      {showRelogToast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: APP_COLOURS.card,
            border: `1px solid ${APP_COLOURS.magentaTint}`,
            borderRadius: 999,
            padding: '10px 22px',
            color: APP_COLOURS.magenta,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: APP_COLOURS.shadowFloat,
            zIndex: 200,
            pointerEvents: 'none',
            animation: 'relogToastFade 2s ease forwards',
          }}
        >
          Logged ✓
        </div>
      ) : null}
    </main>
  );
}

function MacroTile({
  label,
  value,
  unit,
  accent = false,
  isEditing,
  onStartEdit,
  onCommit,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    setDraft(Number.isFinite(value) ? String(Math.round(value)) : '');
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isEditing, value]);

  const valueColour = accent ? APP_COLOURS.magenta : APP_COLOURS.heading;

  return (
    <div
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? -1 : 0}
      aria-label={isEditing ? undefined : `${label}: ${fmtMacro(value)} ${unit}. Tap to edit.`}
      onClick={isEditing ? undefined : onStartEdit}
      onKeyDown={
        isEditing
          ? undefined
          : (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStartEdit();
              }
            }
      }
      style={{
        position: 'relative',
        background: APP_COLOURS.card,
        border: `1px solid ${APP_COLOURS.border}`,
        boxShadow: APP_COLOURS.shadowCard,
        borderRadius: 14,
        padding: '18px 16px',
        textAlign: 'center',
        cursor: isEditing ? 'text' : 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 14,
          color: APP_COLOURS.textMuted,
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        ✏️
      </span>
      {isEditing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          style={{
            width: '100%',
            minWidth: 80,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            textAlign: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 36,
            lineHeight: 1,
            color: valueColour,
            appearance: 'textfield',
          }}
        />
      ) : (
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 36,
            lineHeight: 1,
            color: valueColour,
          }}
        >
          {fmtMacro(value)}
        </div>
      )}
      <div style={{ fontSize: 14, color: APP_COLOURS.textMuted, marginTop: 4 }}>{unit}</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: APP_COLOURS.textMuted,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

type ScannerPhase = 'scanning' | 'looking-up' | 'serving' | 'not-found' | 'error';
type ScannerControlsLike = { stop: () => void };

interface OffPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

function offNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Stacy's take for a barcode scan, worked out from the numbers for the amount
// logged (no AI call). One short, encouraging sentence; first matching rule wins.
function barcodeStacyTake(n: { calories: number; protein: number; carbs: number }): string {
  const { calories, protein, carbs } = n;
  // Missing pack data reads as 0, so make no claims when there are no calories.
  if (calories <= 0) {
    return 'These numbers are straight from the pack, so just tweak the amount if you had more or less than this.';
  }
  const proteinShare = (protein * 4) / calories;
  const carbShare = (carbs * 4) / calories;
  if (protein >= 20 || (protein >= 10 && proteinShare >= 0.3)) {
    return `Nice one: ${protein}g of protein is a really good hit towards your day.`;
  }
  if (calories > 500) {
    return `This one comes in at ${calories} kcal, so keep the rest of today a little lighter and you’ll stay right on track.`;
  }
  if (calories < 150) {
    return `At ${calories} kcal, this is a light, easy fit for your day.`;
  }
  if (carbShare >= 0.5 && proteinShare < 0.15) {
    return 'This one is mostly carbs, so pair it with a protein source and it’ll round things out nicely.';
  }
  return 'These numbers are straight from the pack, so just tweak the amount if you had more or less than this.';
}

function BarcodeScannerModal({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (data: AnalyseResponse) => void;
}) {
  const [phase, setPhase] = useState<ScannerPhase>('scanning');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [per100g, setPer100g] = useState<OffPer100g | null>(null);
  const [servingGrams, setServingGrams] = useState<string>('100');
  const [typedCode, setTypedCode] = useState<string>('');
  const [typedError, setTypedError] = useState<string>('');
  const [showNoReadHint, setShowNoReadHint] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Set once a lookup starts, so a camera read and a typed number can never
  // both start one. Cleared when the lookup finishes and by tryAgain().
  const lookupStartedRef = useRef(false);

  // Leaving the 'scanning' phase stops the camera (see the cleanup below), so
  // this is the single way into a lookup for both the camera and a typed number.
  function startLookup(code: string) {
    if (lookupStartedRef.current) return;
    lookupStartedRef.current = true;
    setPhase('looking-up');
    void lookupBarcode(code);
  }

  // After about 15 seconds of scanning with no read, show a gentle hint. The
  // scan keeps running; any phase change (such as a read) hides the hint.
  useEffect(() => {
    setShowNoReadHint(false);
    if (phase !== 'scanning') return;
    const t = window.setTimeout(() => setShowNoReadHint(true), 15000);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    let cancelled = false;
    let controls: ScannerControlsLike | null = null;

    (async () => {
      try {
        const zxing = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new zxing.BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        const result = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (decoded, _err, ctrls) => {
            if (cancelled || !decoded) return;
            try {
              ctrls.stop();
            } catch {
              // best-effort
            }
            startLookup(decoded.getText());
          }
        );
        controls = result as unknown as ScannerControlsLike;
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(
          e instanceof Error
            ? e.message
            : 'Could not start the camera. Check permissions and try again.'
        );
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      if (controls) {
        try {
          controls.stop();
        } catch {
          // best-effort
        }
      }
    };
    // startLookup only touches refs and state setters, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function lookupBarcode(barcode: string) {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
      );
      const data: unknown = await res.json().catch(() => null);
      const ok =
        !!data &&
        typeof data === 'object' &&
        (data as { status?: unknown }).status === 1 &&
        !!(data as { product?: unknown }).product;
      if (!ok) {
        setPhase('not-found');
        return;
      }
      const product = (data as { product: Record<string, unknown> }).product;
      const rawName =
        typeof product.product_name === 'string' && product.product_name.trim()
          ? (product.product_name as string).trim()
          : typeof product.product_name_en === 'string' && (product.product_name_en as string).trim()
            ? (product.product_name_en as string).trim()
            : '';
      if (!rawName) {
        setPhase('not-found');
        return;
      }
      const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
      setProductName(rawName);
      setPer100g({
        calories: offNumber(nutriments['energy-kcal_100g']),
        protein: offNumber(nutriments['proteins_100g']),
        carbs: offNumber(nutriments['carbohydrates_100g']),
        fat: offNumber(nutriments['fat_100g']),
        fibre: offNumber(nutriments['fiber_100g']),
      });
      setServingGrams('100');
      setPhase('serving');
    } catch {
      setPhase('not-found');
    } finally {
      // The camera has stopped by now, so a new (typed) lookup may start.
      lookupStartedRef.current = false;
    }
  }

  function tryAgain() {
    setErrorMsg('');
    setProductName('');
    setPer100g(null);
    setServingGrams('100');
    setTypedCode('');
    setTypedError('');
    lookupStartedRef.current = false;
    setPhase('scanning');
  }

  function submitTypedCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = typedCode.replace(/\s+/g, '');
    if (!/^\d{8,14}$/.test(code)) {
      setTypedError('Check the number under the barcode (8 to 14 digits).');
      return;
    }
    setTypedError('');
    startLookup(code);
  }

  const servingValue = parseFloat(servingGrams);
  const servingValid = Number.isFinite(servingValue) && servingValue > 0;
  const preview = per100g && servingValid
    ? {
        calories: Math.round((per100g.calories * servingValue) / 100),
        protein: Math.round((per100g.protein * servingValue) / 100),
        carbs: Math.round((per100g.carbs * servingValue) / 100),
        fat: Math.round((per100g.fat * servingValue) / 100),
        fibre: Math.round((per100g.fibre * servingValue) / 100),
      }
    : null;

  // Barcode scans are fully free: Open Food Facts supplies verified macros, so
  // there is no AI call here and no free-snap allowance is consumed.
  function confirmServing() {
    if (!per100g || !preview) return;
    onResult({
      dish: productName,
      portion_estimate: `${servingValue}g serving`,
      calories: preview.calories,
      protein_g: preview.protein,
      carbs_g: preview.carbs,
      fat_g: preview.fat,
      fibre_g: preview.fibre,
      foods_identified: [
        {
          name: `Scanned: ${productName} — ${servingValue}g serving`,
          calories: preview.calories,
        },
      ],
      // Built from the same per-serving numbers as above, so it follows the grams chosen.
      stacy_insight: barcodeStacyTake(preview),
    });
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: APP_COLOURS.overlay,
    zIndex: 110,
    overflowY: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '2rem 1rem',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowFloat,
    borderRadius: 18,
    padding: '1.75rem 1.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: APP_COLOURS.text,
    position: 'relative',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: APP_COLOURS.textMuted,
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 6,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    lineHeight: 1.1,
    margin: 0,
    letterSpacing: '-0.01em',
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: APP_COLOURS.magenta,
    color: APP_COLOURS.onMagenta,
    border: 'none',
    padding: '14px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    color: APP_COLOURS.magenta,
    border: `1px solid ${APP_COLOURS.magenta}`,
    padding: '12px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  // "Can't scan? Type the number": goes through the same lookup as a camera read.
  const typedEntry = (
    <form
      onSubmit={submitTypedCode}
      noValidate
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderTop: `1px solid ${APP_COLOURS.border}`,
        paddingTop: '1rem',
      }}
    >
      <label
        htmlFor="barcode-typed"
        style={{ fontSize: 16, fontWeight: 600, color: APP_COLOURS.heading }}
      >
        Can&apos;t scan? Type the number
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="barcode-typed"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Numbers under the barcode"
          value={typedCode}
          onChange={(e) => {
            setTypedCode(e.target.value);
            if (typedError) setTypedError('');
          }}
          aria-invalid={typedError ? true : undefined}
          aria-describedby={typedError ? 'barcode-typed-error' : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            boxSizing: 'border-box',
            background: APP_COLOURS.card,
            color: APP_COLOURS.text,
            border: `1px solid ${typedError ? APP_COLOURS.danger : APP_COLOURS.border}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontFamily: "'Barlow', sans-serif",
            fontSize: 16,
            outline: 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <button
          type="submit"
          style={{
            ...secondaryBtnStyle,
            width: 'auto',
            minHeight: 44,
            flexShrink: 0,
            padding: '0 18px',
          }}
        >
          Look up
        </button>
      </div>
      {typedError && (
        <p
          id="barcode-typed-error"
          role="alert"
          style={{ fontSize: 14, color: APP_COLOURS.danger, margin: 0, lineHeight: 1.4 }}
        >
          {typedError}
        </p>
      )}
    </form>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan a barcode" style={overlayStyle}>
      <div style={cardStyle}>
        <button type="button" onClick={onClose} aria-label="Close scanner" style={closeBtnStyle}>
          ✕
        </button>

        {phase === 'scanning' && (
          <>
            <h2 style={titleStyle}>Scan a barcode</h2>
            <div
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: 12,
                overflow: 'hidden',
                background: APP_COLOURS.photoMatte,
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '55vh',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <p style={{ fontSize: 16, color: APP_COLOURS.textMuted, margin: 0, textAlign: 'center' }}>
              Point your camera at a product barcode
            </p>
            {showNoReadHint && (
              <p
                role="status"
                style={{
                  fontSize: 15,
                  color: APP_COLOURS.text,
                  background: APP_COLOURS.magentaSoft,
                  border: `1px solid ${APP_COLOURS.magentaTint}`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  margin: 0,
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                Still looking. Hold the barcode steady in good light, a little further back, or type
                the number below.
              </p>
            )}
            {typedEntry}
          </>
        )}

        {phase === 'looking-up' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              padding: '2.5rem 1rem',
            }}
          >
            <div className="spinner" aria-hidden="true" />
            <div style={{ fontSize: 16, color: APP_COLOURS.textMuted }}>Looking up product…</div>
          </div>
        )}

        {phase === 'serving' && per100g && (
          <>
            <h2 style={titleStyle}>{productName}</h2>
            <label
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: APP_COLOURS.textMuted,
              }}
            >
              How much did you eat?
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step="1"
                value={servingGrams}
                onChange={(e) => setServingGrams(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  background: APP_COLOURS.card,
                  color: APP_COLOURS.text,
                  border: `1px solid ${APP_COLOURS.border}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 16,
                  outline: 'none',
                  appearance: 'textfield',
                }}
              />
              <span style={{ color: APP_COLOURS.text, fontSize: 16 }}>g</span>
            </div>
            {preview && (
              <div
                style={{
                  background: APP_COLOURS.magentaSoft,
                  border: `1px solid ${APP_COLOURS.magentaTint}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  color: APP_COLOURS.text,
                  lineHeight: 1.5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: APP_COLOURS.magenta,
                    marginBottom: 4,
                  }}
                >
                  This serving
                </div>
                {preview.calories} kcal · {preview.protein}g protein · {preview.carbs}g carbs ·{' '}
                {preview.fat}g fat
              </div>
            )}
            <button
              type="button"
              onClick={confirmServing}
              disabled={!servingValid}
              style={{
                ...primaryBtnStyle,
                background: !servingValid ? APP_COLOURS.border : APP_COLOURS.magenta,
                color: !servingValid ? APP_COLOURS.textMuted : APP_COLOURS.onMagenta,
                cursor: !servingValid ? 'not-allowed' : 'pointer',
              }}
            >
              Confirm
            </button>
          </>
        )}

        {phase === 'not-found' && (
          <>
            <h2 style={titleStyle}>Hmm, no match</h2>
            <p style={{ fontSize: 16, color: APP_COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              Product not found. Try scanning again or snap a photo instead.
            </p>
            <button type="button" onClick={tryAgain} style={primaryBtnStyle}>
              Try again
            </button>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Close
            </button>
            {typedEntry}
          </>
        )}

        {phase === 'error' && (
          <>
            <h2 style={titleStyle}>Camera trouble</h2>
            <p style={{ fontSize: 16, color: APP_COLOURS.text, margin: 0, lineHeight: 1.5 }}>
              No camera? No problem: type the number printed under the barcode instead.
            </p>
            <p style={{ fontSize: 14, color: APP_COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              {errorMsg || 'Something went wrong starting the camera.'}
            </p>
            {typedEntry}
            <button type="button" onClick={tryAgain} style={primaryBtnStyle}>
              Try again
            </button>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
  readonly length: number;
  readonly isFinal: boolean;
}
interface SpeechRecognitionResultListLike {
  [index: number]: SpeechRecognitionResultLike;
  readonly length: number;
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type VoicePhase = 'unsupported' | 'listening' | 'transcript' | 'analysing' | 'error';

function VoiceLogModal({
  goal,
  onClose,
  onResult,
}: {
  goal: Goal;
  onClose: () => void;
  onResult: (data: AnalyseResponse) => void;
}) {
  const [phase, setPhase] = useState<VoicePhase>('listening');
  const [transcript, setTranscript] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const stoppingRef = useRef<boolean>(false);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setPhase('unsupported');
      return;
    }
    setErrorMsg('');
    setTranscript('');
    finalTranscriptRef.current = '';
    stoppingRef.current = false;
    clearSilenceTimer();
    const rec = new Ctor();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        const alt = r && r[0];
        const piece = alt?.transcript ?? '';
        if (r.isFinal) finalText += piece;
        else interimText += piece;
      }
      finalTranscriptRef.current = finalText.trim();
      // Reset the silence timer on any speech activity (final or interim).
      // Stop after 3.5s of no new results so the user can pause naturally mid-sentence.
      if (finalText || interimText) {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          stoppingRef.current = true;
          try {
            rec.stop();
          } catch {
            // best-effort
          }
        }, 3500);
      }
    };
    rec.onerror = (event) => {
      const code = event.error || '';
      const friendly =
        code === 'no-speech'
          ? "I didn't catch that — try again."
          : code === 'not-allowed' || code === 'service-not-allowed'
            ? 'Microphone permission was blocked. Enable it in your browser settings and try again.'
            : code === 'audio-capture'
              ? 'No microphone detected. Check your device and try again.'
              : `Voice error: ${code || 'unknown'}`;
      clearSilenceTimer();
      setErrorMsg(friendly);
      setPhase('error');
    };
    rec.onend = () => {
      clearSilenceTimer();
      const text = finalTranscriptRef.current.trim();
      if (text) {
        setTranscript(text);
        setPhase('transcript');
        return;
      }
      // No speech captured — only surface if the modal is still actively listening
      // (avoid clobbering an error already set by onerror).
      setPhase((current) => {
        if (current === 'listening') {
          setErrorMsg("I didn't catch that — try again.");
          return 'error';
        }
        return current;
      });
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setPhase('listening');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start the microphone.');
      setPhase('error');
    }
  }

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setPhase('unsupported');
      return;
    }
    startListening();
    return () => {
      clearSilenceTimer();
      const r = recognitionRef.current;
      if (r) {
        try {
          r.stop();
        } catch {
          // best-effort
        }
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmTranscript() {
    if (!transcript) return;
    setPhase('analysing');
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description: transcript, goal, mode: 'voice' }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${res.status})`;
        setErrorMsg(detail);
        setPhase('error');
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        setErrorMsg('Got an empty response from the analyser.');
        setPhase('error');
        return;
      }
      onResult(data as AnalyseResponse);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Analyse failed.');
      setPhase('error');
    }
  }

  function tryAgain() {
    clearSilenceTimer();
    // Stop any in-flight recogniser before re-starting
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        // best-effort
      }
      recognitionRef.current = null;
    }
    startListening();
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: APP_COLOURS.scrim,
    zIndex: 110,
    overflowY: 'auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '2rem 1rem',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 460,
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowFloat,
    borderRadius: 18,
    padding: '1.75rem 1.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: APP_COLOURS.text,
    position: 'relative',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: APP_COLOURS.textMuted,
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 6,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 22,
    lineHeight: 1.1,
    margin: 0,
    letterSpacing: '-0.01em',
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: APP_COLOURS.magenta,
    color: APP_COLOURS.onMagenta,
    border: 'none',
    padding: '14px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    color: APP_COLOURS.magenta,
    border: `1px solid ${APP_COLOURS.magenta}`,
    padding: '12px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Voice log" style={overlayStyle}>
      <div style={cardStyle}>
        <button type="button" onClick={onClose} aria-label="Close voice log" style={closeBtnStyle}>
          ✕
        </button>

        {phase === 'unsupported' && (
          <>
            <h2 style={titleStyle}>Voice logging unavailable</h2>
            <p style={{ fontSize: 16, color: APP_COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              Voice logging works best on Chrome or Safari. Try the photo or gallery options instead.
            </p>
            <button type="button" onClick={onClose} style={primaryBtnStyle}>
              Got it
            </button>
          </>
        )}

        {phase === 'listening' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18,
              padding: '1.5rem 0.5rem 0.5rem',
            }}
          >
            <div
              aria-hidden="true"
              className="voice-pulse"
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: APP_COLOURS.magenta,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: APP_COLOURS.onMagenta,
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              🎙️
            </div>
            <div
              style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 17,
                color: APP_COLOURS.heading,
                textAlign: 'center',
                letterSpacing: '0.02em',
              }}
            >
              Listening… say your meal
            </div>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Cancel
            </button>
          </div>
        )}

        {phase === 'transcript' && (
          <>
            <h2 style={titleStyle}>I heard</h2>
            <div
              style={{
                background: APP_COLOURS.cardRaised,
                border: `1px solid ${APP_COLOURS.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: 16,
                lineHeight: 1.5,
                color: APP_COLOURS.text,
              }}
            >
              {transcript}
            </div>
            <button type="button" onClick={confirmTranscript} style={primaryBtnStyle}>
              Confirm
            </button>
            <button type="button" onClick={tryAgain} style={secondaryBtnStyle}>
              Try again
            </button>
          </>
        )}

        {phase === 'analysing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              padding: '2.5rem 1rem',
            }}
          >
            <div className="spinner" aria-hidden="true" />
            <div style={{ fontSize: 16, color: APP_COLOURS.textMuted }}>Estimating macros…</div>
          </div>
        )}

        {phase === 'error' && (
          <>
            <h2 style={titleStyle}>Hmm</h2>
            <p style={{ fontSize: 16, color: APP_COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              {errorMsg || 'Something went wrong.'}
            </p>
            <button type="button" onClick={tryAgain} style={primaryBtnStyle}>
              Try again
            </button>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function OnboardingOverlay({
  initialGoal,
  onComplete,
  onClose,
  allowClose,
}: {
  initialGoal: Goal;
  onComplete: (goals: UserGoals, chosenGoal: Goal) => void;
  onClose: () => void;
  allowClose: boolean;
}) {
  const [form, setForm] = useState<OnboardingForm>({
    age: '',
    weightValue: '',
    weightUnit: 'kg',
    heightUnit: 'cm',
    heightCm: '',
    heightFt: '',
    heightIn: '',
    sex: null,
    activity: null,
    goal: initialGoal,
  });

  function patch<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const computed = computeGoals(form);
  const canSubmit = computed !== null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!computed || !form.goal) return;
    onComplete(computed, form.goal);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: APP_COLOURS.card,
    color: APP_COLOURS.text,
    border: `1px solid ${APP_COLOURS.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 16,
    outline: 'none',
    appearance: 'textfield',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: APP_COLOURS.scrim,
        zIndex: 100,
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem 1rem',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 480,
          background: APP_COLOURS.card,
          border: `1px solid ${APP_COLOURS.border}`,
          boxShadow: APP_COLOURS.shadowFloat,
          borderRadius: 18,
          padding: '1.75rem 1.5rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          color: APP_COLOURS.text,
          position: 'relative',
        }}
      >
        {allowClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'transparent',
              border: 'none',
              color: APP_COLOURS.textMuted,
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 6,
            }}
          >
            ✕
          </button>
        ) : null}

        <header>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: APP_COLOURS.magenta,
              marginBottom: 6,
            }}
          >
            Welcome to Munch Snapper
          </div>
          <h2
            id="onboarding-title"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 30,
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Set your daily target
          </h2>
          <p
            style={{
              fontSize: 16,
              color: APP_COLOURS.textMuted,
              margin: '6px 0 0',
              lineHeight: 1.5,
            }}
          >
            Quick stats so we can calculate calories and macros for you. Stays on your device.
          </p>
        </header>

        <OnboardField label="Age">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={form.age}
            onChange={(e) => patch('age', e.target.value)}
            placeholder="e.g. 32"
            style={inputStyle}
          />
        </OnboardField>

        <OnboardField label="Weight">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={form.weightValue}
              onChange={(e) => patch('weightValue', e.target.value)}
              placeholder={form.weightUnit === 'kg' ? 'e.g. 68' : 'e.g. 150'}
              style={{ ...inputStyle, flex: 1 }}
            />
            <UnitToggle
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lbs', label: 'lbs' },
              ]}
              value={form.weightUnit}
              onChange={(v) => patch('weightUnit', v as WeightUnit)}
            />
          </div>
        </OnboardField>

        <OnboardField label="Height">
          {form.heightUnit === 'cm' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                value={form.heightCm}
                onChange={(e) => patch('heightCm', e.target.value)}
                placeholder="e.g. 170"
                style={{ ...inputStyle, flex: 1 }}
              />
              <UnitToggle
                options={[
                  { value: 'cm', label: 'cm' },
                  { value: 'ftin', label: 'ft/in' },
                ]}
                value={form.heightUnit}
                onChange={(v) => patch('heightUnit', v as HeightUnit)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={form.heightFt}
                onChange={(e) => patch('heightFt', e.target.value)}
                placeholder="ft"
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.heightIn}
                onChange={(e) => patch('heightIn', e.target.value)}
                placeholder="in"
                style={{ ...inputStyle, flex: 1 }}
              />
              <UnitToggle
                options={[
                  { value: 'cm', label: 'cm' },
                  { value: 'ftin', label: 'ft/in' },
                ]}
                value={form.heightUnit}
                onChange={(v) => patch('heightUnit', v as HeightUnit)}
              />
            </div>
          )}
        </OnboardField>

        <OnboardField label="Sex assigned at birth">
          <PillGroup
            cols={2}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={form.sex}
            onChange={(v) => patch('sex', v as Sex)}
          />
        </OnboardField>

        <OnboardField label="Activity level">
          <PillGroup
            cols={2}
            options={ACTIVITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={form.activity}
            onChange={(v) => patch('activity', v as Activity)}
          />
        </OnboardField>

        <OnboardField label="Goal">
          <PillGroup
            cols={3}
            options={GOALS.map((g) => ({ value: g.value, label: g.label }))}
            value={form.goal}
            onChange={(v) => patch('goal', v as Goal)}
          />
        </OnboardField>

        {computed ? (
          <div
            style={{
              background: APP_COLOURS.magentaSoft,
              border: `1px solid ${APP_COLOURS.magentaTint}`,
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 16,
              color: APP_COLOURS.text,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: APP_COLOURS.magenta,
                marginBottom: 4,
              }}
            >
              Your target
            </div>
            {computed.calories.toLocaleString('en-GB')} kcal · {computed.protein}g protein ·{' '}
            {computed.carbs}g carbs · {computed.fat}g fat
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%',
            background: canSubmit ? APP_COLOURS.magenta : APP_COLOURS.border,
            color: canSubmit ? APP_COLOURS.onMagenta : APP_COLOURS.textMuted,
            border: 'none',
            padding: '16px 24px',
            borderRadius: 999,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          Save my target
        </button>
      </form>
    </div>
  );
}

function OnboardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: APP_COLOURS.textMuted,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: APP_COLOURS.cardRaised,
        border: `1px solid ${APP_COLOURS.border}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              background: active ? APP_COLOURS.magenta : 'transparent',
              color: active ? APP_COLOURS.onMagenta : APP_COLOURS.textMuted,
              border: 'none',
              padding: '8px 12px',
              borderRadius: 8,
              fontFamily: "'Barlow', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              minWidth: 44,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function PillGroup({
  cols,
  options,
  value,
  onChange,
}: {
  cols: number;
  options: Array<{ value: string; label: string }>;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              background: active ? APP_COLOURS.magenta : APP_COLOURS.card,
              color: active ? APP_COLOURS.onMagenta : APP_COLOURS.heading,
              border: `1.5px solid ${active ? APP_COLOURS.magenta : APP_COLOURS.border}`,
              borderRadius: 999,
              padding: '11px 12px',
              fontFamily: "'Barlow', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Inline style objects (things that don't need :hover/keyframes/media queries) ──

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: APP_COLOURS.softBg,
    color: APP_COLOURS.text,
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
    gap: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.5rem 0 1rem',
    borderBottom: `1px solid ${APP_COLOURS.border}`,
  },
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerMark: {
    width: 44,
    height: 44,
    background: APP_COLOURS.magenta,
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
    color: APP_COLOURS.heading,
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  headerSub: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: APP_COLOURS.magenta,
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: APP_COLOURS.magenta,
  },
  pillRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  previewCard: {
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewImg: {
    width: '100%',
    height: 'auto',
    maxHeight: 320,
    objectFit: 'cover',
    display: 'block',
  },
  previewRow: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewName: {
    fontSize: 14,
    color: APP_COLOURS.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  loadingBox: {
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 16,
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 16,
    color: APP_COLOURS.textMuted,
    letterSpacing: '0.02em',
  },
  errorBox: {
    background: APP_COLOURS.dangerSoft,
    border: `1px solid ${APP_COLOURS.dangerBorder}`,
    borderRadius: 14,
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: APP_COLOURS.danger,
  },
  errorMsg: {
    fontSize: 16,
    color: APP_COLOURS.text,
    lineHeight: 1.5,
  },
  resultsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  resultHeader: {
    background: APP_COLOURS.magenta,
    borderRadius: 16,
    padding: '18px 20px',
    color: APP_COLOURS.onMagenta,
  },
  resultDish: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 28,
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  resultPortion: {
    fontSize: 15,
    fontWeight: 500,
    color: APP_COLOURS.onMagenta,
    marginTop: 4,
  },
  macroGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  sectionBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 14,
    padding: '16px 18px',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: APP_COLOURS.magenta,
  },
  foodList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  foodItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: `1px solid ${APP_COLOURS.border}`,
    fontSize: 16,
  },
  foodName: {
    color: APP_COLOURS.text,
  },
  foodCalories: {
    color: APP_COLOURS.textMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  insight: {
    fontSize: 17,
    lineHeight: 1.65,
    color: APP_COLOURS.text,
    fontStyle: 'italic',
    margin: 0,
  },
  subscribeGate: {
    background: APP_COLOURS.card,
    border: `2px solid ${APP_COLOURS.magenta}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 16,
    padding: '22px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
    textAlign: 'center',
  },
  gateTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 24,
    lineHeight: 1.15,
    color: APP_COLOURS.heading,
    letterSpacing: '-0.01em',
  },
  gateSub: {
    fontSize: 16,
    color: APP_COLOURS.textMuted,
    marginBottom: 4,
  },
  freeCounter: {
    fontSize: 14,
    color: APP_COLOURS.textMuted,
    textAlign: 'center',
    letterSpacing: '0.04em',
    paddingTop: 4,
  },
  proBadge: {
    fontSize: 14,
    fontWeight: 600,
    color: APP_COLOURS.magenta,
    textAlign: 'center',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  manageSubLink: {
    alignSelf: 'center',
    background: 'transparent',
    border: 'none',
    padding: '4px 8px',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: APP_COLOURS.magenta,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
  },
};
