import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  createOrderFactory,
  STAGE_NAMES,
  STAGE_OF,
  type SceneApi,
  type SceneItem,
  type SceneStatus,
} from '../../lib/orderFactoryScene';
import { OrderRatingDialog, type RatingSubmit } from './OrderRatingDialog';

/**
 * NNORTE - Live Order Progress (mesin 3D) untuk pelanggan.
 * Posisi kartu murni mengikuti prop `status` (dari database). Tidak ada timer yang memajukan tahap.
 * Klik kartu = detail item. Setelah pesanan selesai, pelanggan bisa memberi rating (disimpan lewat `onRate`).
 */
export type { SceneItem, SceneStatus };

export interface TrackItem extends SceneItem {
  orderItemId: string;
  kind: 'food' | 'drink';
  note?: string;
  /** Rating yang sudah tersimpan di database (1-5) atau null. */
  rating: number | null;
}

const MESSAGES: Record<SceneStatus, string> = {
  pending_payment: 'Menunggu konfirmasi dari kasir',
  received: 'Pesanan diterima, sedang diteruskan ke dapur',
  preparing: 'Pesanan sedang disiapkan oleh tim dapur',
  ready: 'Pesanan kamu sudah siap',
  serving: 'Pesanan sedang diantarkan ke mejamu',
  completed: 'Pesanan selesai. Selamat menikmati hidangan!',
  cancelled: 'Pesanan dibatalkan',
  payment_failed: 'Pembayaran gagal',
};

const CHIP_NAMES = ['Diterima', 'Dimasak', 'Siap', 'Diantar', 'Selesai'];

function itemStatusLine(status: SceneStatus, kind: TrackItem['kind']): [string, boolean] {
  switch (status) {
    case 'pending_payment': return ['Menunggu pembayaran dikonfirmasi', false];
    case 'received': return ['Pesanan masuk, menunggu dapur memulai', false];
    case 'preparing': return [kind === 'drink' ? 'Sedang diracik oleh barista' : 'Sedang dimasak oleh dapur', true];
    case 'ready': return ['Sudah siap, menunggu diantar', false];
    case 'serving': return ['Sedang diantar ke mejamu', false];
    case 'completed': return ['Sudah diterima', false];
    case 'cancelled': return ['Pesanan dibatalkan', false];
    default: return ['Pembayaran gagal', false];
  }
}

export type OrderFactory3DProps = {
  status: SceneStatus;
  items: TrackItem[];
  orderNumber: string;
  tableLabel?: string; // contoh: "MEJA 12"
  branchName?: string;
  height?: number | string;
  className?: string;
  /** Rating keseluruhan yang sudah tersimpan (1-5) atau null. */
  orderRating?: number | null;
  /** Ulasan keseluruhan yang sudah tersimpan. */
  orderReview?: string | null;
  /** Simpan rating ke database. Harus melempar error bila gagal. */
  onRate?: (ratings: RatingSubmit[]) => Promise<void>;
  /** Dipanggil saat pengguna menekan "Tambah pesanan lain" di layar terimakasih. */
  onRateDone?: () => void;
};

