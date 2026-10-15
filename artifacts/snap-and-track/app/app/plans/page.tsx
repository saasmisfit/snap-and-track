'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { MacroPill } from '../../components/MacroPill';
import { APP_COLOURS } from '../../lib/app-colours';

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

const GOAL_TABS: Array<{ value: Goal; label: string }> = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'build', label: 'Build & tone' },
];

const ACTIVE_GOAL_KEY = 'munchsnapper_active_goal';

function isGoal(v: unknown): v is Goal {
  return GOAL_TABS.some((g) => g.value === v);
}

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

  // Start on the goal chosen on /app. Read after mount to avoid a hydration mismatch; never written here.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTIVE_GOAL_KEY);
      if (isGoal(stored)) setTab(stored);
    } catch {
      // best-effort
    }
  }, []);

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
          <Link href="/app" className="header-link" style={{ color: APP_COLOURS.onMagenta, textDecoration: 'none' }}>
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
                  background: active ? APP_COLOURS.magenta : APP_COLOURS.card,
                  color: active ? APP_COLOURS.onMagenta : APP_COLOURS.heading,
                  border: `1.5px solid ${active ? APP_COLOURS.magenta : APP_COLOURS.border}`,
                  borderRadius: 999,
                  padding: '12px 14px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 14,
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
                  <MacroPill value={`${fmt(m.protein_g)}g`} unit="protein" size="large" />
                  <MacroPill value={`${fmt(m.carbs_g)}g`} unit="carbs" size="large" />
                  <MacroPill value={`${fmt(m.fat_g)}g`} unit="fat" size="large" />
                </div>
                <button
                  type="button"
                  onClick={() => logMeal(m, key)}
                  disabled={isLogging || isLogged || !user?.id}
                  style={{
                    width: '100%',
                    background: isLogged
                      ? APP_COLOURS.successSoft
                      : isLogging
                        ? APP_COLOURS.magentaDark
                        : APP_COLOURS.magenta,
                    color: isLogged ? APP_COLOURS.success : APP_COLOURS.onMagenta,
                    border: isLogged ? `1.5px solid ${APP_COLOURS.success}` : 'none',
                    padding: '14px 24px',
                    borderRadius: 999,
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 15,
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

        <Link href="/app/log" className="footer-link" style={{ color: APP_COLOURS.textMuted, textDecoration: 'none' }}>
          View your log →
        </Link>
      </div>

      <style jsx>{`
        :global(body) {
          background: ${APP_COLOURS.softBg};
        }

        /* :global — styled-jsx does not tag <Link>, so a scoped rule would never match */
        :global(.header-link) {
          background: ${APP_COLOURS.magenta};
          color: ${APP_COLOURS.onMagenta};
          padding: 10px 18px;
          border-radius: 999px;
          font-family: var(--body-font), 'Barlow', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.2s, transform 0.1s;
        }
        :global(.header-link:hover) {
          background: ${APP_COLOURS.magentaDark};
          transform: translateY(-1px);
        }

        :global(.footer-link) {
          align-self: center;
          font-size: 15px;
          font-weight: 500;
          padding: 0.5rem 0 0;
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }
        :global(.footer-link:hover) {
          color: ${APP_COLOURS.magenta} !important;
        }
        :global(.header-link:focus-visible),
        :global(.footer-link:focus-visible) {
          outline: 3px solid ${APP_COLOURS.magentaTint};
          outline-offset: 2px;
        }
      `}</style>
    </main>
  );
}


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
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0.5rem 0 1rem',
    borderBottom: `1px solid ${APP_COLOURS.border}`,
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
  headerTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 28,
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
  bannerCard: {
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.magentaTint}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 16,
    padding: '18px 20px',
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
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 1.55,
    color: APP_COLOURS.magenta,
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
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: APP_COLOURS.magenta,
  },
  totalsValues: {
    fontSize: 16,
    fontWeight: 500,
    color: APP_COLOURS.text,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
  },
  errorBox: {
    background: APP_COLOURS.dangerSoft,
    border: `1px solid ${APP_COLOURS.dangerBorder}`,
    borderRadius: 12,
    padding: '14px 16px',
    color: APP_COLOURS.danger,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  mealList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  mealCard: {
    background: APP_COLOURS.card,
    border: `1px solid ${APP_COLOURS.border}`,
    boxShadow: APP_COLOURS.shadowCard,
    borderRadius: 16,
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  mealTopRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealSlot: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: APP_COLOURS.magenta,
  },
  mealCalories: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 21,
    color: APP_COLOURS.heading,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },
  mealName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 800,
    fontSize: 25,
    lineHeight: 1.15,
    color: APP_COLOURS.heading,
    letterSpacing: '-0.01em',
  },
  mealDesc: {
    margin: 0,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.55,
    color: APP_COLOURS.text,
  },
  macroPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
};
