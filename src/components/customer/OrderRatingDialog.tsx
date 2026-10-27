import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Star, X, BadgeCheck, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { MAX_RATING_REVIEW, type RatingSubmission } from '../../lib/ratings';
import type { PortalCompensationVoucher } from '../../lib/portalApi';

export type RatingSubmit = RatingSubmission;

export interface RatingTarget {
  orderItemId: string;
  name: string;
  emoji?: string;
  imageUrl?: string | null;
  qty?: number;
  /** Rating yang sudah tersimpan di database (1-5) atau null. */
  saved: boolean;
  rating: number | null;
}

interface OrderRatingDialogProps {
  targets: RatingTarget[];
  orderNumber?: string;
  orderRating?: number | null;
  orderReview?: string | null;
  /** Simpan rating ke database. Harus melempar error bila gagal. */
  compensation?: PortalCompensationVoucher | null;
  onSubmit: (ratings: RatingSubmit[]) => Promise<PortalCompensationVoucher | null>;
  /** Dipanggil saat pengguna menekan "Tambah pesanan lain" di layar terimakasih. */
  onDone?: () => void;
  onClose: () => void;
}

const RATING_LABELS = ['', 'Sangat buruk', 'Kurang', 'Cukup', 'Puas', 'Sangat puas'];
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function StarRating({
  value,
  onChange,
  disabled = false,
  label,
  size = 22,
}: {
  value: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  label: string;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = disabled ? value : hover || value;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= shown;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !disabled && setHover(star)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => !disabled && setHover(star)}
            onBlur={() => setHover(0)}
            aria-label={`${star} bintang`}
            aria-pressed={value === star}
            className={`nn-press flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nnorte-blue/60 ${
              disabled ? 'cursor-default' : 'cursor-pointer hover:bg-nnorte-surface-2'
            } ${active ? 'text-nnorte-warning' : 'text-nnorte-subtle/50'}`}
          >
            <Star size={size} className={active ? 'fill-current' : ''} aria-hidden="true" />
          </button>
        );
      })}
      <span className="ml-1.5 min-w-20 text-[10px] font-semibold text-nnorte-muted">
        {value > 0 ? RATING_LABELS[value] : 'Pilih bintang'}
      </span>
    </div>
  );
}

