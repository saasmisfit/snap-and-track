'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import {
  Bot,
  Camera,
  ChartColumn,
  Check,
  ChevronDown,
  ClipboardList,
  Flame,
  MessageCircleHeart,
  Mic,
  Minus,
  ScanBarcode,
  Timer,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

const HERO_CHIPS: { label: string; icon: LucideIcon }[] = [
  { label: 'Photo snap', icon: Camera },
  { label: 'Voice log', icon: Mic },
  { label: 'Macro tracking', icon: ChartColumn },
  { label: 'Streak coaching', icon: Flame },
  { label: 'AI Coach', icon: Bot },
];

interface FeatureItem {
  name: string;
  desc: string;
}

interface FeatureCluster {
  title: string;
  items: FeatureItem[];
}

const FEATURE_CLUSTERS: FeatureCluster[] = [
  {
    title: 'Log your meals in seconds',
    items: [
      { name: 'Photo snap', desc: 'Point your camera at any meal and get instant calories and macros powered by Claude AI.' },
      { name: 'Gallery upload', desc: 'Already eaten? Upload from your camera roll and log it after the fact.' },
      { name: 'Barcode scanner', desc: 'Scan any packaged food and pull nutrition data from the Open Food Facts database.' },
      { name: 'Voice logging', desc: 'Just say what you ate. The app transcribes and estimates your macros automatically.' },
      { name: 'Restaurant menu scanner', desc: 'Photograph a menu and Stacy recommends the best dish for your goal.' },
      { name: 'Quick re-log', desc: 'See your recent meals and log them again in one tap — no scanning needed.' },
    ],
  },
  {
    title: 'Track what actually matters',
    items: [
      { name: 'Daily calorie target', desc: 'Set your personalised calorie and macro targets using the Mifflin-St Jeor calculator on first open.' },
      { name: 'Net carbs mode', desc: 'Toggle net carbs on for keto tracking. Fibre is tracked and subtracted automatically.' },
      { name: 'Water tracker', desc: 'Log your glasses and get reminders every two hours while the app is open.' },
      { name: 'Weight trend graph', desc: 'Log your weight daily and watch your 30-day trend line in a clean SVG graph.' },
      { name: 'Calories burned', desc: 'Enter calories burned from your watch or tracker and see your adjusted daily budget.' },
      { name: '7-day rolling history', desc: 'Your meal log keeps a full seven days of history, grouped by date, with daily macro totals.' },
    ],
  },
  {
    title: 'Build habits that stick',
    items: [
      { name: 'Streak tracker', desc: 'Build a consecutive logging streak. Milestones at 3, 7, 14 and 30 days.' },
      { name: 'Daily reminders', desc: 'Get a gentle nudge at breakfast, lunch and dinner while the app is open.' },
      { name: 'Fasting timer', desc: 'Run 16:8, 18:6, 20:4, or a custom fasting window with a live countdown and an alert when your fast ends.' },
      { name: 'Progress photos', desc: 'Upload a weekly progress photo and compare any two side by side to see your transformation.' },
      { name: 'Dated meal history', desc: 'Every entry is timestamped. Tap any date to expand and see everything you ate that day.' },
      { name: 'Syncs everywhere', desc: 'Your meal log lives in the cloud. Log on your phone, check on your laptop.' },
    ],
  },
  {
    title: 'Your coach in your pocket',
    items: [
      { name: "Stacy's coaching note", desc: "Every photo, voice and menu scan comes with a personalised coaching note written in Stacy's voice." },
      { name: 'AI Coach', desc: 'Ask Stacy anything about your week. She reads your actual logged data and answers like a real PT would.' },
      { name: 'Pre-built meal plans', desc: "Three done-for-you day plans — fat loss, maintain, and build — written by Stacy. Log any meal straight to your day." },
      { name: 'Goal-aware output', desc: 'Set your goal to Fat Loss, Maintain, or Build & Tone. Every result and recommendation adapts to it.' },
    ],
  },
];

const ALL_FEATURES: FeatureItem[] = FEATURE_CLUSTERS.flatMap((c) => c.items);

const COACHING_NOTE = "Stacy's coaching note";
const STACY_TAKE =
  "That's a brilliant fat-loss plate. 44g of protein is exactly where you want to be — the broccoli keeps it filling without blowing your calories. Genuinely good choice.";

