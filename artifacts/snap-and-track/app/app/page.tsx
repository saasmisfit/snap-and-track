'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import UpsellBanner from '../components/UpsellBanner';

const FREE_SNAP_LIMIT = 3;
const FREE_SNAP_KEY = 'snaptrack_free_count';

type Goal = 'fat_loss' | 'maintain' | 'build';

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

export default function SnapAndTrackApp() {
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

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

  function pickFile() {
    fileInputRef.current?.click();
  }

  function pickCamera() {
    cameraInputRef.current?.click();
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
    acceptFile(f);
  }

  function reset(keepGoal = true) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setIsAnalysing(false);
    if (!keepGoal) setGoal('fat_loss');
  }

  async function analyse() {
    if (!file) return;
    // Hard gate — if free quota is used up, do not call the API
    if (snapCount !== null && snapCount >= FREE_SNAP_LIMIT) return;
    setIsAnalysing(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: file.type, goal }),
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

  function logMeal() {
    if (!result || justLogged) return;
    const entry = {
      id: Date.now().toString(),
      dish: result.dish,
      portion_estimate: result.portion_estimate,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      foods_identified: result.foods_identified,
      stacy_insight: result.stacy_insight,
      loggedAt: new Date().toISOString(),
    };
    try {
      const raw = window.localStorage.getItem('snaptrack_log');
      const existing: unknown = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(existing) ? existing : [];
      arr.push(entry);
      window.localStorage.setItem('snaptrack_log', JSON.stringify(arr));
    } catch {
      // best-effort: still flash the confirmation so the UI feels responsive
    }
    setJustLogged(true);
  }

  const canAnalyse = !!file && !isAnalysing && !result;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerMark} aria-hidden="true">
            📸
          </div>
          <div style={styles.headerTitleGroup}>
            <div style={styles.headerTitle}>Snap &amp; Track</div>
            <div style={styles.headerSub}>by Metaburn</div>
          </div>
          <Link href="/app/log" className="view-log-link">
            View log →
          </Link>
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
              </>
            ) : (
              <div style={styles.previewCard}>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name} style={styles.previewImg} />
                ) : null}
                <div style={styles.previewRow}>
                  <div style={styles.previewName} title={file.name}>
                    {file.name}
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
            {snapCount !== null && snapCount >= FREE_SNAP_LIMIT ? (
              <div style={styles.subscribeGate}>
                <div style={styles.gateTitle}>You&apos;ve used your 3 free snaps 🎉</div>
                <div style={styles.gateSub}>Subscribe for unlimited access — £4.99/month</div>
                <Link href="/subscribe" className="subscribe-cta">
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
                  {isAnalysing ? 'Analysing…' : 'Analyse my meal ✦'}
                </button>
                {snapCount === 1 || snapCount === 2 ? (
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
            <div style={styles.resultHeader}>
              <div style={styles.resultDish}>{result.dish}</div>
              <div style={styles.resultPortion}>{result.portion_estimate}</div>
            </div>

            <div style={styles.macroGrid}>
              <MacroTile label="Calories" value={fmtMacro(result.calories)} unit="kcal" accent />
              <MacroTile label="Protein" value={fmtMacro(result.protein_g)} unit="g" />
              <MacroTile label="Carbs" value={fmtMacro(result.carbs_g)} unit="g" />
              <MacroTile label="Fat" value={fmtMacro(result.fat_g)} unit="g" />
            </div>

            <div style={styles.sectionBlock}>
              <div style={styles.sectionLabel}>What I can see</div>
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
          color: ${COLOURS.textMuted};
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
      `}</style>

      <UpsellBanner />
    </main>
  );
}

function MacroTile({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: COLOURS.card,
        border: `1px solid ${COLOURS.border}`,
        borderRadius: 14,
        padding: '18px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: 36,
          lineHeight: 1,
          color: accent ? COLOURS.magenta : COLOURS.white,
        }}
      >
        {value}
      </div>
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
};
