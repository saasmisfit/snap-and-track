'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

const MAGENTA = '#B0185E';
const CARD = '#1a1a1e';
const BORDER = '#2a2a30';
const WHITE = '#ffffff';
const TEXT_MUTED = 'rgba(255,255,255,0.7)';
const TEXT_FAINT = 'rgba(255,255,255,0.55)';

const HERO_SOCIAL_STRIP =
  '📸 Photo snap · 🔊 Voice log · 📊 Macro tracking · 🔥 Streak coaching · 🤖 AI Coach';

interface FeatureItem {
  emoji: string;
  name: string;
  desc: string;
}

interface FeatureCluster {
  emoji: string;
  title: string;
  items: FeatureItem[];
}

const FEATURE_CLUSTERS: FeatureCluster[] = [
  {
    emoji: '📸',
    title: 'Log your meals in seconds',
    items: [
      { emoji: '📸', name: 'Photo snap', desc: 'Point your camera at any meal and get instant calories and macros powered by Claude AI.' },
      { emoji: '🖼️', name: 'Gallery upload', desc: 'Already eaten? Upload from your camera roll and log it after the fact.' },
      { emoji: '📱', name: 'Barcode scanner', desc: 'Scan any packaged food and pull verified nutrition data from the Open Food Facts database.' },
      { emoji: '🎙️', name: 'Voice logging', desc: 'Just say what you ate. The app transcribes and estimates your macros automatically.' },
      { emoji: '🍽️', name: 'Restaurant menu scanner', desc: 'Photograph a menu and Stacy recommends the best dish for your goal.' },
      { emoji: '⚡', name: 'Quick re-log', desc: 'See your recent meals and log them again in one tap — no scanning needed.' },
    ],
  },
  {
    emoji: '📊',
    title: 'Track what actually matters',
    items: [
      { emoji: '🎯', name: 'Daily calorie target', desc: 'Set your personalised calorie and macro targets using the Mifflin-St Jeor calculator on first open.' },
      { emoji: '📉', name: 'Net carbs mode', desc: 'Toggle net carbs on for keto tracking. Fibre is tracked and subtracted automatically.' },
      { emoji: '💧', name: 'Water tracker', desc: 'Log your glasses and get browser reminders every two hours to stay hydrated.' },
      { emoji: '⚖️', name: 'Weight trend graph', desc: 'Log your weight daily and watch your 30-day trend line in a clean SVG graph.' },
      { emoji: '🔥', name: 'Calories burned', desc: 'Enter calories burned from your watch or tracker and see your adjusted daily budget.' },
      { emoji: '7️⃣', name: '7-day rolling history', desc: 'Your meal log keeps a full seven days of history, grouped by date, with daily macro totals.' },
    ],
  },
  {
    emoji: '🔥',
    title: 'Build habits that stick',
    items: [
      { emoji: '🔥', name: 'Streak tracker', desc: 'Build a consecutive logging streak. Milestone notifications fire at 3, 7, 14, and 30 days.' },
      { emoji: '⏰', name: 'Daily reminders', desc: 'Get a gentle nudge at breakfast, lunch, and dinner so nothing slips through the gaps.' },
      { emoji: '⏱️', name: 'Fasting timer', desc: 'Run 16:8, 18:6, 20:4, or a custom fasting window with a live countdown and eating window alerts.' },
      { emoji: '📷', name: 'Progress photos', desc: 'Upload a weekly progress photo and compare any two side by side to see your transformation.' },
      { emoji: '📅', name: 'Dated meal history', desc: 'Every entry is timestamped. Tap any date to expand and see everything you ate that day.' },
      { emoji: '☁️', name: 'Syncs everywhere', desc: 'Your data lives in the cloud. Log on your phone, check on your laptop — always in sync.' },
    ],
  },
  {
    emoji: '💬',
    title: 'Your coach in your pocket',
    items: [
      { emoji: '💬', name: "Stacy's coaching note", desc: "Every single meal scan returns a personalised note written in Stacy's voice — not generic AI output." },
      { emoji: '🤖', name: 'AI Coach', desc: 'Ask Stacy anything about your week. She reads your actual logged data and answers like a real PT would.' },
      { emoji: '📋', name: 'Pre-built meal plans', desc: "Three done-for-you day plans — fat loss, maintain, and build — written by Stacy. Log any meal straight to your day." },
      { emoji: '🎯', name: 'Goal-aware output', desc: 'Set your goal to Fat Loss, Maintain, or Build & Tone. Every result and recommendation adapts to it.' },
    ],
  },
];

