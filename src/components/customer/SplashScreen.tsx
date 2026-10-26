import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  /** Langkah pemuatan nyata: jumlah selesai dari total (null = tidak diketahui -> indikator tak tentu). */
  progress: { done: number; total: number } | null;
  /** true bila data siap; splash menutup setelah transisi logo. */
  ready: boolean;
  error: string | null;
  onRetry: () => void;
  onFinish: () => void;
}

const MIN_BOWL_MS = 1200; // animasi mangkuk tidak dipotong saat data sangat cepat
const LOGO_MS = 900;

/**
 * Splash portal pelanggan: mangkuk mi digambar lewat stroke-dasharray, progress bar mengikuti
 * langkah pemuatan nyata, lalu transisi ke logo NNORTE Coffee & Hangout. Hormati prefers-reduced-motion.
 */
export const SplashScreen: React.FC<Props> = ({ progress, ready, error, onRetry, onFinish }) => {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [minElapsed, setMinElapsed] = useState(!!reduced);
  const [showLogo, setShowLogo] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setMinElapsed(true), MIN_BOWL_MS);
    return () => window.clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (!ready || !minElapsed || error) return;
    setShowLogo(true);
    const t1 = window.setTimeout(() => setLeaving(true), reduced ? 150 : LOGO_MS);
    const t2 = window.setTimeout(onFinish, reduced ? 250 : LOGO_MS + 300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ready, minElapsed, error, reduced, onFinish]);

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;

  return (
    <main
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-nnorte-bg px-6 text-nnorte-text transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      aria-label="Memuat NNORTE Coffee & Hangout"
      aria-busy={!error && !showLogo}
    >
      {showLogo ? (
        <div className="nn-fade flex flex-col items-center gap-4 text-center">
          <img src="/nnorte-logo.svg" alt="NNORTE Coffee & Hangout" className="h-40 w-40 sm:h-52 sm:w-52" />
          <p className="text-sm font-semibold tracking-wide text-nnorte-muted">Selamat datang</p>
        </div>
      ) : (
        <>
          <svg viewBox="0 0 200 160" className="h-36 w-44 text-nnorte-red sm:h-44 sm:w-56" role="img" aria-label="Mangkuk mi" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path className="nn-splash-steam" style={{ ['--d' as string]: '0s' }} d="M78 38c8-9-7-14 2-24" strokeWidth="4" />
            <path className="nn-splash-steam" style={{ ['--d' as string]: '0.35s' }} d="M100 38c8-9-7-14 2-24" strokeWidth="4" />
            <path className="nn-splash-steam" style={{ ['--d' as string]: '0.7s' }} d="M122 38c8-9-7-14 2-24" strokeWidth="4" />
            <path className="nn-splash-stroke" style={{ ['--len' as string]: 330, ['--d' as string]: '0s' }} d="M28 70h144c0 40-26 70-72 70s-72-30-72-70z" />
            <path className="nn-splash-stroke" style={{ ['--len' as string]: 150, ['--d' as string]: '0.4s' }} d="M62 150h76" />
            <path className="nn-splash-stroke" style={{ ['--len' as string]: 180, ['--d' as string]: '0.6s' }} d="M50 84c12 10 24-10 36 0s24-10 36 0 24-10 28 0" strokeWidth="4" />
            <path className="nn-splash-stroke" style={{ ['--len' as string]: 120, ['--d' as string]: '0.8s' }} d="M140 56l34-34M152 62l30-26" strokeWidth="4" />
          </svg>

          {error ? (
            <div role="alert" className="max-w-xs space-y-3 text-center">
              <p className="text-sm text-nnorte-text">{error}</p>
              <button type="button" onClick={onRetry} className="nn-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-nnorte-red px-5 py-2 text-xs font-semibold text-nnorte-on-brand">
                <RefreshCw size={14} aria-hidden="true" /> Coba lagi
              </button>
            </div>
          ) : (
            <div className="w-56 space-y-2 text-center">
              <div
                className="relative h-1.5 w-full overflow-hidden rounded-full bg-nnorte-border"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct ?? undefined}
                aria-label="Kemajuan pemuatan"
              >
                {pct === null ? (
                  <div className="nn-splash-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-nnorte-red" />
                ) : (
                  <div className="h-full rounded-full bg-nnorte-red transition-[width] duration-300" style={{ width: `${pct}%` }} />
                )}
              </div>
              <p className="text-xs text-nnorte-muted">Menyiapkan menu untuk Anda…</p>
            </div>
          )}
        </>
      )}
    </main>
  );
};