const AI_COACH = 'AI Coach';
// PLACEHOLDER example copy, needs Mark's approval
const COACH_CHAT_EXAMPLE: { label: string; text: string; from: 'user' | 'stacy' }[] = [
  { label: 'You asked', text: 'How am I doing this week?', from: 'user' },
  {
    label: "Stacy's answer",
    text: "Solid week. Your streak is strong and your protein is on track. Let's tighten up the weekend snacking.",
    from: 'stacy',
  },
];

// Bento cards, in display order. Text comes from FEATURE_CLUSTERS by name;
// every feature not listed here is shown as a chip under "And everything else".
const BENTO_LAYOUT: { name: string; icon: LucideIcon; size: 'large' | 'quarter' | 'third' }[] = [
  { name: COACHING_NOTE, icon: MessageCircleHeart, size: 'large' },
  { name: AI_COACH, icon: Bot, size: 'large' },
  { name: 'Photo snap', icon: Camera, size: 'quarter' },
  { name: 'Voice logging', icon: Mic, size: 'quarter' },
  { name: 'Barcode scanner', icon: ScanBarcode, size: 'quarter' },
  { name: 'Restaurant menu scanner', icon: UtensilsCrossed, size: 'quarter' },
  { name: 'Streak tracker', icon: Flame, size: 'third' },
  { name: 'Fasting timer', icon: Timer, size: 'third' },
  { name: 'Pre-built meal plans', icon: ClipboardList, size: 'third' },
];

const BENTO_FEATURES = BENTO_LAYOUT.map((b) => ({
  ...b,
  desc: ALL_FEATURES.find((f) => f.name === b.name)?.desc ?? '',
}));

const MORE_FEATURES = ALL_FEATURES.filter(
  (f) => !BENTO_LAYOUT.some((b) => b.name === f.name)
);

type VsKind = 'check' | 'partial' | 'cross';

interface VsRow {
  feature: string;
  munch: string;
  mfp: string;
  cal: string;
  macro: string;
  munchKind?: VsKind;
  mfpKind?: VsKind;
  calKind?: VsKind;
  macroKind?: VsKind;
}

