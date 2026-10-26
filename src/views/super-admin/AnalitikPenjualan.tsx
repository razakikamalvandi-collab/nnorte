import React from 'react';
import { Award, BarChart3, Receipt, TrendingUp, Utensils } from 'lucide-react';
import { useFinancialReport } from '../../hooks/useFinancialReport';
import { StatCard } from '../../components/common/StatCard';
import { ReportFilterBar } from '../../components/common/ReportFilterBar';
import { ReportExportButtons } from '../../components/common/ReportExportButtons';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { BranchComparisonBars, PaymentMethodChart, RevenueByBranchChart } from '../../components/charts/FinancialCharts';
import { formatPct, pctChange } from '../../lib/finance';
import { formatRupiah } from '../../utils/formatters';

export const AnalitikPenjualan: React.FC = () => {
  const { summary, raw, loading, error, reload } = useFinancialReport();
  const t = summary?.totals;
  const pct = formatPct(pctChange(t?.revenue ?? 0, summary?.previousTotals?.revenue ?? null));
  const best = summary && summary.byBranch.length > 0 ? [...summary.byBranch].sort((a, b) => b.totals.revenue - a.totals.revenue)[0] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Analitik Penjualan</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Tren penjualan, perbandingan cabang, dan menu terlaris dari transaksi lunas</p>
        </div>
        <ReportExportButtons summary={summary} raw={raw} loading={loading} />
      </div>
      <ReportFilterBar />
      {error && <ErrorState message={error} onRetry={() => void reload()} />}
      {loading && !summary && <Skeleton className="h-64" />}
      {summary && t && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {!summary.hasSales ? (
            <EmptyState icon={BarChart3} title="Belum ada transaksi pada periode ini." description="Ubah cabang atau periode untuk melihat data lain." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard index={0} title="Pendapatan" value={formatRupiah(t.revenue)} change={pct} changeType={pct?.startsWith('-') ? 'negative' : 'positive'} icon={TrendingUp} />
                <StatCard index={1} title="Transaksi" value={t.txCount.toLocaleString('id-ID')} icon={Receipt} />
                <StatCard index={2} title="Rata-rata Transaksi" value={t.avgTicket === null ? '—' : formatRupiah(t.avgTicket)} icon={BarChart3} />
                <StatCard index={3} title="Cabang Teratas" value={best ? best.name : '—'} subtext={best ? formatRupiah(best.totals.revenue) : undefined} icon={Award} />
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5 lg:col-span-2">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Tren Pendapatan Harian</h2>
                  <RevenueByBranchChart series={summary.byBranch} />
                </section>
                <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Metode Pembayaran</h2>
                  {raw && raw.methods.length > 0 ? <PaymentMethodChart methods={raw.methods} /> : <EmptyState compact icon={Receipt} title="Belum ada pembayaran" />}
                </section>
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Perbandingan Antar Cabang</h2>
                  <BranchComparisonBars series={summary.byBranch} />
                </section>
                <section className="nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Menu Terlaris</h2>
                  {raw && raw.topMenus.length > 0 ? (
                    <ol className="space-y-2">
                      {raw.topMenus.map((m, i) => (
                        <li key={`${m.menuId}-${m.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-2.5 text-xs">
                          <span className="flex min-w-0 items-center gap-2">
                            <b className="w-5 text-nnorte-red">#{i + 1}</b>
                            <Utensils size={14} className="shrink-0 text-nnorte-muted" aria-hidden="true" />
                            <span className="truncate font-semibold text-nnorte-text">{m.name}</span>
                          </span>
                          <span className="shrink-0 text-right text-nnorte-muted">{m.qty.toLocaleString('id-ID')} porsi · <b className="text-nnorte-text">{formatRupiah(m.sales)}</b></span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState compact icon={Utensils} title="Belum ada penjualan menu" />
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