export function OrderFactory3D({
  status,
  items,
  orderNumber,
  tableLabel,
  branchName,
  height = '100vh',
  className,
  orderRating = null,
  orderReview = null,
  onRate,
  onRateDone,
}: OrderFactory3DProps) {
  const { theme } = useTheme();
  const sceneRef = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const first = useRef(true);
  const statusRef = useRef(status);
  const themeRef = useRef(theme);
  statusRef.current = status;
  themeRef.current = theme;
  const [error, setError] = useState(false);
  const [running, setRunning] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  
  const stage = STAGE_OF[status] ?? -1;
  const itemKey = items.map((i) => `${i.id}:${i.qty}:${i.imageUrl ?? ''}`).join('|');
  const unrated = items.filter((i) => i.rating == null);
  const allRated = orderRating != null && unrated.length === 0;
  const canRate = !!onRate && status === 'completed' && items.length > 0 && !allRated;

  // Scene dibuat ulang hanya jika daftar item berubah, bukan saat status berubah.
  useEffect(() => {
    setError(false);
    const el = sceneRef.current;
    if (!el) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      try {
        api.current = createOrderFactory(el, {
          items, status: statusRef.current, theme: themeRef.current === 'dark' ? 'dark' : 'light', tableLabel,
          fontFamily: getComputedStyle(el).fontFamily,
          onStageLabel: (i, x, y, vis) => {
            const n = labelRefs.current[i];
            if (n) { n.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; n.style.opacity = vis ? '1' : '0'; }
          },
          onRunning: setRunning,
          onCardClick: (id) => setDetailId(id),
        });
      } catch { setError(true); }
    });
    return () => { cancelled = true; api.current?.dispose(); api.current = null; first.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, tableLabel]);

  // Perubahan status dari database -> kartu berjalan ke tahap baru.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    api.current?.setStatus(status);
  }, [status]);

  // Tema global berubah -> warna scene berubah halus (tanpa membuat ulang scene).
  useEffect(() => { api.current?.setTheme(theme === 'dark' ? 'dark' : 'light'); }, [theme]);

  useEffect(() => { api.current?.selectItem(detailId); }, [detailId]);
  useEffect(() => {
    if (!detailId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetailId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId]);

  // Status keluar dari "selesai" -> tutup dialog.
  useEffect(() => { if (status !== 'completed') { setRateOpen(false); } }, [status]);

  // Pesanan yang dilacak berganti -> dialog rating lama tidak boleh menempel.
  useEffect(() => { setRateOpen(false); }, [orderNumber]);

  // Handler rating sementara tidak tersedia (mis. rating dimuat ulang) ->
  // jangan biarkan dialog terbuka kembali tiba-tiba saat handler tersedia lagi.
  useEffect(() => { if (!onRate) setRateOpen(false); }, [onRate]);

  const closeRate = useCallback(() => { setRateOpen(false); }, []);
  const detail = items.find((i) => i.id === detailId) ?? null;
  const dialogOpen = !!onRate && rateOpen;
  const failed = status === 'cancelled' || status === 'payment_failed';
  const [line, hot] = detail ? itemStatusLine(status, detail.kind) : ['', false];
  const targets = useMemo(() => items.map((i) => ({
    orderItemId: i.orderItemId, name: i.name, qty: i.qty, emoji: i.kind === 'drink' ? '🥤' : '🍽️', imageUrl: i.imageUrl, saved: i.rating != null, rating: i.rating,
  })), [items]);

  return (
    <div className={['nn-factory', className].filter(Boolean).join(' ')} style={{ height }}>
      <style>{CSS}</style>
      <div ref={sceneRef} className="nn-scene" role="img"
        aria-label={`Pesanan ${orderNumber}: ${MESSAGES[status]}. Seret untuk memutar, cubit untuk zoom, ketuk kartu untuk detail.`} />

      <header className="nn-top">
        <div>
          <strong>Pesanan #{orderNumber}</strong>
          <small>{[branchName, tableLabel].filter(Boolean).join(' · ')}</small>
        </div>
      </header>

      {stage >= 0 && CHIP_NAMES.map((n, i) => (
        <div key={n} ref={(el) => { labelRefs.current[i] = el; }} title={STAGE_NAMES[i]}
          className={`nn-chip ${i === stage ? 'on' : i < stage ? 'done' : ''}`}>
          <b>{i < stage ? '✓' : i + 1}</b>{n}
        </div>
      ))}

      <div className={`nn-status ${failed ? 'bad' : ''}`} role="status" aria-live="polite">
        <strong key={status}>{MESSAGES[status]}</strong>
        {stage >= 0 && <div className="nn-bar" aria-hidden="true"><i style={{ width: `${(stage / 4) * 100}%` }} /></div>}
        {stage >= 0 && (
          <small>
            {running && status !== 'completed' && status !== 'cancelled'
              ? '⚙ Mesin berjalan, pesanan sedang dipindahkan…'
              : `Tahap ${stage + 1} dari 5 · ${STAGE_NAMES[stage]}`}
          </small>
        )}
        {orderRating != null && (
          <small className="nn-muted">Rating kamu: {'★'.repeat(orderRating)}{'☆'.repeat(5 - orderRating)}</small>
        )}
        {allRated && <small className="nn-muted">✓ Rating terkirim</small>}
        {canRate && !dialogOpen && (
          <button type="button" className="nn-link" onClick={() => setRateOpen(true)}>
            {orderRating == null ? 'Beri rating' : 'Lengkapi rating item'}
          </button>
        )}
      </div>

      {detail && (
        <aside className="nn-detail" aria-label={`Detail ${detail.name}`}>
          <button type="button" className="nn-x" aria-label="Tutup detail" onClick={() => setDetailId(null)}>×</button>
          <div className="nn-row">
            <span className="nn-em big" aria-hidden="true">{detail.imageUrl ? <img src={detail.imageUrl} alt="" /> : detail.kind === 'drink' ? '🥤' : '🍽️'}</span>
            <div className="nn-grow"><strong>{detail.name}</strong><span className="nn-muted">Jumlah: {detail.qty}</span></div>
          </div>
          <p className={`nn-is ${hot ? 'hot' : ''}`}><i />{line}</p>
          {detail.note && <p className="nn-muted">Catatan: {detail.note}</p>}
          {stage >= 0 && <p className="nn-muted">Tahap {stage + 1} dari 5 · {STAGE_NAMES[stage]}</p>}
          {detail.rating != null && <p className="nn-muted">Rating kamu: {'★'.repeat(detail.rating)}{'☆'.repeat(5 - detail.rating)}</p>}
          <p className="nn-fine">Status berlaku untuk seluruh pesanan.</p>
        </aside>
      )}

      {dialogOpen && onRate && (
        <OrderRatingDialog
          targets={targets}
          orderNumber={orderNumber}
          orderRating={orderRating}
          orderReview={orderReview}
          onSubmit={onRate}
          onDone={
            onRateDone
              ? () => {
                  closeRate();
                  onRateDone();
                }
              : undefined
          }
          onClose={closeRate}
        />
      )}

      {error && (
        <div className="nn-err" role="alert">
          <p>Tampilan 3D tidak bisa dimuat. Pastikan WebGL aktif di browser. Status pesanan tetap diperbarui di bawah.</p>
          {canRate && !dialogOpen && (
            <button type="button" className="nn-link" onClick={() => setRateOpen(true)}>
              {orderRating == null ? 'Beri rating' : 'Lengkapi rating item'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Warna memakai token tema global (--c-*), sehingga ikut berubah saat tema berganti.
const CSS = `
.nn-factory{position:relative;width:100%;overflow:hidden;background:var(--c-bg);color:var(--c-text);font-family:var(--font-sans);font-size:13px;contain:layout;transition:background-color .6s,color .6s}
.nn-factory *{box-sizing:border-box}
.nn-scene{position:absolute;inset:0}
.nn-top{position:absolute;top:18px;left:20px;right:20px;pointer-events:none}
.nn-top strong{display:block;font-size:15px;font-weight:600}
.nn-top small{color:var(--c-muted);font-size:12px}
.nn-chip{position:absolute;left:0;top:0;opacity:0;pointer-events:none;white-space:nowrap;padding:5px 9px;border-radius:8px;background:color-mix(in srgb,var(--c-surface) 88%,transparent);border:1px solid var(--c-border);color:var(--c-muted);font-size:11px;display:flex;gap:6px;align-items:center;transition:opacity .3s,border-color .4s,color .4s}
.nn-chip b{font-weight:700;color:var(--c-red)}
.nn-chip.on{border-color:var(--c-red);color:var(--c-text)}
.nn-chip.done{color:var(--c-text-soft)}
.nn-status{position:absolute;left:14px;right:14px;bottom:16px;max-width:520px;margin:0 auto;padding:11px 15px;border-radius:12px;background:color-mix(in srgb,var(--c-surface) 92%,transparent);border:1px solid var(--c-border);backdrop-filter:blur(12px)}
.nn-status.bad{border-color:var(--c-red)}
.nn-status strong{display:block;font-size:14px;animation:nn-in .5s ease-out}
.nn-status small{display:block;margin-top:6px;color:var(--c-muted);font-size:11px}
.nn-bar{height:3px;margin-top:9px;border-radius:2px;background:var(--c-border)}
.nn-bar i{display:block;height:100%;border-radius:2px;background:var(--c-red);transition:width 1.2s cubic-bezier(.22,1,.36,1)}
.nn-link{margin-top:8px;border:0;background:none;color:var(--c-blue);font:inherit;font-weight:600;cursor:pointer;padding:6px 0;min-height:32px}
.nn-factory button:focus-visible,.nn-factory textarea:focus-visible{outline:2px solid var(--c-blue);outline-offset:2px}
.nn-err{position:absolute;left:20px;right:20px;top:38%;padding:16px;border-radius:12px;background:var(--c-surface);border:1px solid var(--c-red);text-align:center;line-height:1.6}
.nn-detail{position:absolute;top:60px;right:16px;width:min(290px,calc(100% - 32px));padding:14px 16px;border-radius:14px;background:color-mix(in srgb,var(--c-surface) 94%,transparent);border:1px solid var(--c-border);backdrop-filter:blur(14px);box-shadow:0 14px 36px #0003;z-index:5;animation:nn-side .4s cubic-bezier(.22,1,.36,1)}
.nn-x{position:absolute;top:4px;right:6px;border:0;background:none;color:var(--c-muted);font-size:24px;line-height:1;cursor:pointer;width:36px;height:36px}
.nn-row{display:flex;gap:12px;align-items:center}
.nn-grow{flex:1;min-width:0}.nn-grow strong{display:block;font-size:14px;margin-bottom:2px}
.nn-em{width:48px;height:48px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:26px;background:var(--c-surface-2);overflow:hidden}
.nn-em img{width:100%;height:100%;object-fit:cover}.nn-em.big{width:60px;height:60px;font-size:32px}
.nn-muted{display:block;color:var(--c-muted);margin:6px 0 0;font-size:12px}
.nn-is{display:flex;align-items:center;gap:8px;margin:12px 0 6px;font-weight:600}
.nn-is i{width:9px;height:9px;border-radius:50%;background:var(--c-subtle);flex:none}
.nn-is.hot i{background:var(--c-red);animation:nn-blink 1s ease-in-out infinite}
.nn-fine{font-size:11px;color:var(--c-subtle);margin:8px 0 0}
.nnr{position:absolute;left:50%;bottom:12px;width:min(440px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;transform:translateX(-50%);padding:18px;border-radius:16px;background:color-mix(in srgb,var(--c-surface) 96%,transparent);border:1px solid var(--c-border);backdrop-filter:blur(16px);box-shadow:0 20px 50px #0004;z-index:6;animation:nn-up .55s cubic-bezier(.22,1,.36,1);outline:none}
.nnr h2{margin:0 0 10px;font-size:17px}
.nnr ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.nnr .nnr-muted{color:var(--c-muted);margin:0 0 10px}
.nnr-row{display:flex;gap:12px;align-items:center}
.nnr-em{width:48px;height:48px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:26px;background:var(--c-surface-2);overflow:hidden}
.nnr-em img{width:100%;height:100%;object-fit:cover}
.nnr-grow{flex:1;min-width:0}.nnr-grow strong{display:block;font-size:13px;margin-bottom:2px}
.nnr-ok{font-size:11px;color:var(--c-blue);font-weight:600;white-space:nowrap}
.nnr-stars{display:flex;gap:0}
.nnr-stars button{border:0;background:none;padding:4px;min-width:36px;min-height:36px;color:var(--c-subtle);cursor:pointer;border-radius:6px;transition:transform .15s,color .2s}
.nnr-stars button:hover:not(:disabled){transform:scale(1.15)}
.nnr-stars button.on{color:var(--c-warning)}.nnr-stars button.on svg{animation:nn-pop .35s cubic-bezier(.3,1.6,.5,1)}
.nnr-stars button:disabled{cursor:default}.nnr-stars svg{display:block}
.nnr textarea{width:100%;margin-top:8px;padding:8px 10px;border-radius:10px;border:1px solid var(--c-border);background:transparent;color:inherit;font:inherit;resize:none}
.nnr-err{margin:6px 0 0;color:var(--c-error);font-size:12px}
.nnr-acts{display:flex;gap:8px;margin-top:14px}
.nnr-acts button{font:inherit;font-weight:600;border-radius:10px;padding:11px 16px;min-height:44px;cursor:pointer;transition:transform .12s,opacity .2s}
.nnr-acts .pri{flex:1;border:0;background:var(--c-red);color:var(--c-on-brand)}.nnr-acts .pri:active{transform:scale(.97)}
.nnr-acts .gh{border:1px solid var(--c-border);background:transparent;color:inherit}
.nnr-acts button:disabled{opacity:.45;cursor:not-allowed}
@keyframes nn-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes nn-side{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes nn-up{from{opacity:0;transform:translate(-50%,24px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes nn-blink{50%{opacity:.3}}
@keyframes nn-pop{0%{transform:scale(.6)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
@media (max-width:520px){.nn-chip:not(.on){display:none}}
@media (prefers-reduced-motion:reduce){.nn-factory *{animation:none!important;transition-duration:1ms!important}}
`;