const VS_ROWS: VsRow[] = [
  { feature: 'Photo macro analysis', munch: '✓ Claude AI', mfp: '~ Basic', cal: '✓ Good', macro: '✗ None', mfpKind: 'partial', calKind: 'check', macroKind: 'cross' },
  { feature: 'Motivating coaching tone', munch: '✓ Warm & empowering', mfp: '✗', cal: '✗', macro: '✗ Clinical', mfpKind: 'cross', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Goal-aware output', munch: '✓ Fat loss / Maintain / Build', mfp: '~ Basic', cal: '✗', macro: '✓ Advanced', mfpKind: 'partial', calKind: 'cross', macroKind: 'check' },
  { feature: 'Voice logging', munch: '✓ Included', mfp: '✓ Premium only', cal: '✗', macro: '✗', mfpKind: 'check', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Barcode scanner', munch: '✓ Free via Open Food Facts', mfp: '✓ Premium only', cal: '✓', macro: '✓', mfpKind: 'check', calKind: 'check', macroKind: 'check' },
  { feature: 'AI Coach on your data', munch: '✓ Ask Stacy', mfp: '✓ Premium only', cal: '✗', macro: '✗', mfpKind: 'check', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Streak + habit tracking', munch: '✓ Built in', mfp: '✓', cal: '✗', macro: '✓ Basic', mfpKind: 'check', calKind: 'cross', macroKind: 'check' },
  { feature: 'Fasting timer', munch: '✓ 16:8, 18:6, 20:4, custom', mfp: '✓ Premium', cal: '✗', macro: '✗', mfpKind: 'check', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Progress photos', munch: '✓ With comparison', mfp: '✗', cal: '✗', macro: '✗', mfpKind: 'cross', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Pre-built meal plans', munch: "✓ In Stacy's voice", mfp: '✓ Premium+', cal: '✗', macro: '✗', mfpKind: 'check', calKind: 'cross', macroKind: 'cross' },
  { feature: 'Meal log syncs across devices', munch: '✓ Included', mfp: '✓', cal: '✓', macro: '✓', mfpKind: 'check', calKind: 'check', macroKind: 'check' },
  { feature: 'UK price', munch: '£5.99/mo', mfp: '~£13/mo', cal: '~£6/mo', macro: '~£6/mo' },
  { feature: 'Free entry point', munch: '✓ 3 free snaps', mfp: '~ Limited', cal: '✓ 3-day trial', macro: '✗ No free tier', mfpKind: 'partial', calKind: 'check', macroKind: 'cross' },
];

// Rows shown before "Show full comparison" is opened.
const VS_CORE_ROWS = new Set([
  'Photo macro analysis',
  'Motivating coaching tone',
  'Voice logging',
  'AI Coach on your data',
  'Progress photos',
  'Pre-built meal plans',
  'UK price',
  'Free entry point',
]);

const VS_KIND_LABEL: Record<VsKind, string> = { check: 'Yes', partial: 'Partial', cross: 'No' };

// Swaps the leading ✓ / ~ / ✗ glyph for an icon; the claim text itself is unchanged.
function VsCell({ text, kind }: { text: string; kind?: VsKind }) {
  if (!kind) return <>{text}</>;
  const label = text.replace(/^[✓~✗]\s*/, '');
  return (
    <span className={`vs-cell vs-${kind}`}>
      <span className="vs-mark" aria-hidden="true">
        {kind === 'check' && <Check size={14} strokeWidth={3} />}
        {kind === 'cross' && <Minus size={18} strokeWidth={2} />}
      </span>
      {label ? <span>{label}</span> : <span className="sr-only">{VS_KIND_LABEL[kind]}</span>}
    </span>
  );
}

// Animates an element's height when its content changes with `open`.
// Call capture() just before toggling; skipped under prefers-reduced-motion.
function useAnimatedHeight<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  const from = useRef<number | null>(null);
  const capture = () => {
    if (ref.current) from.current = ref.current.offsetHeight;
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = el.offsetHeight;
    if (start === end) return;

    const reset = () => {
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
    };
    el.style.overflow = 'hidden';
    el.style.height = `${start}px`;
    el.getBoundingClientRect(); // commit the start height before transitioning
    el.style.transition = 'height 250ms ease';
    el.style.height = `${end}px`;
    const timer = window.setTimeout(reset, 300);
    return () => {
      window.clearTimeout(timer);
      reset();
    };
  }, [open]);

  return { ref, capture };
}

const PLAN_FEATURES: string[] = [
  'All logging methods (photo, voice, barcode, menu, gallery)',
  'AI macro analysis on every meal',
  "Stacy's coaching note on every result",
  'AI Coach — ask about your week',
  "Pre-built meal plans in Stacy's voice",
  'Water tracker + reminders',
  'Weight logging + trend graph',
  'Streak tracker + daily nudges',
  'Intermittent fasting timer',
  'Progress photos with comparison',
  'Net carbs mode',
  '7-day meal history synced to cloud',
  'No ads, ever',
];

interface FaqEntry {
  q: string;
  a: string;
}

const FAQS: FaqEntry[] = [
  {
    q: 'How accurate is the photo macro analysis?',
    a: 'Claude AI analyses your photo and estimates calories, protein, carbs, and fat based on what it can see — portion sizes, ingredients, and cooking method. For simple meals it’s very accurate. For complex mixed dishes there’s more estimation involved. Every result shows a breakdown of what the AI identified so you can review and edit any value you disagree with.',
  },
  {
    q: 'Does it work with home-cooked meals and UK foods?',
    a: 'Yes. Unlike database-first apps, Munch Snapper analyses the actual photo rather than searching a food database. That means it handles home cooking, UK supermarket meals, takeaways, and restaurant food without needing an entry to exist in any database first.',
  },
  {
    q: 'What logging methods are available?',
    a: 'Five ways to log: snap a photo, upload from your gallery, scan a barcode (packaged foods via Open Food Facts), speak your meal using voice logging, or photograph a restaurant menu for a goal-aware dish recommendation. You can also re-log recent meals in one tap.',
  },
  {
    q: "What is Stacy's coaching note?",
    a: "Every meal analysis comes with a short note written in Stacy Kundu’s coaching voice — a real Level 3 certified personal trainer. The note is specific to your logged meal and your goal (fat loss, maintain, or build). It reads like a message from your PT.",
  },
  {
    q: 'What is the AI Coach?',
    a: 'The AI Coach (Ask Stacy) lives in your meal log. It reads your actual logged meals from the past 7 days and answers questions in Stacy’s voice — things like "Did I hit my protein this week?" or "Why do I keep going over on fat?" It is goal-aware and data-aware, not generic.',
  },
  {
    q: 'Is this separate from the Metaburn app?',
    a: 'Munch Snapper is a completely standalone product — no Metaburn subscription needed. It works on its own for anyone who wants smart macro tracking with real coaching. Metaburn clients get 20% off for their first year with their promo code. Email help@munchsnapper.com to get yours.',
  },
  {
    q: 'Does my data sync across devices?',
    a: 'Yes. Your meal log is stored in the cloud (not just on your phone). Log on your phone, check your history on your laptop — your meal log is always in sync. Water, weight, streaks, and preferences are stored locally per device.',
  },
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. Monthly subscribers can cancel any time with no questions asked. Annual subscribers can cancel before renewal. There are no lock-ins or minimum commitments on Munch Snapper.',
  },
  {
    q: 'I already use MyFitnessPal — why switch?',
    a: 'MyFitnessPal is a database app — you search and select every ingredient manually. Munch Snapper analyses a photo of your actual meal in seconds. You also get Stacy’s coaching voice on every result, an AI Coach reading your weekly data, a streak tracker, fasting timer, progress photos, and a pre-built meal plan — all for less than MFP’s premium tier. The difference is tracking vs coaching.',
  },
  {
    q: 'How much does it cost?',
    a: '£5.99 per month or £49.99 per year (saving 30%). You get 3 free photo snaps before any payment is required — no credit card needed to start.',
  },
];

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const showAppCta = isLoaded && isSignedIn;
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showFullVs, setShowFullVs] = useState(false);
  const moreFeatures = useAnimatedHeight<HTMLUListElement>(showAllFeatures);
  const vsTable = useAnimatedHeight<HTMLDivElement>(showFullVs);

  useEffect(() => {
    // FAQ accordion — named handlers so cleanup can remove the exact
    // listener that was attached (StrictMode mounts this effect twice in
    // development; without this, clicks open then instantly close).
    const faqButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.faq-q'));
    const faqHandlers = faqButtons.map((btn) => {
      const handleClick = () => {
        const item = btn.closest('.faq-item');
        if (!item) return;
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach((i) => {
          i.classList.remove('open');
          const q = i.querySelector('.faq-q');
          if (q) q.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      };
      btn.addEventListener('click', handleClick);
      return handleClick;
    });

    // Scroll fade-in
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    document
      .querySelectorAll('.step, .feature-card, .stat-box, .price-card, .cluster-card')
      .forEach((el) => {
        el.classList.add('fade-in');
        observer.observe(el);
      });

    // Nav scroll highlight
    const sections = document.querySelectorAll<HTMLElement>('section[id]');
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const handleScroll = () => {
      let current = '';
      sections.forEach((s) => {
        if (window.scrollY >= s.offsetTop - 120) current = s.id;
      });
      navLinks.forEach((a) => {
        a.style.color = a.getAttribute('href') === '#' + current ? 'var(--magenta)' : '';
      });
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      faqButtons.forEach((btn, idx) => {
        btn.removeEventListener('click', faqHandlers[idx]);
      });
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="landing">
      {/* NAV */}
      <nav>
        <Link href="/" className="nav-logo" aria-label="Munch Snapper home">
          <span className="logo-crop logo-dark">
            <Image
              src="/munch-snapper-logo.png"
              alt="Munch Snapper"
              width={240}
              height={240}
              priority
            />
          </span>
        </Link>
        <ul className="nav-links">
          <li>
            <a href="#how-it-works" style={{ textDecoration: 'none' }}>
              How it works
            </a>
          </li>
          <li>
            <a href="#features" style={{ textDecoration: 'none' }}>
              Features
            </a>
          </li>
          <li>
            <a href="#pricing" style={{ textDecoration: 'none' }}>
              Pricing
            </a>
          </li>
        </ul>
        <Link
          href={showAppCta ? '/app' : '/sign-up'}
          className="btn-primary"
          style={{ textDecoration: 'none' }}
        >
          {showAppCta ? 'Go to app' : 'Try Free'}
        </Link>
      </nav>

      {/* HERO */}
      <section id="hero" className="section-white">
        <div className="container">
          <div className="hero-grid">
            <div>
              <h1 className="hero-headline">
                Snap it.<br />Track it.<br />
                <span className="accent">Get coached.</span>
              </h1>
              <p className="hero-sub">
                The only food tracking app with a real PT&apos;s voice on every snap. Photo snap, barcode scanner, voice logging, AI coaching, and targets and meal plans built around your goal — all in one place.
              </p>
              <div className="hero-ctas">
                <Link
                  href={showAppCta ? '/app' : '/sign-up'}
                  className="btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  {showAppCta ? 'Go to app' : 'Try free — 3 snaps on us'}
                </Link>
                <a
                  href="#pricing"
                  className="btn-outline"
                  style={{ textDecoration: 'none' }}
                >
                  See pricing
                </a>
              </div>
              <ul className="hero-trust">
                {HERO_CHIPS.map(({ label, icon: Icon }) => (
                  <li key={label} className="hero-pill">
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="hero-visual">
              <div className="phone-wrap">
                <div className="phone-mock">
                  <div className="phone-inner">
                    <div className="phone-header">
                      <div className="phone-header-icon">📸</div>
                      <div>
                        <div className="phone-header-text">Munch Snapper</div>
                        <div className="phone-header-sub">by Stacy Kundu</div>
                      </div>
                    </div>
                    <div className="phone-meal-img">
                      <div className="meal-placeholder">
                        <span className="meal-placeholder-icon">🍽️</span>
                        <span className="meal-placeholder-text">Herb chicken · Rice · Broccoli</span>
                      </div>
                    </div>
                    <div className="phone-macros">
                      <div className="macro-cell">
                        <div className="macro-val cal">497</div>
                        <div className="macro-label">Calories</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">44g</div>
                        <div className="macro-label">Protein</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">38g</div>
                        <div className="macro-label">Carbs</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">10g</div>
                        <div className="macro-label">Fat</div>
                      </div>
                    </div>
                    <div className="phone-insight">
                      <div className="insight-label">Stacy&apos;s take</div>
                      <div className="insight-text">
                        That&apos;s a brilliant fat-loss plate. 44g of protein is exactly where you want to be — the broccoli keeps it filling without blowing your calories. Genuinely good choice.
                      </div>
                    </div>
                    <div className="phone-log-btn">✓ Log this meal</div>
                  </div>
                </div>
                <div className="phone-badge">
                  <div className="phone-badge-text">🎯 44g protein</div>
                  <div className="phone-badge-sub">Smashing your target</div>
                </div>
                <div className="phone-badge2">
                  <div className="phone-badge2-text">⚡ Result in seconds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section-mint">
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2 className="section-headline">Three steps. Ten seconds.</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">Log your meal your way</div>
              <p className="step-desc">
                Snap a photo, scan a barcode, speak your meal, or pick from your recent foods. Munch Snapper handles the rest in seconds.
              </p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">Get Stacy&apos;s take instantly</div>
              <p className="step-desc">
                Every result comes with a coaching note written in Stacy&apos;s voice — specific to your goal, your macros, and what she can actually see on your plate.
              </p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">Track, build habits, and progress</div>
              <p className="step-desc">
                Watch your streak grow, hit your water goal, log your weight, and check in with the AI Coach whenever you need a nudge. Your data syncs across every device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES — BENTO */}
      <section id="features" className="section-white">
        <div className="container">
          <span className="eyebrow">Features</span>
          <h2 className="features-headline">Everything you need. Nothing you don&apos;t.</h2>
          <p className="features-lede">
            A full nutrition coaching platform for £5.99 a month.
          </p>
          <div className="bento-grid">
            {BENTO_FEATURES.map(({ name, desc, size, icon: Icon }) => (
              <article key={name} className={`cluster-card bento-card bento-${size}`}>
                <span className="icon-tile" aria-hidden="true">
                  <Icon size={24} strokeWidth={2} />
                </span>
                <h3 className="bento-title">{name}</h3>
                <p className="bento-desc">{desc}</p>
                {name === COACHING_NOTE && (
                  <figure className="take-bubble">
                    <figcaption className="take-label">Stacy&apos;s take</figcaption>
                    <blockquote>{STACY_TAKE}</blockquote>
                  </figure>
                )}
                {name === AI_COACH && (
                  <div className="coach-chat">
                    {COACH_CHAT_EXAMPLE.map((m) => (
                      <figure key={m.label} className={`take-bubble from-${m.from}`}>
                        <figcaption className="take-label">{m.label}</figcaption>
                        <blockquote>{m.text}</blockquote>
                      </figure>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="more-features">
            <h3 className="more-title">And everything else</h3>
            <ul
              id="more-features-list"
              ref={moreFeatures.ref}
              className={`more-grid${showAllFeatures ? ' open' : ''}`}
            >
              {MORE_FEATURES.map((f) => (
                <li key={f.name}>
                  <span className="more-chip">{f.name}</span>
                  <p className="more-desc">{f.desc}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-outline expander-btn"
              aria-expanded={showAllFeatures}
              aria-controls="more-features-list"
              onClick={() => {
                moreFeatures.capture();
                setShowAllFeatures((open) => !open);
              }}
            >
              See every feature
              <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* VS COMPETITORS */}
      <section id="vs" className="section-mint">
        <div className="container">
          <span className="eyebrow">Why Munch Snapper</span>
          <h2 className="vs-headline">
            Every other app gives you<br />numbers. We give you{' '}
            <span style={{ color: 'var(--magenta)' }}>coaching.</span>
          </h2>
          <div className="vs-card">
            <div className="vs-scroll" ref={vsTable.ref}>
              <table className="vs-table" id="vs-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th className="col-snap">Munch Snapper</th>
                    <th>MyFitnessPal</th>
                    <th>Cal AI</th>
                    <th>MacroFactor</th>
                  </tr>
                </thead>
                <tbody>
                  {VS_ROWS.map((r) => (
                    <tr
                      key={r.feature}
                      className="snap-row"
                      hidden={!showFullVs && !VS_CORE_ROWS.has(r.feature)}
                    >
                      <td>{r.feature}</td>
                      <td className="col-snap">
                        <VsCell
                          text={r.munch}
                          kind={r.munch.startsWith('✓') ? 'check' : r.munchKind}
                        />
                      </td>
                      <td>
                        <VsCell text={r.mfp} kind={r.mfpKind} />
                      </td>
                      <td>
                        <VsCell text={r.cal} kind={r.calKind} />
                      </td>
                      <td>
                        <VsCell text={r.macro} kind={r.macroKind} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="vs-actions">
            <button
              type="button"
              className="btn-outline expander-btn"
              aria-expanded={showFullVs}
              aria-controls="vs-table"
              onClick={() => {
                vsTable.capture();
                setShowFullVs((open) => !open);
              }}
            >
              Show full comparison
              <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <p className="vs-footnote">
              Competitor features and prices are approximate and may change.
            </p>
          </div>
        </div>
      </section>

      {/* STACY SECTION */}
      <section id="stacy" className="section-white">
        <div className="container">
          <div className="stacy-grid">
            <div className="stacy-img-wrap">
              <div className="stacy-img-box">
                <span className="stacy-camera">📷</span>
                <span className="stacy-photo-label">📸 PHOTO COMING SOON</span>
              </div>
              <div className="stacy-creds">
                <div className="cred-pill"><span className="cred-check">✓</span> Level 3 Personal Trainer</div>
                <div className="cred-pill"><span className="cred-check">✓</span> Level 2 Fitness Instructor</div>
                <div className="cred-pill"><span className="cred-check">✓</span> HYROX Group Instructor</div>
              </div>
            </div>
            <div>
              <span className="eyebrow">Your coach</span>
              <h2 className="stacy-headline">Hi, I&apos;m Stacy — and I&apos;ve been where you are.</h2>
              <div className="stacy-body">
                <p>
                  I started my fitness journey as a 4&apos;11&quot; flat-footed woman in my late 20s with no athletic background. I know exactly what it feels like to not trust what you&apos;re eating, wonder if you&apos;re doing it right, and feel like the numbers never add up.
                </p>
                <p>
                  Every coaching note inside Munch Snapper is written the way I&apos;d speak to a real client. No shame. No clinical jargon. Just honest, specific guidance that tells you what to do next — not just what the numbers are.
                </p>
                <p>
                  As a 37-year-old mum to a neurodiverse child, juggling work, life, and everything in between — I built this for women like us. Because tracking your food shouldn&apos;t feel like another thing on the to-do list.
                </p>
              </div>
              <div style={{ marginTop: '2rem' }}>
                <a
                  href="https://www.youtube.com/@stacykundu"
                  target="_blank"
                  rel="noopener"
                  className="stacy-link"
                >
                  Watch Stacy use it on YouTube →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-mint">
        <div className="container">
          <span className="eyebrow">Pricing</span>
          <h2 className="pricing-headline">Simple, honest pricing.</h2>
          <p className="pricing-sub">
            No ads. No upsells. Just Stacy, your data, and a plan that works.
          </p>
          <div className="pricing-cards">
            {/* MONTHLY */}
            <div className="price-card">
              <div className="price-name">Monthly</div>
              <div className="price-amount">
                <span className="currency">£</span>5.99
              </div>
              <div className="price-period">Cancel anytime</div>
              <div className="price-tagline">Less than a coffee. Unlimited snaps.</div>
              <ul className="price-features">
                {PLAN_FEATURES.map((f) => (
                  <li key={`m-${f}`}>
                    <span className="price-tick" aria-hidden="true">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="btn-outline-magenta price-cta"
                style={{ textDecoration: 'none' }}
              >
                Start free — 3 snaps on us
              </Link>
            </div>

            {/* ANNUAL */}
            <div className="price-card featured">
              <div className="featured-badge">SAVE 30%</div>
              <div className="price-name">Annual</div>
              <div className="price-amount">
                <span className="currency">£</span>49.99
              </div>
              <div className="price-period">That&apos;s just £4.17/month · Save £21.89</div>
              <div className="price-tagline">Best value. Same everything. One year of Stacy.</div>
              <ul className="price-features">
                {PLAN_FEATURES.map((f) => (
                  <li key={`a-${f}`}>
                    <span className="price-tick" aria-hidden="true">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/subscribe?annual=true"
                className="btn-primary price-cta"
                style={{ textDecoration: 'none' }}
              >
                Get annual — best value
              </Link>
            </div>
          </div>
          <p
            className="pricing-note"
            style={{ maxWidth: '44rem', margin: '2rem auto 0' }}
          >
            3 free snaps included before any payment. Monthly subscribers can cancel at any time.
            Annual subscribers can cancel before renewal. No lock-ins.
          </p>
          <p className="pricing-note" style={{ margin: '0.5rem auto 0' }}>
            Questions? Email{' '}
            <a
              href="mailto:help@munchsnapper.com"
              style={{
                color: 'var(--magenta)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              help@munchsnapper.com
            </a>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-white">
        <div className="container">
          <span className="eyebrow">Got questions?</span>
          <h2 className="faq-headline">We&apos;ve got answers.</h2>
          <div className="faq-list">
            {FAQS.map((f) => (
              <div key={f.q} className="faq-item">
                <button className="faq-q" aria-expanded="false">
                  {f.q} <span className="faq-arrow">&#8964;</span>
                </button>
                <div className="faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="final-cta" className="section-magenta">
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Ready?</span>
          <h2 className="final-headline">
            Stop guessing.<br />Start{' '}
            <span>knowing.</span>
          </h2>
          <p className="final-sub">
            Three free snaps. No card. No commitment. See what you&apos;ve been missing.
          </p>
          <div className="final-ctas">
            <Link
              href="/sign-up"
              className="btn-primary btn-on-magenta"
              style={{ textDecoration: 'none' }}
            >
              Start for free — 3 snaps on us
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section-white">
        <div className="container" style={{ textAlign: 'center', maxWidth: '50rem' }}>
          <span className="eyebrow">Contact</span>
          <h2 className="section-headline" style={{ marginBottom: '1rem' }}>
            Get in Touch
          </h2>
          <p className="contact-sub">
            Got a question? We&apos;d love to hear from you.
          </p>
          <a
            href="mailto:help@munchsnapper.com"
            className="contact-email"
            style={{
              fontFamily: 'var(--display-font)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 800,
              color: 'var(--magenta)',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              display: 'inline-block',
              borderBottom: '2px solid var(--magenta)',
              paddingBottom: 4,
            }}
          >
            help@munchsnapper.com
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '2rem',
            width: '100%',
          }}
        >
          <div className="footer-brand" style={{ maxWidth: '26rem' }}>
            <strong
              style={{
                fontFamily: 'var(--display-font)',
                letterSpacing: '0.02em',
                display: 'block',
              }}
            >
              Munch Snapper
            </strong>
            <div className="footer-tagline">
              AI-powered macro tracking. Snap, log, and stay on track.
            </div>
          </div>
          <ul className="footer-links">
            <li>
              <Link href="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms">Terms of Service</Link>
            </li>
            <li>
              <a href="mailto:help@munchsnapper.com">help@munchsnapper.com</a>
            </li>
          </ul>
        </div>
        <div className="footer-legal">
          © 2026 Munch Snapper. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
