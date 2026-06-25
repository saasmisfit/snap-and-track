'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';

const userButtonAppearance = {
  variables: {
    colorPrimary: '#B0185E',
    colorBackground: '#1a1a1e',
    colorText: '#ffffff',
    colorTextSecondary: '#888888',
  },
  elements: {
    userButtonAvatarBox: { width: 32, height: 32 },
    userButtonPopoverCard: {
      background: '#1a1a1e',
      border: '1px solid #2a2a30',
    },
    userButtonPopoverActionButton: { color: '#ffffff' },
  },
};

const FREE_SNAP_LIMIT = 3;
const FREE_SNAP_KEY = 'snaptrack_free_count';
const NET_CARBS_KEY = 'munchsnapper_netcarbs';
const ONBOARDING_KEY = 'munchsnapper_onboarding_complete';
const GOALS_KEY = 'munchsnapper_goals';
const ACTIVE_GOAL_KEY = 'munchsnapper_active_goal';
const BURNED_KEY_PREFIX = 'munchsnapper_burned_today_';
const STREAK_KEY = 'munchsnapper_streak';
const NOTIF_ASKED_KEY = 'munchsnapper_notif_asked';
const DAILY_SCHEDULED_PREFIX = 'munchsnapper_daily_reminders_scheduled_';
const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30];
const DAILY_REMINDERS: ReadonlyArray<{ hour: number; minute: number; message: string }> = [
  { hour: 8, minute: 0, message: "🍳 Good morning! Don't forget to log your breakfast." },
  { hour: 13, minute: 0, message: '🥗 Lunchtime! Snap your meal and stay on track.' },
  { hour: 19, minute: 0, message: '🍽️ Log your dinner to keep your streak alive.' },
];

interface Streak {
  currentStreak: number;
  lastLogDate: string;
  longestStreak: number;
}

const EMPTY_STREAK: Streak = { currentStreak: 0, lastLogDate: '', longestStreak: 0 };

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
}

const GOALS: Array<{ value: Goal; label: string }> = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'build', label: 'Build & tone' },
];

