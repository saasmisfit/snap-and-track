'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

type Goal = 'fat_loss' | 'maintain' | 'build';
type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

interface PlanMeal {
  slot: MealSlot;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
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
  success: '#4ade80',
  danger: '#fca5a5',
};

const GOAL_TABS: Array<{ value: Goal; label: string }> = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'build', label: 'Build & tone' },
];

const PLANS: Record<Goal, PlanMeal[]> = {
  fat_loss: [
    {
      slot: 'Breakfast',
      name: 'Greek yoghurt, berries & granola',
      description: '170g Greek yoghurt, handful of mixed berries, 25g granola. High-protein start that keeps you full to lunch.',
      calories: 350,
      protein_g: 30,
      carbs_g: 35,
      fat_g: 8,
      fibre_g: 4,
    },
    {
      slot: 'Lunch',
      name: 'Chicken & avocado salad',
      description: '150g grilled chicken, mixed leaves, ½ avocado, cherry tomatoes, olive oil and lemon. Filling without the slump.',
      calories: 450,
      protein_g: 40,
      carbs_g: 20,
      fat_g: 22,
      fibre_g: 8,
    },
    {
      slot: 'Dinner',
      name: 'Grilled salmon with roast veg',
      description: '140g salmon fillet, roasted courgette, peppers, red onion. Omega-3s and colour on the plate.',
      calories: 450,
      protein_g: 38,
      carbs_g: 25,
      fat_g: 20,
      fibre_g: 6,
    },
    {
      slot: 'Snack',
      name: 'Cottage cheese with peach',
      description: '150g low-fat cottage cheese with a sliced peach. Slow-release protein and just enough sweet.',
      calories: 200,
      protein_g: 22,
      carbs_g: 18,
      fat_g: 5,
      fibre_g: 3,
    },
  ],
  maintain: [
    {
      slot: 'Breakfast',
      name: 'Oats with banana & peanut butter',
      description: '60g oats with semi-skimmed milk, sliced banana, tablespoon of peanut butter. Solid energy for a busy morning.',
      calories: 450,
      protein_g: 18,
      carbs_g: 60,
      fat_g: 16,
      fibre_g: 7,
    },
    {
      slot: 'Lunch',
      name: 'Chicken & rice bowl',
      description: '150g grilled chicken, 75g cooked basmati rice, broccoli, sweetcorn, chipotle yoghurt. Balanced and easy to batch.',
      calories: 600,
      protein_g: 45,
      carbs_g: 65,
      fat_g: 18,
      fibre_g: 8,
    },
    {
      slot: 'Dinner',
      name: 'Steak with sweet potato',
      description: '180g sirloin, baked sweet potato, tenderstem broccoli, peppercorn sauce. Proper end-of-day plate.',
      calories: 600,
      protein_g: 50,
      carbs_g: 50,
      fat_g: 22,
      fibre_g: 9,
    },
    {
      slot: 'Snack',
      name: 'Greek yoghurt with mixed nuts',
      description: '170g Greek yoghurt with a small handful of almonds and walnuts. Protein plus healthy fats to bridge the gap.',
      calories: 250,
      protein_g: 22,
      carbs_g: 18,
      fat_g: 12,
      fibre_g: 3,
    },
  ],
  build: [
    {
      slot: 'Breakfast',
      name: 'Three-egg avocado toast',
      description: 'Three eggs scrambled with spinach, two slices of sourdough, ½ avocado. Strong start with quality protein and fats.',
      calories: 550,
      protein_g: 28,
      carbs_g: 35,
      fat_g: 32,
      fibre_g: 8,
    },
    {
      slot: 'Lunch',
      name: 'Chicken pasta with greens',
      description: '180g grilled chicken, 100g cooked penne, tomato sauce, courgette, parmesan. Carbs that earn their keep.',
      calories: 700,
      protein_g: 50,
      carbs_g: 80,
      fat_g: 22,
      fibre_g: 9,
    },
    {
      slot: 'Dinner',
      name: 'Steak with potatoes & broccoli',
      description: '200g sirloin, 250g baby potatoes, tenderstem broccoli, garlic butter. Big plate, big recovery.',
      calories: 700,
      protein_g: 55,
      carbs_g: 60,
      fat_g: 28,
      fibre_g: 10,
    },
    {
      slot: 'Snack',
      name: 'Protein shake & banana',
      description: '30g whey in water (or milk), one banana. Quick post-session top-up.',
      calories: 350,
      protein_g: 30,
      carbs_g: 45,
      fat_g: 6,
      fibre_g: 3,
    },
  ],
};

function fmt(n: number): string {
  return Math.round(n).toString();
}

