import React, { useMemo, useState } from 'react';
import { BranchSeries, DailyPoint, PaymentMethodRow } from '../../lib/finance';
import { formatDateId, formatDayShort } from '../../lib/dates';
import { formatRupiah, formatRupiahCompact } from '../../utils/formatters';
import { labelIndexes, niceAxis, useElementWidth } from './chartUtils';
import { PaymentMethod } from '../../types';

const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

interface Tip {
  index: number;
  x: number;
}

/** Posisi tooltip dijaga tetap di dalam kontainer. */
const Tooltip: React.FC<{ x: number; width: number; children: React.ReactNode }> = ({ x, width, children }) => {
  const boxW = 210;
  const left = Math.min(Math.max(x + 12, 4), Math.max(4, width - boxW - 4));
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-2.5 text-xs shadow-xl"
      style={{ left, width: boxW }}
      role="status"
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pendapatan harian per cabang (warna = konfigurasi cabang)
// ---------------------------------------------------------------------------
export const RevenueByBranchChart: React.FC<{ series: BranchSeries[]; height?: number }> = ({ series, height = 260 }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const days = series[0]?.points ?? [];
  const w = Math.max(width, 280);
  const innerW = w - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const maxVal = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.revenue)));
  const axis = useMemo(() => niceAxis(0, maxVal), [maxVal]);
  const x = (i: number) => PAD.left + (days.length <= 1 ? innerW / 2 : (i * innerW) / (days.length - 1));
  const y = (v: number) => PAD.top + innerH - ((v - axis.min) / (axis.max - axis.min)) * innerH;
  const labels = labelIndexes(days.length, Math.max(2, Math.floor(innerW / 64)));

  const onMove = (clientX: number, rect: DOMRect) => {
    if (days.length === 0) return;
    const rel = clientX - rect.left - PAD.left;
    const idx = Math.round((rel / innerW) * (days.length - 1));
    const i = Math.min(days.length - 1, Math.max(0, days.length === 1 ? 0 : idx));
    setTip({ index: i, x: x(i) });
  };

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={w}
            height={height}
            role="img"
            aria-label={`Grafik pendapatan harian ${series.map((s) => s.name).join(', ')}`}
            className="overflow-visible"
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setTip(null)}
          >
            {axis.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--c-border)" strokeDasharray={t === 0 ? undefined : '3 3'} />
                <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--c-muted)">
                  {formatRupiahCompact(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              labels.has(i) ? (
                <text key={d.date} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--c-muted)">
                  {formatDayShort(d.date)}
                </text>
              ) : null
            )}
            {series.map((s, si) => (
              <g key={s.branchId}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  className="chart-line-animate"
                  style={{ animationDelay: `${si * 120}ms` }}
                  points={s.points.map((p, i) => `${x(i)},${y(p.revenue)}`).join(' ')}
                />
                {days.length <= 45 &&
                  s.points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.revenue)} r={tip?.index === i ? 4.5 : 2.5} fill={s.color} stroke="var(--c-surface)" strokeWidth={1.5} />)}
              </g>
            ))}
            {tip && <line x1={tip.x} x2={tip.x} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--c-muted)" strokeDasharray="2 3" />}
          </svg>
        )}
        {tip && days[tip.index] && (
          <Tooltip x={tip.x} width={w}>
            <div className="mb-1 font-semibold text-nnorte-text">{formatDateId(days[tip.index].date)}</div>
            {series.map((s) => (
              <div key={s.branchId} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate text-nnorte-muted">{s.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-nnorte-text">{formatRupiah(s.points[tip.index].revenue)}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <li key={s.branchId} className="flex items-center gap-1.5 text-nnorte-text">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Laba / rugi harian (terpisah dari pendapatan; garis nol jelas)
// ---------------------------------------------------------------------------
export const NetProfitChart: React.FC<{ daily: DailyPoint[]; height?: number }> = ({ daily, height = 240 }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const w = Math.max(width, 280);
  const innerW = w - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const nets = daily.map((d) => d.net);
  const axis = useMemo(() => niceAxis(Math.min(0, ...nets), Math.max(0, ...nets)), [nets]);
  const slot = daily.length > 0 ? innerW / daily.length : innerW;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD.top + innerH - ((v - axis.min) / (axis.max - axis.min)) * innerH;
  const zeroY = y(0);
  const labels = labelIndexes(daily.length, Math.max(2, Math.floor(innerW / 64)));

  const onMove = (clientX: number, rect: DOMRect) => {
    if (daily.length === 0) return;
    const i = Math.min(daily.length - 1, Math.max(0, Math.floor((clientX - rect.left - PAD.left) / slot)));
    setTip({ index: i, x: PAD.left + slot * i + slot / 2 });
  };

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={w}
            height={height}
            role="img"
            aria-label="Grafik laba atau rugi bersih harian"
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setTip(null)}
          >
            {axis.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--c-border)" strokeDasharray={t === 0 ? undefined : '3 3'} />
                <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--c-muted)">
                  {formatRupiahCompact(t)}
                </text>
              </g>
            ))}
            {daily.map((d, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const top = Math.min(y(d.net), zeroY);
              const h = Math.max(d.net === 0 ? 0 : 1.5, Math.abs(y(d.net) - zeroY));
              return (
                <g key={d.date}>
                  {tip?.index === i && <rect x={cx - slot / 2} y={PAD.top} width={slot} height={innerH} fill="var(--c-muted)" opacity={0.1} />}
                  <rect
                    x={cx - barW / 2}
                    y={top}
                    width={barW}
                    height={h}
                    rx={Math.min(3, barW / 3)}
                    fill={d.net >= 0 ? 'var(--c-success)' : 'var(--c-error)'}
                    className="chart-bar-animate"
                    style={{ transformOrigin: `center ${d.net >= 0 ? 'bottom' : 'top'}` }}
                  />
                  {labels.has(i) && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--c-muted)">
                      {formatDayShort(d.date)}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={PAD.left} x2={w - PAD.right} y1={zeroY} y2={zeroY} stroke="var(--c-text)" strokeWidth={1.5} opacity={0.7} />
          </svg>
        )}
        {tip && daily[tip.index] && (
          <Tooltip x={tip.x} width={w}>
            <div className="mb-1 font-semibold text-nnorte-text">{formatDateId(daily[tip.index].date)}</div>
            <Row label="Pendapatan" value={formatRupiah(daily[tip.index].revenue)} />
            <Row label="Pengeluaran" value={formatRupiah(daily[tip.index].expenses)} />
            <Row
              label={daily[tip.index].net >= 0 ? 'Laba bersih' : 'Rugi bersih'}
              value={formatRupiah(daily[tip.index].net)}
              strong
              tone={daily[tip.index].net >= 0 ? 'text-nnorte-success' : 'text-nnorte-error'}
            />
          </Tooltip>
        )}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-nnorte-text">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-nnorte-success" />Laba</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-nnorte-error" />Rugi</span>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean; tone?: string }> = ({ label, value, strong, tone }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-nnorte-muted">{label}</span>
    <span className={`${strong ? 'font-bold' : 'font-semibold'} ${tone || 'text-nnorte-text'}`}>{value}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Perbandingan cabang (batang, warna cabang)
// ---------------------------------------------------------------------------
export const BranchComparisonBars: React.FC<{ series: BranchSeries[] }> = ({ series }) => {
  const max = Math.max(1, ...series.map((s) => s.totals.revenue));
  const sorted = [...series].sort((a, b) => b.totals.revenue - a.totals.revenue);
  return (
    <ul className="space-y-4 pt-1">
      {sorted.map((s) => {
        const pct = Math.round((s.totals.revenue / max) * 100);
        return (
          <li key={s.branchId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 font-medium text-nnorte-text">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 font-bold text-nnorte-text">{formatRupiah(s.totals.revenue)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-nnorte-border bg-nnorte-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} ${pct}% dari tertinggi`}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
            </div>
            <div className="flex justify-between text-[11px] text-nnorte-muted">
              <span>{s.totals.txCount.toLocaleString('id-ID')} transaksi</span>
              <span>{s.totals.revenue === 0 ? 'Belum ada penjualan' : `${pct}% dari tertinggi`}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Metode pembayaran (donut dari data pembayaran nyata)
// ---------------------------------------------------------------------------
const METHOD_LABEL: Record<PaymentMethod, string> = {
  qris: 'QRIS',
  cash: 'Tunai',
  credit_card: 'Kartu Kredit',
  debit_card: 'Kartu Debit',
  bank_transfer: 'Transfer Bank',
};
const METHOD_COLOR: Record<PaymentMethod, string> = {
  qris: '#e31d36',
  cash: '#22c55e',
  credit_card: '#3b82f6',
  debit_card: '#eab308',
  bank_transfer: '#a855f7',
};

export const PaymentMethodChart: React.FC<{ methods: PaymentMethodRow[] }> = ({ methods }) => {
  const total = methods.reduce((s, m) => s + m.amount, 0);
  const R = 14;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="grid grid-cols-1 items-center gap-5">
      <div className="relative mx-auto h-36 w-36">
        <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90" role="img" aria-label="Komposisi metode pembayaran">
          <circle cx="18" cy="18" r={R} fill="none" stroke="var(--c-surface-2)" strokeWidth="4.5" />
          {methods.map((m) => {
            const len = total > 0 ? (m.amount / total) * C : 0;
            const el = (
              <circle key={m.method} cx="18" cy="18" r={R} fill="none" stroke={METHOD_COLOR[m.method]} strokeWidth="4.5" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wider text-nnorte-muted">Total</span>
          <span className="text-xs font-bold text-nnorte-text">{formatRupiahCompact(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-2.5">
        {methods.map((m) => (
          <li key={m.method} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 font-medium text-nnorte-text">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: METHOD_COLOR[m.method] }} />
              <span>{METHOD_LABEL[m.method]}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="font-bold text-nnorte-text">{total > 0 ? Math.round((m.amount / total) * 100) : 0}%</span>
              <span className="ml-1.5 text-nnorte-muted">{m.txCount}x</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