export function OrderRatingDialog({
  targets,
  orderNumber,
  orderRating = null,
  orderReview = null,
  compensation = null,
  onSubmit,
  onDone,
  onClose,
}: OrderRatingDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const reviewId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const downOnOverlay = useRef(false);
  const submitting = useRef(false);

  const overallSaved = orderRating != null;
  const unrated = targets.filter((target) => target.rating == null);
  const nothingToRate = overallSaved && unrated.length === 0;

  const [overall, setOverall] = useState(orderRating ?? 0);
  const [review, setReview] = useState(orderReview ?? '');
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [issuedVoucher, setIssuedVoucher] = useState<PortalCompensationVoucher | null>(compensation);

  const hasItemSelection = unrated.some((target) => (itemRatings[target.orderItemId] ?? 0) > 0);
  const remainingItemCount = unrated.filter((target) => (itemRatings[target.orderItemId] ?? 0) === 0).length;
  const canSubmit = !busy && !success && !nothingToRate && (overallSaved ? hasItemSelection : overall > 0);
  const thankYouStars = overallSaved ? (orderRating ?? 0) : overall;

  // Fokus awal + kembalikan fokus saat dialog ditutup.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  // Esc dan jebakan Tab. Fase capture + stopPropagation mencegah modal induk
  // ikut menutup saat pengguna menekan Esc di dialog rating.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => node.offsetParent !== null);
      event.stopPropagation();
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [busy, onClose]);

  const submit = async () => {
    if (submitting.current || !canSubmit) return;
    submitting.current = true;
    setBusy(true);
    setError(null);

    try {
      const payload: RatingSubmit[] = [];
      if (!overallSaved && overall > 0) {
        payload.push({ orderItemId: null, rating: overall, review: review.trim() || undefined });
      }
      for (const target of unrated) {
        const rating = itemRatings[target.orderItemId] ?? 0;
        if (rating > 0) payload.push({ orderItemId: target.orderItemId, rating });
      }
      if (payload.length === 0) throw new Error('Pilih minimal satu rating.');

      const voucher = await onSubmit(payload);
      if (voucher) setIssuedVoucher(voucher);
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Rating gagal dikirim. Coba lagi.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onPointerDown={(event) => {
        downOnOverlay.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && downOnOverlay.current && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-nnorte-border bg-nnorte-surface shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-nnorte-border bg-nnorte-sidebar px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold tracking-tight text-nnorte-text">Beri Rating</h2>
            <p id={descriptionId} className="mt-0.5 text-xs text-nnorte-muted">
              {orderNumber ? `Pesanan #${orderNumber}` : 'Nilai pengalaman pesanan Anda.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup rating"
            className="nn-press flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {success ? (
            <div className="relative isolate -mx-5 -my-5 flex min-h-[min(680px,72dvh)] flex-col items-center overflow-hidden bg-nnorte-bg px-5 pb-5 pt-7 text-center sm:min-h-[min(720px,78dvh)] sm:px-8" role="status" aria-live="polite">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <span className="absolute -left-10 top-[38%] h-28 w-28 rounded-full border border-nnorte-border/70" />
                <span className="absolute -right-12 top-[20%] h-36 w-36 rounded-full border border-nnorte-border/70" />
                <span className="absolute bottom-24 right-0 h-px w-1/3 bg-nnorte-border" />
                <span className="absolute bottom-16 right-0 h-px w-1/2 bg-nnorte-border/70" />
                <Sparkles className="absolute left-[15%] top-[17%] h-4 w-4 text-nnorte-red/70" />
                <Sparkles className="absolute right-[17%] top-[24%] h-3 w-3 text-nnorte-blue" />
                <span className="absolute left-[22%] top-[28%] h-2 w-2 rounded-full bg-nnorte-red/70" />
                <span className="absolute right-[22%] top-[34%] h-2 w-2 rounded-full bg-nnorte-blue/70" />
              </div>
              <div className="relative mt-3 flex h-44 w-44 items-center justify-center sm:mt-5 sm:h-52 sm:w-52">
                <div className="absolute inset-3 rounded-[2.5rem] bg-gradient-to-br from-nnorte-blue via-nnorte-red to-nnorte-red shadow-xl shadow-nnorte-blue/20" style={{ clipPath: 'polygon(50% 0%,61% 8%,75% 3%,82% 15%,96% 22%,92% 38%,100% 50%,92% 62%,96% 78%,82% 85%,75% 97%,61% 92%,50% 100%,39% 92%,25% 97%,18% 85%,4% 78%,8% 62%,0% 50%,8% 38%,4% 22%,18% 15%,25% 3%,39% 8%)' }} />
                <div className="absolute inset-7 flex items-center justify-center rounded-full border-[5px] border-nnorte-blue/90 bg-nnorte-surface/80 shadow-inner">
                  <BadgeCheck size={92} strokeWidth={1.6} className="text-nnorte-blue drop-shadow-md" aria-hidden="true" />
                </div>
                <div className="absolute -bottom-1 flex items-center gap-1" role="img" aria-label={`Rating keseluruhan ${thankYouStars} dari 5 bintang`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={29} aria-hidden="true" className={`${star <= thankYouStars ? 'fill-current text-nnorte-warning' : 'fill-nnorte-surface text-nnorte-subtle/60'} drop-shadow-md`} />
                  ))}
                </div>
              </div>
              <h3 className="mt-12 max-w-sm text-3xl font-black leading-tight tracking-tight text-nnorte-text sm:mt-14 sm:text-4xl">Terimakasih<br />sudah memesan</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-nnorte-muted">
                {thankYouStars > 0 ? `Rating ${thankYouStars}/5 terkirim. ` : 'Rating terkirim. '}
                Penilaian Anda membantu kami menjaga kualitas pesanan.
              </p>
              {/* Spacer menempatkan tombol seperti kartu konfirmasi pada referensi. */}
              <div className="min-h-8 flex-1" />
              {/* Rating bintang yang dikirim tetap terlihat sebagai indikator. */}
              <div
                className="sr-only"
                role="img"
                aria-label={`Rating keseluruhan ${thankYouStars} dari 5 bintang`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={26}
                    aria-hidden="true"
                    className={star <= thankYouStars ? 'fill-current text-nnorte-warning' : 'text-nnorte-subtle/50'}
                  />
                ))}
              </div>
              {thankYouStars > 0 && thankYouStars <= 2 && (
                <div className="mx-auto mb-4 mt-4 w-full max-w-sm rounded-2xl border border-nnorte-red/30 bg-nnorte-red/10 p-4 text-left">
                  <p className="text-sm font-bold text-nnorte-text">Maaf pengalaman Anda belum memuaskan.</p>
                  <p className="mt-1 text-xs leading-relaxed text-nnorte-muted">Kami akan meninjau masukan Anda. Sebagai permintaan maaf, gunakan kompensasi ini untuk pesanan berikutnya di cabang yang sama.</p>
                  {issuedVoucher ? (
                    <div className="mt-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-3 text-center">
                      <p className="text-xs font-bold text-nnorte-success">Diskon {issuedVoucher.discountPercent}% · maks. {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(issuedVoucher.maxDiscount)}</p>
                      <p className="mt-1 font-mono text-lg font-black tracking-wider text-nnorte-text">{issuedVoucher.code}</p>
                      <p className="text-[10px] text-nnorte-muted">Berlaku sampai {new Date(issuedVoucher.expiresAt).toLocaleDateString('id-ID')}</p>
                    </div>
                  ) : <p className="mt-2 text-xs text-nnorte-muted">Kode kompensasi sedang disiapkan. Buka kembali rating pesanan ini untuk melihatnya.</p>}
                </div>
              )}
              {onDone && (
                <Button className="mt-2 w-full rounded-full bg-gradient-to-r from-nnorte-blue to-nnorte-red py-3 text-base font-black text-white shadow-lg hover:opacity-95 sm:w-full" onClick={onDone}>
                  Tambah pesanan lain
                </Button>
              )}
            </div>
          ) : nothingToRate ? (
            <div className="py-6 text-center" role="status">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-nnorte-success/15 text-nnorte-success">
                <Check size={28} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-bold text-nnorte-text">Rating sudah lengkap</h3>
              <p className="mt-1 text-xs leading-relaxed text-nnorte-muted">
                Semua rating untuk pesanan ini sudah terkirim.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-2xl border border-nnorte-border bg-nnorte-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-nnorte-text">Rating keseluruhan</h3>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-nnorte-muted">Bagaimana pengalaman pesanan Anda?</p>
                  </div>
                  {overallSaved && (
                    <span className="shrink-0 rounded-full border border-nnorte-success/30 bg-nnorte-success/10 px-2 py-0.5 text-[9px] font-bold text-nnorte-success">
                      Terkirim
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <StarRating
                    value={overallSaved ? (orderRating ?? 0) : overall}
                    onChange={overallSaved ? undefined : setOverall}
                    disabled={overallSaved || busy}
                    label="Rating keseluruhan"
                    size={24}
                  />
                </div>

                {overallSaved ? (
                  orderReview ? (
                    <p className="mt-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-3 text-xs leading-relaxed text-nnorte-text">
                      “{orderReview}”
                    </p>
                  ) : (
                    <p className="mt-3 text-[10px] text-nnorte-muted">Tanpa ulasan tertulis.</p>
                  )
                ) : (
                  <div className="mt-3">
                    <label htmlFor={reviewId} className="text-[10px] font-semibold text-nnorte-muted">
                      Ulasan (opsional)
                    </label>
                    <textarea
                      id={reviewId}
                      value={review}
                      onChange={(event) => setReview(event.target.value)}
                      maxLength={MAX_RATING_REVIEW}
                      rows={3}
                      disabled={busy}
                      placeholder="Ceritakan rasa, porsi, atau pelayanan…"
                      className="mt-1 w-full resize-none rounded-xl border border-nnorte-border bg-nnorte-input px-3 py-2 text-xs leading-relaxed text-nnorte-text placeholder:text-nnorte-muted focus:border-nnorte-blue focus:outline-none focus:ring-2 focus:ring-nnorte-blue/30 disabled:opacity-60"
                    />
                    <div className="mt-1 flex justify-between gap-2 text-[9px] text-nnorte-muted">
                      <span>Maksimal {MAX_RATING_REVIEW} karakter.</span>
                      <span>{review.length}/{MAX_RATING_REVIEW}</span>
                    </div>
                  </div>
                )}
              </section>

              {targets.length > 0 && (
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-nnorte-text">Rating item</h3>
                    <span className="text-[9px] font-semibold text-nnorte-muted">
                      {remainingItemCount} belum dinilai
                    </span>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {targets.map((target) => {
                      const saved = target.rating != null;
                      const value = saved ? (target.rating ?? 0) : (itemRatings[target.orderItemId] ?? 0);
                      return (
                        <li key={target.orderItemId} className="rounded-xl border border-nnorte-border bg-nnorte-surface p-3">
                          <div className="flex items-center gap-3">
                            {target.imageUrl ? (
                              <img
                                src={target.imageUrl}
                                alt=""
                                loading="lazy"
                                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                              />
                            ) : (
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-nnorte-surface-2 text-xl" aria-hidden="true">
                                {target.emoji || '🍽️'}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-nnorte-text">{target.name}</p>
                              <p className="mt-0.5 text-[10px] text-nnorte-muted">
                                {target.qty ? `${target.qty}× · ` : ''}
                                {saved ? 'Sudah dinilai' : value > 0 ? 'Akan dikirim' : 'Belum dinilai'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2">
                            <StarRating
                              value={value}
                              onChange={
                                saved
                                  ? undefined
                                  : (rating) => setItemRatings((current) => ({ ...current, [target.orderItemId]: rating }))
                              }
                              disabled={saved || busy}
                              label={`Rating ${target.name}`}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-nnorte-error/30 bg-nnorte-error/10 p-3 text-xs leading-relaxed text-nnorte-error">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-nnorte-border bg-nnorte-sidebar px-5 py-3 sm:flex-row sm:justify-end">
          {success || nothingToRate ? (
            <Button className="w-full sm:w-auto" onClick={onClose}>Tutup</Button>
          ) : (
            <>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={onClose} disabled={busy}>
                Batal
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => void submit()}
                loading={busy}
                loadingText="Mengirim…"
                disabled={!canSubmit}
              >
                Kirim Rating
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return dialog;
  return createPortal(dialog, document.body);
}