function planTotals(meals: PlanMeal[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fat_g: acc.fat_g + m.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function MealPlansPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<Goal>('fat_loss');
  const [loggingKey, setLoggingKey] = useState<string | null>(null);
  const [loggedKeys, setLoggedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const meals = PLANS[tab];
  const totals = planTotals(meals);

  async function logMeal(meal: PlanMeal, key: string) {
    if (!user?.id || loggingKey) return;
    if (loggedKeys.has(key)) return;
    setLoggingKey(key);
    setError(null);
    const now = new Date();
    const todayStr = todayISO();
    const logTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          logDate: todayStr,
          logTime,
          mealName: meal.name,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein_g,
          carbs: meal.carbs_g,
          fat: meal.fat_g,
          fibre: meal.fibre_g,
          ingredients: [{ name: meal.name, calories: meal.calories }],
          coachingNote: `Logged from Stacy's ${GOAL_TABS.find((g) => g.value === tab)?.label.toLowerCase() ?? tab} meal plan.`,
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const detail =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : `Save failed (${res.status})`;
        throw new Error(detail);
      }
      setLoggedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log that meal — please try again.');
    } finally {
      setLoggingKey(null);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerMark} aria-hidden="true">
            📋
          </div>
          <div style={styles.headerTitleGroup}>
            <div style={styles.headerTitle}>Meal Plans</div>
            <div style={styles.headerSub}>by Stacy Kundu</div>
          </div>
          <Link href="/app" className="header-link" style={{ color: '#ffffff', textDecoration: 'none' }}>
            ＋ Snap a meal
          </Link>
        </header>

        <div style={styles.bannerCard}>
          <span style={styles.bannerIcon} aria-hidden="true">
            ✨
          </span>
          <p style={styles.bannerText}>
            These are the kinds of days I&apos;d actually build for you — simple, filling, and built around your goal. Use them as a guide or log them straight to your day.
          </p>
        </div>

        <div role="tablist" aria-label="Meal plan goal" style={styles.tabRow}>
          {GOAL_TABS.map((g) => {
            const active = g.value === tab;
            return (
              <button
                key={g.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(g.value)}
                style={{
                  flex: 1,
                  background: active ? COLOURS.magenta : 'transparent',
                  color: active ? COLOURS.white : 'rgba(255,255,255,0.85)',
                  border: `1.5px solid ${active ? COLOURS.magenta : COLOURS.border}`,
                  borderRadius: 999,
                  padding: '10px 14px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        <div style={styles.totalsRow}>
          <span style={styles.totalsLabel}>Day total</span>
          <span style={styles.totalsValues}>
            {totals.calories.toLocaleString('en-GB')} kcal &nbsp;·&nbsp; {fmt(totals.protein_g)}g protein
            &nbsp;·&nbsp; {fmt(totals.carbs_g)}g carbs &nbsp;·&nbsp; {fmt(totals.fat_g)}g fat
          </span>
        </div>

        {error && (
          <div role="alert" style={styles.errorBox}>
            {error}
          </div>
        )}

        <div style={styles.mealList}>
          {meals.map((m, i) => {
            const key = `${tab}:${i}`;
            const isLogged = loggedKeys.has(key);
            const isLogging = loggingKey === key;
            return (
              <article key={key} style={styles.mealCard}>
                <div style={styles.mealTopRow}>
                  <span style={styles.mealSlot}>{m.slot}</span>
                  <span style={styles.mealCalories}>{m.calories} kcal</span>
                </div>
                <div style={styles.mealName}>{m.name}</div>
                <p style={styles.mealDesc}>{m.description}</p>
                <div style={styles.macroPills}>
                  <MacroPill value={`${fmt(m.protein_g)}g`} unit="protein" />
                  <MacroPill value={`${fmt(m.carbs_g)}g`} unit="carbs" />
                  <MacroPill value={`${fmt(m.fat_g)}g`} unit="fat" />
                </div>
                <button
                  type="button"
                  onClick={() => logMeal(m, key)}
                  disabled={isLogging || isLogged || !user?.id}
                  style={{
                    width: '100%',
                    background: isLogged
                      ? 'rgba(74, 222, 128, 0.08)'
                      : isLogging
                        ? COLOURS.magentaDark
                        : COLOURS.magenta,
                    color: isLogged ? COLOURS.success : COLOURS.white,
                    border: isLogged ? `1.5px solid ${COLOURS.success}` : 'none',
                    padding: '12px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: isLogged || isLogging || !user?.id ? 'default' : 'pointer',
                    marginTop: 6,
                  }}
                >
                  {isLogged ? '✓ Logged' : isLogging ? 'Logging…' : '＋ Log this meal'}
                </button>
              </article>
            );
          })}
        </div>

        <Link href="/app/log" className="footer-link" style={{ color: COLOURS.textMuted, textDecoration: 'none' }}>
          View your log →
        </Link>
      </div>

      <style jsx>{`
        :global(body) {
          background: ${COLOURS.nearBlack};
        }

        .header-link {
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
        .header-link:hover {
          background: ${COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        .footer-link {
          align-self: center;
          font-size: 13px;
          font-weight: 500;
          padding: 0.5rem 0 0;
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: ${COLOURS.white} !important;
        }
      `}</style>
    </main>
  );
}

function MacroPill({ value, unit }: { value: string; unit: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        background: COLOURS.cardRaised,
        border: `1px solid ${COLOURS.border}`,
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
          color: COLOURS.white,
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
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
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
  bannerCard: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.magentaTint}`,
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  bannerIcon: {
    fontSize: 20,
    lineHeight: 1.1,
    flexShrink: 0,
  },
  bannerText: {
    margin: 0,
    fontFamily: "'Barlow', sans-serif",
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 1.55,
    color: COLOURS.magenta,
  },
  tabRow: {
    display: 'flex',
    gap: 8,
  },
  totalsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    paddingLeft: 2,
  },
  totalsLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: COLOURS.magenta,
  },
  totalsValues: {
    fontSize: 13,
    color: COLOURS.textLight,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
  },
  errorBox: {
    background: 'rgba(220,38,38,0.10)',
    border: '1px solid rgba(220,38,38,0.45)',
    borderRadius: 12,
    padding: '12px 16px',
    color: COLOURS.danger,
    fontSize: 13,
    lineHeight: 1.5,
  },
  mealList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  mealCard: {
    background: COLOURS.card,
    border: `1px solid ${COLOURS.border}`,
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  mealTopRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealSlot: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: COLOURS.magenta,
  },
  mealCalories: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 18,
    color: COLOURS.white,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },
  mealName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 20,
    lineHeight: 1.15,
    color: COLOURS.white,
    letterSpacing: '-0.01em',
  },
  mealDesc: {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.55,
    color: 'rgba(255,255,255,0.78)',
  },
  macroPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
};