const LOADING_MESSAGES = [
  'Spotting the ingredients…',
  'Estimating portion sizes…',
  'Calculating your macros…',
  'Almost there…',
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const COLOURS = {
  magenta: '#B0185E',
  magentaDark: '#8a1249',
  magentaSoft: 'rgba(176,24,94,0.12)',
  magentaTint: 'rgba(176,24,94,0.25)',
  nearBlack: '#0E0E10',
  card: '#1a1a1e',
  border: '#2a2a30',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.35)',
  errorBg: 'rgba(220,38,38,0.10)',
  errorBorder: 'rgba(220,38,38,0.45)',
  errorText: '#fca5a5',
};

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
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showVoiceLog, setShowVoiceLog] = useState(false);
  const [mode, setMode] = useState<AnalyseMode>('meal');
  const [burnedToday, setBurnedToday] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

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

  // Auto-clear "Logged!" confirmation after 2 seconds
  useEffect(() => {
    if (!justLogged) return;
    const id = window.setTimeout(() => setJustLogged(false), 2000);
    return () => window.clearTimeout(id);
  }, [justLogged]);

  // Load free-snap count from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FREE_SNAP_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      setSnapCount(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
    } catch {
      setSnapCount(0);
    }
  }, []);

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

  // Persist the active goal so other pages (log/coach) can read it
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_GOAL_KEY, goal);
    } catch {
      // best-effort
    }
  }, [goal]);

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

  function handleBarcodeResult(data: AnalyseResponse) {
    setShowBarcodeScanner(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setEditingTile(null);
    setLoggedEntryId(null);
    setMode('meal');
    setResult(data);
    setSnapCount((prev) => {
      const next = (prev ?? 0) + 1;
      try {
        window.localStorage.setItem(FREE_SNAP_KEY, String(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  function handleVoiceResult(data: AnalyseResponse) {
    setShowVoiceLog(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setEditingTile(null);
    setLoggedEntryId(null);
    setMode('meal');
    setResult(data);
    setSnapCount((prev) => {
      const next = (prev ?? 0) + 1;
      try {
        window.localStorage.setItem(FREE_SNAP_KEY, String(next));
      } catch {
        // best-effort
      }
      return next;
    });
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

  function acceptFile(f: File) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('That file type isn’t supported. Please use JPG, PNG, or WebP.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    acceptFile(f);
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
    acceptFile(f);
  }

  function reset(keepGoal = true) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setIsAnalysing(false);
    setEditingTile(null);
    setLoggedEntryId(null);
    setMode('meal');
    if (!keepGoal) setGoal('fat_loss');
  }

  async function analyse() {
    if (!file) return;
    // Hard gate — if free quota is used up and the user isn't subscribed, do not call the API
    if (!isSubscribed && snapCount !== null && snapCount >= FREE_SNAP_LIMIT) return;
    setIsAnalysing(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type, goal, mode }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${res.status})`;
        throw new Error(detail);
      }
      setResult(data as AnalyseResponse);
      setSnapCount((prev) => {
        const next = (prev ?? 0) + 1;
        try {
          window.localStorage.setItem(FREE_SNAP_KEY, String(next));
        } catch {
          // best-effort
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong analysing that meal.');
    } finally {
      setIsAnalysing(false);
    }
  }

  async function logMeal() {
    if (!result || justLogged || !user?.id) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const logTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          logDate: todayStr,
          logTime,
          mealName: result.dish,
          description: result.portion_estimate,
          calories: result.calories,
          protein: result.protein_g,
          carbs: result.carbs_g,
          fat: result.fat_g,
          fibre: result.fibre_g,
          ingredients: result.foods_identified,
          coachingNote: result.stacy_insight,
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Save failed (${res.status})`;
        setError(detail);
        return;
      }
      const data: unknown = await res.json().catch(() => ({}));
      const entry =
        data && typeof data === 'object' && 'entry' in data
          ? (data as { entry: unknown }).entry
          : null;
      if (entry && typeof entry === 'object' && 'id' in entry) {
        const id = (entry as { id: unknown }).id;
        if (typeof id === 'number') setLoggedEntryId(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your meal.');
      return;
    }
    setJustLogged(true);

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
      const entries = await fetchLogEntries(user.id);
      setRecentMeals(buildRecentMealsFromEntries(entries));
      setLogEntryCount(entries.length);
    } catch {
      // best-effort
    }
  }

  async function relogMeal(template: SavedLogEntry) {
    if (!user?.id) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const logTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setShowRelogToast(true);
    try {
      await fetch('/api/log', {
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
    } catch {
      // best-effort
    }

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
              style={{ width: 'auto', height: 44, display: 'block' }}
            />
          </Link>
          <Link href="/app/plans" className="view-log-link" style={{ color: '#ffffff' }}>
            Meal plans →
          </Link>
          <Link href="/app/log" className="view-log-link" style={{ color: '#ffffff' }}>
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
              fontSize: 12,
              color: COLOURS.textMuted,
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
                  color: COLOURS.magenta,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 12,
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
                  fontSize: 12,
                  color: COLOURS.textMuted,
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
                  background: COLOURS.nearBlack,
                  color: COLOURS.white,
                  border: `1px solid ${COLOURS.border}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 13,
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
                  fontSize: 12,
                  color: COLOURS.magenta,
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
                    flex: '0 0 140px',
                    background: COLOURS.card,
                    border: `1px solid ${COLOURS.border}`,
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
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLOURS.white,
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
                      color: COLOURS.magenta,
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
                        fontSize: 11,
                        fontWeight: 500,
                        color: COLOURS.textFaint,
                        letterSpacing: '0.04em',
                      }}
                    >
                      kcal
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => relogMeal(m.template)}
                    aria-label={`Log ${m.dish} again`}
                    style={{
                      marginTop: 'auto',
                      background: 'transparent',
                      color: COLOURS.white,
                      border: `1px solid ${COLOURS.white}`,
                      borderRadius: 999,
                      padding: '6px 10px',
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ＋ Log again
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
              accept="image/jpeg,image/jpg,image/png,image/webp"
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
                  <div className="upload-sub">JPG, PNG, or WebP</div>
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
                    background: COLOURS.card,
                    color: COLOURS.white,
                    border: `1.5px solid ${COLOURS.border}`,
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
                    background: COLOURS.card,
                    color: COLOURS.white,
                    border: `1.5px solid ${COLOURS.border}`,
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
                    background: COLOURS.card,
                    color: COLOURS.white,
                    border: `1.5px solid ${COLOURS.border}`,
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
                    background: COLOURS.card,
                    color: COLOURS.white,
                    border: `1.5px solid ${COLOURS.border}`,
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
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: COLOURS.magenta,
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
                    background: COLOURS.magenta,
                    color: COLOURS.white,
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
                  <div style={styles.proBadge}>✦ Pro · unlimited snaps</div>
                ) : snapCount === 1 || snapCount === 2 ? (
                  <div style={styles.freeCounter}>
                    {snapCount} of {FREE_SNAP_LIMIT} free snaps used
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
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: netCarbs ? COLOURS.magenta : COLOURS.textMuted,
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
                    background: netCarbs ? COLOURS.magenta : COLOURS.border,
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
                      background: COLOURS.white,
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  />
                </span>
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: COLOURS.textFaint,
                textAlign: 'center',
                letterSpacing: '0.04em',
                marginTop: -4,
              }}
            >
              Tap to edit
            </div>

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

            <button
              type="button"
              onClick={logMeal}
              disabled={justLogged}
              className={`log-btn${justLogged ? ' logged' : ''}`}
            >
              {justLogged ? '✓ Logged!' : '✓ Log this meal'}
            </button>

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
          background: ${COLOURS.nearBlack};
        }

        .goal-pill {
          flex: 1;
          background: transparent;
          color: rgba(255, 255, 255, 0.85);
          border: 1.5px solid ${COLOURS.border};
          border-radius: 999px;
          padding: 11px 16px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.1s;
        }
        .goal-pill:hover {
          border-color: ${COLOURS.magenta};
          color: ${COLOURS.white};
        }
        .goal-pill.active {
          background: ${COLOURS.magenta};
          border-color: ${COLOURS.magenta};
          color: ${COLOURS.white};
        }
        .goal-pill.active:hover {
          background: ${COLOURS.magentaDark};
          border-color: ${COLOURS.magentaDark};
        }

        .upload-zone {
          width: 100%;
          background: ${COLOURS.card};
          border: 2px dashed ${COLOURS.border};
          border-radius: 18px;
          padding: 3rem 1.5rem;
          color: ${COLOURS.white};
          font-family: var(--body-font), 'Barlow', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.1s;
        }
        .upload-zone:hover {
          border-color: ${COLOURS.magenta};
          background: #1d1d22;
          transform: translateY(-1px);
        }
        .upload-zone.dragging {
          border-color: ${COLOURS.magenta};
          border-style: solid;
          background: ${COLOURS.magentaSoft};
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
          font-size: 12px;
          color: ${COLOURS.textFaint};
          letter-spacing: 0.04em;
        }

        .camera-btn {
          width: 100%;
          background: transparent;
          color: ${COLOURS.magenta};
          border: 2px solid ${COLOURS.magenta};
          padding: 16px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, transform 0.1s;
        }
        .camera-btn:hover {
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
          transform: translateY(-1px);
        }

        .change-photo {
          background: transparent;
          border: none;
          color: ${COLOURS.magenta};
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          padding: 0;
        }
        .change-photo:hover {
          color: ${COLOURS.white};
        }

        .analyse-btn {
          width: 100%;
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
          border: none;
          padding: 16px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }
        .analyse-btn:hover {
          background: ${COLOURS.magentaDark};
          transform: translateY(-1px);
        }
        .analyse-btn.disabled,
        .analyse-btn:disabled {
          background: #2a2a30;
          color: rgba(255, 255, 255, 0.35);
          cursor: not-allowed;
          transform: none;
        }

        .log-btn {
          width: 100%;
          background: transparent;
          color: ${COLOURS.magenta};
          border: 2px solid ${COLOURS.magenta};
          padding: 14px 24px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          margin-top: 0.5rem;
        }
        .log-btn:hover {
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
        }
        .log-btn.logged,
        .log-btn.logged:hover {
          color: #4ade80;
          border-color: #4ade80;
          background: rgba(74, 222, 128, 0.08);
          cursor: default;
          transform: none;
        }

        .view-log-link {
          font-size: 12px;
          font-weight: 600;
          color: ${COLOURS.white};
          text-decoration: none;
          letter-spacing: 0.02em;
          white-space: nowrap;
          transition: color 0.2s;
        }
        .view-log-link:hover {
          color: ${COLOURS.magenta};
        }

        .reset-link {
          background: transparent;
          border: none;
          color: ${COLOURS.textMuted};
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 0.5rem;
          margin-top: 0.25rem;
          align-self: center;
          transition: color 0.2s;
        }
        .reset-link:hover {
          color: ${COLOURS.white};
        }

        .spinner {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid ${COLOURS.border};
          border-top-color: ${COLOURS.magenta};
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
          background: ${COLOURS.magenta};
          color: ${COLOURS.white};
          text-align: center;
          padding: 14px 24px;
          border-radius: 999px;
          text-decoration: none;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: background 0.2s, transform 0.1s;
          margin-top: 0.5rem;
        }
        .subscribe-cta:hover {
          background: ${COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .recent-scroll::-webkit-scrollbar {
          display: none;
        }

        .voice-pulse {
          box-shadow: 0 0 0 0 rgba(176, 24, 94, 0.55);
          animation: voicePulse 1.4s ease-out infinite;
        }
        @keyframes voicePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(176, 24, 94, 0.55);
          }
          70% {
            box-shadow: 0 0 0 18px rgba(176, 24, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(176, 24, 94, 0);
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
          goal={goal}
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
            background: COLOURS.card,
            border: `1px solid ${COLOURS.magentaTint}`,
            borderRadius: 999,
            padding: '10px 22px',
            color: COLOURS.magenta,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
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

  const valueColour = accent ? COLOURS.magenta : COLOURS.white;

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
        background: COLOURS.card,
        border: `1px solid ${COLOURS.border}`,
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
          fontSize: 11,
          color: COLOURS.textFaint,
          lineHeight: 1,
          pointerEvents: 'none',
          opacity: 0.7,
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
      <div style={{ fontSize: 11, color: COLOURS.textFaint, marginTop: 4 }}>{unit}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
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

function BarcodeScannerModal({
  goal,
  onClose,
  onResult,
}: {
  goal: Goal;
  onClose: () => void;
  onResult: (data: AnalyseResponse) => void;
}) {
  const [phase, setPhase] = useState<ScannerPhase>('scanning');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [per100g, setPer100g] = useState<OffPer100g | null>(null);
  const [servingGrams, setServingGrams] = useState<string>('100');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
            const text = decoded.getText();
            setPhase('looking-up');
            void lookupBarcode(text);
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
    }
  }

  function tryAgain() {
    setErrorMsg('');
    setProductName('');
    setPer100g(null);
    setServingGrams('100');
    setPhase('scanning');
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

  async function confirmServing() {
    if (!per100g || !preview || isFinalizing) return;
    setIsFinalizing(true);
    const description = `${productName} — ${servingValue}g serving. Known macros: ${preview.calories} kcal, ${preview.protein}g protein, ${preview.carbs}g carbs, ${preview.fat}g fat, ${preview.fibre}g fibre. Treat these macros as ground truth.`;

    let coaching = '';
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description, goal }),
      });
      if (res.ok) {
        const data: unknown = await res.json().catch(() => null);
        if (
          data &&
          typeof data === 'object' &&
          typeof (data as { stacy_insight?: unknown }).stacy_insight === 'string'
        ) {
          coaching = (data as { stacy_insight: string }).stacy_insight;
        }
      }
    } catch {
      // best-effort — fall back to a generic note
    }

    setIsFinalizing(false);
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
      stacy_insight:
        coaching ||
        'Logged from a barcode scan. Adjust the serving size if it does not match what you ate.',
    });
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(14,14,16,0.96)',
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
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 18,
    padding: '1.75rem 1.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: COLOURS.white,
    position: 'relative',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: COLOURS.textMuted,
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
    background: COLOURS.magenta,
    color: COLOURS.white,
    border: 'none',
    padding: '14px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    color: COLOURS.textMuted,
    border: `1px solid ${COLOURS.border}`,
    padding: '12px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

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
                background: '#000',
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
            <p style={{ fontSize: 13, color: COLOURS.textMuted, margin: 0, textAlign: 'center' }}>
              Point your camera at a product barcode
            </p>
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
            <div style={{ fontSize: 14, color: COLOURS.textMuted }}>Looking up product…</div>
          </div>
        )}

        {phase === 'serving' && per100g && (
          <>
            <h2 style={titleStyle}>{productName}</h2>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: COLOURS.textMuted,
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
                  background: COLOURS.nearBlack,
                  color: COLOURS.white,
                  border: `1px solid ${COLOURS.border}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 16,
                  outline: 'none',
                  appearance: 'textfield',
                }}
              />
              <span style={{ color: COLOURS.white, fontSize: 14 }}>g</span>
            </div>
            {preview && (
              <div
                style={{
                  background: COLOURS.magentaSoft,
                  border: `1px solid ${COLOURS.magentaTint}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 13,
                  color: COLOURS.white,
                  lineHeight: 1.5,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: COLOURS.magenta,
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
              disabled={!servingValid || isFinalizing}
              style={{
                ...primaryBtnStyle,
                opacity: !servingValid || isFinalizing ? 0.6 : 1,
                cursor: !servingValid || isFinalizing ? 'not-allowed' : 'pointer',
              }}
            >
              {isFinalizing ? 'Generating coaching note…' : 'Confirm'}
            </button>
          </>
        )}

        {phase === 'not-found' && (
          <>
            <h2 style={titleStyle}>Hmm, no match</h2>
            <p style={{ fontSize: 14, color: COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              Product not found. Try scanning again or snap a photo instead.
            </p>
            <button type="button" onClick={tryAgain} style={primaryBtnStyle}>
              Try again
            </button>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Close
            </button>
          </>
        )}

        {phase === 'error' && (
          <>
            <h2 style={titleStyle}>Camera trouble</h2>
            <p style={{ fontSize: 14, color: COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
              {errorMsg || 'Something went wrong starting the camera.'}
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

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  [index: number]: SpeechRecognitionAlternativeLike;
  readonly length: number;
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

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setPhase('unsupported');
      return;
    }
    setErrorMsg('');
    setTranscript('');
    const rec = new Ctor();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const first = event.results[0];
      const alt = first && first[0];
      const text = (alt?.transcript ?? '').trim();
      if (!text) {
        setErrorMsg("I didn't catch that — try again.");
        setPhase('error');
        return;
      }
      setTranscript(text);
      setPhase('transcript');
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
      setErrorMsg(friendly);
      setPhase('error');
    };
    rec.onend = () => {
      // If we ended without a result and we're still in listening, surface a soft error
      // (most browsers fire onresult before onend on success; handled there)
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
    background: 'rgba(14,14,16,0.96)',
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
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 18,
    padding: '1.75rem 1.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: COLOURS.white,
    position: 'relative',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: COLOURS.textMuted,
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
    background: COLOURS.magenta,
    color: COLOURS.white,
    border: 'none',
    padding: '14px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    color: COLOURS.textMuted,
    border: `1px solid ${COLOURS.border}`,
    padding: '12px 24px',
    borderRadius: 999,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 13,
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
            <p style={{ fontSize: 14, color: COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
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
                background: COLOURS.magenta,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLOURS.white,
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              🎙️
            </div>
            <div
              style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 15,
                color: COLOURS.white,
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
                background: COLOURS.nearBlack,
                border: `1px solid ${COLOURS.border}`,
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: 15,
                lineHeight: 1.5,
                color: COLOURS.white,
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
            <div style={{ fontSize: 14, color: COLOURS.textMuted }}>Estimating macros…</div>
          </div>
        )}

        {phase === 'error' && (
          <>
            <h2 style={titleStyle}>Hmm</h2>
            <p style={{ fontSize: 14, color: COLOURS.textMuted, margin: 0, lineHeight: 1.5 }}>
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
    background: COLOURS.nearBlack,
    color: COLOURS.white,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
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
        background: 'rgba(14,14,16,0.96)',
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
          background: COLOURS.card,
          border: `1px solid ${COLOURS.border}`,
          borderRadius: 18,
          padding: '1.75rem 1.5rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          color: COLOURS.white,
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
              color: COLOURS.textMuted,
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
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: COLOURS.magenta,
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
              fontSize: 26,
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Set your daily target
          </h2>
          <p
            style={{
              fontSize: 13,
              color: COLOURS.textMuted,
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
              background: COLOURS.magentaSoft,
              border: `1px solid ${COLOURS.magentaTint}`,
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              color: COLOURS.white,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: COLOURS.magenta,
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
            background: canSubmit ? COLOURS.magenta : '#2a2a30',
            color: canSubmit ? COLOURS.white : 'rgba(255,255,255,0.4)',
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
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: COLOURS.textMuted,
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
        background: COLOURS.nearBlack,
        border: `1px solid ${COLOURS.border}`,
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
              background: active ? COLOURS.magenta : 'transparent',
              color: active ? COLOURS.white : 'rgba(255,255,255,0.85)',
              border: `1.5px solid ${active ? COLOURS.magenta : COLOURS.border}`,
              borderRadius: 999,
              padding: '11px 12px',
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12,
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
    gap: '1.5rem',
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
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLOURS.magenta,
  },
  pillRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  previewCard: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
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
    fontSize: 13,
    color: COLOURS.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  loadingBox: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 16,
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: COLOURS.textMuted,
    letterSpacing: '0.02em',
  },
  errorBox: {
    background: COLOURS.errorBg,
    border: `1px solid ${COLOURS.errorBorder}`,
    borderRadius: 14,
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: COLOURS.errorText,
  },
  errorMsg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  resultsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  resultHeader: {
    background: COLOURS.magenta,
    borderRadius: 16,
    padding: '18px 20px',
    color: COLOURS.white,
  },
  resultDish: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 26,
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  resultPortion: {
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
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
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 14,
    padding: '16px 18px',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLOURS.magenta,
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
    borderBottom: `1px solid ${COLOURS.border}`,
    fontSize: 14,
  },
  foodName: {
    color: 'rgba(255,255,255,0.85)',
  },
  foodCalories: {
    color: COLOURS.textMuted,
    fontVariantNumeric: 'tabular-nums',
  },
  insight: {
    fontSize: 14.5,
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    margin: 0,
  },
  subscribeGate: {
    background: COLOURS.card,
    border: `2px solid ${COLOURS.magenta}`,
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
    color: COLOURS.white,
    letterSpacing: '-0.01em',
  },
  gateSub: {
    fontSize: 14,
    color: COLOURS.textMuted,
    marginBottom: 4,
  },
  freeCounter: {
    fontSize: 12,
    color: COLOURS.textFaint,
    textAlign: 'center',
    letterSpacing: '0.04em',
    paddingTop: 4,
  },
  proBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOURS.magenta,
    textAlign: 'center',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    paddingTop: 4,
  },
};