interface VsRow {
  feature: string;
  munch: string;
  mfp: string;
  cal: string;
  macro: string;
  munchKind?: 'check' | 'partial' | 'cross';
  mfpKind?: 'check' | 'partial' | 'cross';
  calKind?: 'check' | 'partial' | 'cross';
  macroKind?: 'check' | 'partial' | 'cross';
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
  { feature: 'Cloud sync all devices', munch: '✓ Included', mfp: '✓', cal: '✓', macro: '✓', mfpKind: 'check', calKind: 'check', macroKind: 'check' },
  { feature: 'UK price', munch: '£5.99/mo', mfp: '~£13/mo', cal: '~£6/mo', macro: '~£6/mo' },
  { feature: 'Free entry point', munch: '✓ 3 free snaps', mfp: '~ Limited', cal: '✓ 3-day trial', macro: '✗ No free tier', mfpKind: 'partial', calKind: 'check', macroKind: 'cross' },
];

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
    a: "Every meal analysis comes with a short note written in Stacy Kundu’s coaching voice — a real Level 3 certified personal trainer. The note is specific to your logged meal and your goal (fat loss, maintain, or build). It is not a generic AI response — it reads like a message from your PT.",
  },
  {
    q: 'What is the AI Coach?',
    a: 'The AI Coach (Ask Stacy) lives in your meal log. It reads your actual logged meals from the past 7 days and answers questions in Stacy’s voice — things like "Did I hit my protein this week?" or "Why do I keep going over on fat?" It is goal-aware and data-aware, not generic.',
  },
  {
    q: 'Is this separate from the Metaburn app?',
    a: 'Munch Snapper is a completely standalone product — no Metaburn subscription needed. It works on its own for anyone who wants smart macro tracking with real coaching. If you are also a Metaburn app subscriber, you can add Munch Snapper as a bolt-on and receive 30% off your monthly or annual plan. Details available inside the Metaburn app.',
  },
  {
    q: 'Does my data sync across devices?',
    a: 'Yes. Your meal log is stored in the cloud (not just on your phone). Log on your phone, check your history on your laptop — everything is always in sync. Water, weight, streaks, and preferences are stored locally per device.',
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
    a: '£5.99 per month or £49.99 per year (saving 31%). You get 3 free photo snaps before any payment is required — no credit card needed to start.',
  },
];

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const showAppCta = isLoaded && isSignedIn;

  useEffect(() => {
    // FAQ accordion
    document.querySelectorAll<HTMLButtonElement>('.faq-q').forEach((btn) => {
      btn.addEventListener('click', () => {
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
      });
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
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* NAV */}
      <nav>
        <Link href="/" className="nav-logo" aria-label="Munch Snapper home">
          <Image
            src="/munch-snapper-logo.png"
            alt="Munch Snapper"
            width={160}
            height={60}
            priority
            style={{ height: 44, width: 'auto', display: 'block', background: 'transparent', mixBlendMode: 'screen' }}
          />
        </Link>
        <ul className="nav-links">
          <li>
            <a href="#how-it-works" style={{ color: '#ffffff', textDecoration: 'none' }}>
              How it works
            </a>
          </li>
          <li>
            <a href="#features" style={{ color: '#ffffff', textDecoration: 'none' }}>
              Features
            </a>
          </li>
          <li>
            <a href="#pricing" style={{ color: '#ffffff', textDecoration: 'none' }}>
              Pricing
            </a>
          </li>
        </ul>
        <Link
          href={showAppCta ? '/app' : '/sign-up'}
          className="btn-primary"
          style={{ color: '#ffffff', textDecoration: 'none' }}
        >
          {showAppCta ? 'Go to app' : 'Try Free'}
        </Link>
      </nav>

      {/* HERO */}
      <section id="hero" className="section-dark">
        <div className="container">
          <div className="hero-grid">
            <div>
              <Image
                src="/munch-snapper-logo.png"
                alt="Munch Snapper"
                width={220}
                height={82}
                priority
                style={{
                  width: 'auto',
                  height: 82,
                  display: 'block',
                  background: 'transparent',
                  mixBlendMode: 'screen',
                  marginBottom: '1.25rem',
                }}
              />
              <h1 className="hero-headline">
                Snap it.<br />Track it.<br />
                <span className="accent">Get coached.</span>
              </h1>
              <p className="hero-sub">
                The only food tracking app with a real PT&apos;s voice on every meal. Photo snap, barcode scanner, voice logging, AI coaching, and a plan built around your goal — all in one place.
              </p>
              <div className="hero-ctas">
                <Link
                  href={showAppCta ? '/app' : '/sign-up'}
                  className="btn-primary"
                  style={{ color: '#ffffff', textDecoration: 'none' }}
                >
                  {showAppCta ? 'Go to app' : 'Try free — 3 snaps on us'}
                </Link>
                <a
                  href="#pricing"
                  className="btn-outline"
                  style={{ color: '#ffffff', textDecoration: 'none' }}
                >
                  See pricing
                </a>
              </div>
              <p
                className="hero-trust"
                style={{
                  marginTop: '1.25rem',
                  fontSize: 13,
                  color: TEXT_FAINT,
                  letterSpacing: '0.02em',
                }}
              >
                {HERO_SOCIAL_STRIP}
              </p>
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
                        <div className="macro-unit">kcal</div>
                        <div className="macro-label">Calories</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">44g</div>
                        <div className="macro-unit">protein</div>
                        <div className="macro-label">Protein</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">38g</div>
                        <div className="macro-unit">carbs</div>
                        <div className="macro-label">Carbs</div>
                      </div>
                      <div className="macro-cell">
                        <div className="macro-val">10g</div>
                        <div className="macro-unit">fat</div>
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
                  <div className="phone-badge2-text">⚡ Result in 3 seconds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section-dark" style={{ padding: '6rem 0' }}>
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2
            style={{
              fontFamily: 'var(--display-font)',
              fontWeight: 800,
              fontSize: 'clamp(2rem,4vw,3.5rem)',
              lineHeight: 1,
              color: 'var(--white)',
            }}
          >
            Three steps. Ten seconds.
          </h2>
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

      {/* FEATURES — 4 CLUSTERS */}
      <section id="features" className="section-light" style={{ padding: '6rem 0' }}>
        <div className="container">
          <span className="eyebrow">Features</span>
          <h2 className="features-headline">Everything you need. Nothing you don&apos;t.</h2>
          <p
            style={{
              fontSize: '18px',
              color: 'rgba(0,0,0,0.65)',
              maxWidth: 640,
              margin: '0.5rem 0 2.5rem',
              lineHeight: 1.55,
            }}
          >
            A full nutrition coaching platform for £5.99 a month.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
            }}
          >
            {FEATURE_CLUSTERS.map((c, index) => {
              const isLast = index === FEATURE_CLUSTERS.length - 1;
              return (
                <article
                  key={c.title}
                  className="cluster-card"
                  style={{
                    background: CARD,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 18,
                    padding: '22px 22px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    color: WHITE,
                    ...(isLast
                      ? {
                          gridColumn: '1 / -1',
                          alignItems: 'center',
                          textAlign: 'center',
                        }
                      : {}),
                  }}
                >
                  <header
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      ...(isLast ? { justifyContent: 'center' } : {}),
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>
                      {c.emoji}
                    </span>
                    <h3
                      style={{
                        fontFamily: 'var(--display-font)',
                        fontWeight: 800,
                        fontSize: 20,
                        lineHeight: 1.15,
                        color: MAGENTA,
                        margin: 0,
                        letterSpacing: '-0.01em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.title}
                    </h3>
                  </header>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      ...(isLast
                        ? { maxWidth: 520, width: '100%', textAlign: 'left' }
                        : {}),
                    }}
                  >
                    {c.items.map((f) => (
                      <li
                        key={f.name}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}
                        >
                          {f.emoji}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "'Barlow', sans-serif",
                              fontWeight: 700,
                              fontSize: 14,
                              color: WHITE,
                              lineHeight: 1.4,
                            }}
                          >
                            {f.name}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: TEXT_MUTED,
                              lineHeight: 1.55,
                              marginTop: 2,
                            }}
                          >
                            {f.desc}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* VS COMPETITORS */}
      <section id="vs" className="section-mid" style={{ padding: '6rem 0' }}>
        <div className="container">
          <span className="eyebrow">Why Munch Snapper</span>
          <h2 className="vs-headline">
            Every other app gives you<br />numbers. We give you{' '}
            <span style={{ color: 'var(--magenta)' }}>coaching.</span>
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="vs-table">
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
                  <tr key={r.feature} className="snap-row">
                    <td>{r.feature}</td>
                    <td className="col-snap check">{r.munch}</td>
                    <td className={r.mfpKind ?? ''}>{r.mfp}</td>
                    <td className={r.calKind ?? ''}>{r.cal}</td>
                    <td className={r.macroKind ?? ''}>{r.macro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* STACY SECTION */}
      <section id="stacy" className="section-dark" style={{ padding: '6rem 0' }}>
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
                  style={{
                    color: 'var(--magenta)',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Watch Stacy use it on YouTube →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-light" style={{ padding: '6rem 0' }}>
        <div className="container">
          <span className="eyebrow">Pricing</span>
          <h2 className="pricing-headline">Simple, honest pricing.</h2>
          <p className="pricing-sub">
            No ads. No upsells. Just Stacy, your data, and a plan that works.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
              maxWidth: 800,
              margin: '2.5rem auto 0',
            }}
          >
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
                  <li key={`m-${f}`}>{f}</li>
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
              <div className="featured-badge">SAVE 31%</div>
              <div className="price-name">Annual</div>
              <div className="price-amount">
                <span className="currency">£</span>49.99
              </div>
              <div className="price-period">That&apos;s just £4.17/month · Save £21.89</div>
              <div className="price-tagline">Best value. Same everything. One year of Stacy.</div>
              <ul className="price-features">
                {PLAN_FEATURES.map((f) => (
                  <li key={`a-${f}`}>{f}</li>
                ))}
                <li>Priority email support</li>
              </ul>
              <Link
                href="/subscribe?annual=true"
                className="btn-primary price-cta"
                style={{ color: '#ffffff', textDecoration: 'none' }}
              >
                Get annual — best value
              </Link>
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(0,0,0,0.55)',
              textAlign: 'center',
              maxWidth: 680,
              margin: '1.5rem auto 0',
              lineHeight: 1.55,
            }}
          >
            3 free snaps included before any payment. Monthly subscribers can cancel at any time.
            Annual subscribers can cancel before renewal. No lock-ins.
          </p>
          <p
            style={{
              fontSize: 13,
              color: 'rgba(0,0,0,0.55)',
              textAlign: 'center',
              margin: '0.5rem auto 0',
            }}
          >
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
      <section id="faq" className="section-dark" style={{ padding: '6rem 0' }}>
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
      <section id="final-cta" className="section-dark">
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Ready?</span>
          <h2 className="final-headline">
            Stop guessing.<br />Start{' '}
            <span style={{ color: 'var(--magenta)' }}>knowing.</span>
          </h2>
          <p className="final-sub">
            Three free snaps. No card. No commitment. See what you&apos;ve been missing.
          </p>
          <div className="final-ctas">
            <Link
              href="/sign-up"
              className="btn-primary"
              style={{ fontSize: 16, padding: '14px 32px', color: '#ffffff', textDecoration: 'none' }}
            >
              Start for free — 3 snaps on us
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section-dark" style={{ padding: '6rem 0' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 720 }}>
          <span className="eyebrow">Contact</span>
          <h2
            style={{
              fontFamily: 'var(--display-font)',
              fontWeight: 800,
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              lineHeight: 1,
              color: WHITE,
              marginBottom: '1rem',
            }}
          >
            Get in Touch
          </h2>
          <p
            style={{
              fontSize: 18,
              color: TEXT_MUTED,
              marginBottom: '2.25rem',
              lineHeight: 1.6,
            }}
          >
            Got a question? We&apos;d love to hear from you.
          </p>
          <a
            href="mailto:help@munchsnapper.com"
            className="contact-email"
            style={{
              fontFamily: 'var(--display-font)',
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 800,
              color: MAGENTA,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              display: 'inline-block',
              borderBottom: `2px solid ${MAGENTA}`,
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
          padding: '3rem 2rem 2rem',
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
          <div className="footer-brand" style={{ maxWidth: 360 }}>
            <strong
              style={{
                fontFamily: 'var(--display-font)',
                fontSize: 20,
                letterSpacing: '0.02em',
                display: 'block',
              }}
            >
              Munch Snapper
            </strong>
            <div
              style={{
                marginTop: '0.5rem',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
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
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            marginTop: '2rem',
            paddingTop: '1.5rem',
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
          }}
        >
          © 2026 Munch Snapper. All rights reserved.
        </div>
      </footer>
    </>
  );
}
