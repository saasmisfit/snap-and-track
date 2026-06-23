'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  useEffect(() => {
    // FAQ accordion
    document.querySelectorAll<HTMLButtonElement>('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        if (!item) return;
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => {
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
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.pain-card, .step, .feature-card, .testimonial, .stat-box, .price-card').forEach(el => {
      el.classList.add('fade-in');
      observer.observe(el);
    });

    // Nav scroll highlight
    const sections = document.querySelectorAll<HTMLElement>('section[id]');
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const handleScroll = () => {
      let current = '';
      sections.forEach(s => {
        if (window.scrollY >= s.offsetTop - 120) current = s.id;
      });
      navLinks.forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + current
          ? 'var(--magenta)' : '';
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
        <a href="#" className="nav-logo" aria-label="Munch Snapper home">
          <div className="nav-logo-mark">MS</div>
          <div>
            <div className="nav-logo-text">Munch Snapper</div>
            <div className="nav-logo-sub">by Stacy Kundu</div>
          </div>
        </a>
        <ul className="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <Link href="/sign-up" className="btn-primary">Try Free</Link>
      </nav>

      {/* HERO */}
      <section id="hero" className="section-dark">
        <div className="container">
          <div className="hero-grid">
            <div>
              <span className="eyebrow">Munch Snapper</span>
              <h1 className="hero-headline">
                Know exactly<br />what you&apos;re<br />eating —<br /><span className="accent">in seconds.</span>
              </h1>
              <p className="hero-sub">Take a photo of any meal. Get instant calories, protein, carbs, and fat — plus a coaching note from Stacy built around your goal.</p>
              <div className="hero-ctas">
                <Link href="/sign-up" className="btn-primary">Start for free</Link>
                <a href="#how" className="btn-outline">See how it works</a>
              </div>
              <p className="hero-trust">3 free snaps — no card needed &nbsp;·&nbsp; Works on any meal</p>
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
                      <div className="insight-text">That&apos;s a brilliant fat-loss plate. 44g of protein is exactly where you want to be — the broccoli keeps it filling without blowing your calories. Genuinely good choice.</div>
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

      {/* PAIN POINTS */}
      <section id="pain" className="section-light">
        <div className="container">
          <span className="eyebrow" style={{color: 'var(--magenta)'}}>Sound familiar?</span>
          <h2 style={{fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3.5rem)', lineHeight: 1, color: 'var(--near-black)', maxWidth: '640px'}}>
            Tracking what you eat shouldn&apos;t be a full-time job.
          </h2>
          <div className="pain-grid">
            <div className="pain-card">
              <span className="pain-emoji">😩</span>
              <div className="pain-title">Spending 10 minutes logging one meal</div>
              <p className="pain-desc">Scrolling through a database of 20 million foods trying to find something that vaguely matches what you just ate. You give up before you finish.</p>
            </div>
            <div className="pain-card">
              <span className="pain-emoji">🤷‍♀️</span>
              <div className="pain-title">No idea if you&apos;re hitting your protein</div>
              <p className="pain-desc">You know protein matters. You&apos;re trying to eat more of it. But without tracking, you&apos;re guessing — and guessing keeps you stuck.</p>
            </div>
            <div className="pain-card">
              <span className="pain-emoji">📊</span>
              <div className="pain-title">Apps that talk in numbers, not coaching</div>
              <p className="pain-desc">Red numbers when you go over. No context. No encouragement. Just data — from an app that doesn&apos;t know you, your life, or your goals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="section-dark" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2 style={{fontFamily: 'var(--display-font)', fontWeight: 800, fontSize: 'clamp(2rem,4vw,3.5rem)', lineHeight: 1, color: 'var(--white)'}}>
            Three steps. Ten seconds.
          </h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">Snap your meal</div>
              <p className="step-desc">Take a photo of anything — a home-cooked plate, a restaurant meal, a snack. No setup. No food database. Just your camera.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">Pick your goal</div>
              <p className="step-desc">Tell the app whether you&apos;re focused on fat loss, maintenance, or building. Your coaching note changes based on what you&apos;re working towards.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">Get your breakdown</div>
              <p className="step-desc">Instant calories, protein, carbs, and fat — plus Stacy&apos;s coaching take on how that meal fits your goal. Log it. Move on with your day.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section-light" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow">What makes it different</span>
          <h2 className="features-headline">Built for women who actually have lives.</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📸</div>
              <div className="feature-body">
                <div className="feature-title">Photo-first — no database scrolling</div>
                <p className="feature-desc">Snap any meal and AI identifies every ingredient, estimates the portion size, and returns the macros. Takes about 3 seconds. No searching, no typing, no giving up.</p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <div className="feature-body">
                <div className="feature-title">Stacy&apos;s coaching note — every time</div>
                <p className="feature-desc">Every result includes a 2–3 sentence note written in Stacy&apos;s voice. Goal-aware, never shame-based, always specific. Like texting your PT about what you just ate.</p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <div className="feature-body">
                <div className="feature-title">Protein focus scoring</div>
                <p className="feature-desc">Every meal gets a simple protein verdict — great / could be higher / low. Because protein is the one thing Stacy&apos;s clients consistently under-hit, and the one thing that makes the biggest difference.</p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <div className="feature-body">
                <div className="feature-title">Daily macro running total</div>
                <p className="feature-desc">Your meal log shows running totals for the day — total kcal, total protein, total carbs, total fat. Clean, simple. No overwhelm. You see exactly where you stand without a spreadsheet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VS COMPETITORS */}
      <section id="vs" className="section-mid" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow">Why Munch Snapper</span>
          <h2 className="vs-headline">Every other app gives you<br />numbers. We give you <span style={{color: 'var(--magenta)'}}>coaching.</span></h2>
          <div style={{overflowX: 'auto'}}>
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
                <tr className="snap-row">
                  <td>Photo macro analysis</td>
                  <td className="col-snap check">✓ Claude AI</td>
                  <td className="partial">~ Basic</td>
                  <td className="check">✓ Good</td>
                  <td className="cross">✗ None</td>
                </tr>
                <tr className="snap-row">
                  <td>Coaching voice on every result</td>
                  <td className="col-snap check">✓ Stacy&apos;s words</td>
                  <td className="cross">✗</td>
                  <td className="cross">✗</td>
                  <td className="cross">✗</td>
                </tr>
                <tr className="snap-row">
                  <td>Motivating coaching tone</td>
                  <td className="col-snap check">✓ Warm &amp; empowering</td>
                  <td className="cross">✗ Generic</td>
                  <td className="cross">✗ Generic</td>
                  <td className="cross">✗ Clinical</td>
                </tr>
                <tr className="snap-row">
                  <td>Goal-aware output</td>
                  <td className="col-snap check">✓ Fat loss / Maintain / Build</td>
                  <td className="partial">~ Basic</td>
                  <td className="cross">✗</td>
                  <td className="check">✓ Advanced</td>
                </tr>
                <tr className="snap-row">
                  <td>Connected to coaching ecosystem</td>
                  <td className="col-snap check">✓ Yes</td>
                  <td className="cross">✗</td>
                  <td className="cross">✗</td>
                  <td className="partial">~ Workout bolt-on</td>
                </tr>
                <tr className="snap-row">
                  <td>UK price</td>
                  <td className="col-snap check" style={{color: '#4ade80', fontWeight: 700}}>£5.99/mo</td>
                  <td>~£16/mo</td>
                  <td>~£7/mo</td>
                  <td>~£9.50/mo</td>
                </tr>
                <tr className="snap-row">
                  <td>Free entry point</td>
                  <td className="col-snap check">✓ 3 free snaps</td>
                  <td className="partial">~ Capped at 5 foods/day</td>
                  <td className="check">✓ Yes</td>
                  <td className="cross">✗ No free tier</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section id="proof" className="section-light" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow" style={{color: 'var(--magenta)'}}>Real results</span>
          <h2 className="proof-headline">What happens when tracking<br />actually feels easy.</h2>
          <div className="testimonials">
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-quote">&quot;I&apos;ve tried every tracking app going. This is the first one where I actually look forward to logging a meal — Stacy&apos;s note makes you feel like you&apos;re doing the right thing, not just filling in a spreadsheet.&quot;</p>
              <div className="testimonial-author">Sarah M.</div>
              <div className="testimonial-handle">Mum of two, fat loss phase</div>
            </div>
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-quote">&quot;I went from not tracking at all to logging every meal. The photo thing is the reason — I genuinely can&apos;t be bothered with a food database but I can snap a picture. My protein has gone up by about 30g a day since I started.&quot;</p>
              <div className="testimonial-author">Priya K.</div>
              <div className="testimonial-handle">Online client, building phase</div>
            </div>
            <div className="testimonial">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-quote">&quot;The coaching note is what got me. Other apps just show you numbers. This one tells you what to do with them — and it sounds like Stacy actually cares, not like a chatbot.&quot;</p>
              <div className="testimonial-author">Claire R.</div>
              <div className="testimonial-handle">App Membership subscriber</div>
            </div>
          </div>
          <div className="stat-row">
            <div className="stat-box">
              <div className="stat-val">3s</div>
              <div className="stat-label">Average time from photo to results</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">+31g</div>
              <div className="stat-label">Average daily protein increase in first 4 weeks</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">94%</div>
              <div className="stat-label">Of users log more consistently than with other apps</div>
            </div>
          </div>
        </div>
      </section>

      {/* STACY SECTION */}
      <section id="stacy" className="section-dark" style={{padding: '6rem 0'}}>
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
                <p>I started my fitness journey as a 4&apos;11&quot; flat-footed woman in my late 20s with no athletic background. I know exactly what it feels like to not trust what you&apos;re eating, wonder if you&apos;re doing it right, and feel like the numbers never add up.</p>
                <p>Every coaching note inside Munch Snapper is written the way I&apos;d speak to a real client. No shame. No clinical jargon. Just honest, specific guidance that tells you what to do next — not just what the numbers are.</p>
                <p>As a 37-year-old mum to a neurodiverse child, juggling work, life, and everything in between — I built this for women like us. Because tracking your food shouldn&apos;t feel like another thing on the to-do list.</p>
              </div>
              <div style={{marginTop: '2rem'}}>
                <a href="https://www.youtube.com/@stacykundu" target="_blank" rel="noopener" style={{color: 'var(--magenta)', fontSize: '14px', fontWeight: 600, textDecoration: 'none'}}>Watch Stacy use it on YouTube →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section-light" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow">Pricing</span>
          <h2 className="pricing-headline">No lock-ins. No nonsense.</h2>
          <p className="pricing-sub">Start free. Pay only when you&apos;re ready. Less than a coffee a month.</p>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-name">Free intro</div>
              <div className="price-amount"><span className="currency">£</span>0</div>
              <div className="price-period">to get started</div>
              <div className="price-tagline">Try it — no card needed.</div>
              <ul className="price-features">
                <li>3 free meal snaps</li>
                <li>Full macro breakdown</li>
                <li>Stacy&apos;s coaching note</li>
                <li>No card required</li>
              </ul>
              <Link href="/sign-up" className="btn-outline-magenta price-cta">Start free</Link>
            </div>
            <div className="price-card featured">
              <div className="featured-badge">Most popular</div>
              <div className="price-name">Monthly</div>
              <div className="price-amount"><span className="currency">£</span>5.99</div>
              <div className="price-period">per month — cancel anytime</div>
              <div className="price-tagline">Less than a coffee. Unlimited snaps.</div>
              <ul className="price-features">
                <li>Unlimited meal snaps</li>
                <li>Full macro breakdown every time</li>
                <li>Stacy&apos;s goal-aware coaching note</li>
                <li>Daily macro running total</li>
                <li>Full meal log history</li>
                <li>Protein focus scoring</li>
              </ul>
              <Link href="/subscribe" className="btn-primary price-cta">Get started — £5.99/mo</Link>
            </div>
            <div className="price-card">
              <div className="price-name">Annual</div>
              <div className="price-amount"><span className="currency">£</span>49.99</div>
              <div className="price-period">per year — save £21.89</div>
              <div className="price-tagline">£4.17/month. Save 31%.</div>
              <ul className="price-features">
                <li>Everything in Monthly</li>
                <li>Best value — save 31%</li>
                <li>Priority feature updates</li>
              </ul>
              <Link href="/subscribe?annual=true" className="btn-outline-magenta price-cta">Get annual — £49.99/yr</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-dark" style={{padding: '6rem 0'}}>
        <div className="container">
          <span className="eyebrow">Got questions?</span>
          <h2 className="faq-headline">We&apos;ve got answers.</h2>
          <div className="faq-list">
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">How accurate is the photo macro analysis? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">The analysis uses Claude AI&apos;s vision model to identify ingredients and estimate portions. It won&apos;t be perfect — no photo-based tool is — but it&apos;s consistent and directionally accurate, which is what matters for building sustainable habits. For tracking purposes, being consistently close is more useful than being occasionally exact.</div>
            </div>
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">Does it work with home-cooked meals and UK foods? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">Yes — that&apos;s actually where it works best. Unlike database-based apps that struggle with anything home-cooked, photo analysis works regardless of what&apos;s on the plate. UK foods, family dinners, restaurant meals, batch-cooked prep — it handles all of it.</div>
            </div>
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">Is this separate from the Metaburn app? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">Munch Snapper is a completely standalone product — no Metaburn subscription needed. It works on its own for anyone who wants quick, accurate macro tracking from a photo. If you are also a Metaburn app subscriber, you can add Munch Snapper as a bolt-on and receive 30% off your monthly or annual plan. Details available inside the Metaburn app.</div>
            </div>
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">What is Stacy&apos;s coaching note exactly? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">Every meal result includes a 2–3 sentence note written in Stacy&apos;s voice. It&apos;s goal-aware — so a fat-loss client and a building client get different commentary on the same meal. It&apos;s specific (it references your actual protein number, not a generic target), and it never shames. Think of it as a quick message from your PT every time you log.</div>
            </div>
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">Can I cancel at any time? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">Yes — monthly subscribers can cancel at any time with no questions asked. Annual subscribers can cancel before renewal. There are no lock-ins or minimum commitments on Munch Snapper.</div>
            </div>
            <div className="faq-item">
              <button className="faq-q" aria-expanded="false">I already use MyFitnessPal — why switch? <span className="faq-arrow">&#8964;</span></button>
              <div className="faq-a">If you love database logging and stick to it consistently, keep going — it&apos;s working. But if you&apos;ve ever skipped logging because it felt like too much effort, or felt nothing when you got your daily summary, Munch Snapper is worth trying. It&apos;s faster for home-cooked meals, cheaper than MFP Premium, and the coaching note makes you feel like someone actually looked at what you ate.</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="final-cta" className="section-dark">
        <div className="container" style={{textAlign: 'center'}}>
          <span className="eyebrow">Ready?</span>
          <h2 className="final-headline">Stop guessing.<br />Start <span style={{color: 'var(--magenta)'}}>knowing.</span></h2>
          <p className="final-sub">Three free snaps. No card. No commitment. See what you&apos;ve been missing.</p>
          <div className="final-ctas">
            <Link href="/sign-up" className="btn-primary" style={{fontSize: '16px', padding: '14px 32px'}}>Start for free — 3 snaps on us</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-brand">
          <div>
            <strong>Munch Snapper</strong> &nbsp;·&nbsp; © 2026 Stacy Kundu. All rights reserved.
          </div>
          <div style={{marginTop: '0.5rem'}}>
            Questions? Contact us at <a href="mailto:hello@munchsnapper.com" style={{color: 'var(--magenta)', textDecoration: 'none', fontWeight: 600}}>hello@munchsnapper.com</a>
          </div>
        </div>
        <ul className="footer-links">
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
          <li><a href="mailto:hello@munchsnapper.com">Contact</a></li>
        </ul>
      </footer>
    </>
  );
}
