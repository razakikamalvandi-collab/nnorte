import React, { useMemo } from 'react';
import { Receipt, TrendingUp, Wallet, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinancialReport } from '../../hooks/useFinancialReport';
import { StatCard } from '../../components/common/StatCard';
import { ReportFilterBar } from '../../components/common/ReportFilterBar';
import { ReportExportButtons } from '../../components/common/ReportExportButtons';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { PaymentMethodChart, RevenueByBranchChart } from '../../components/charts/FinancialCharts';
import { formatRupiah, getOrderStatusBadge } from '../../utils/formatters';

export const LaporanOperasional: React.FC = () => {
  const { currentUser, branches, orders } = useApp();
  const { summary, raw, loading, error, reload } = useFinancialReport();
  const branch = branches.find((b) => b.id === currentUser?.branchId);
  const t = summary?.totals;

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    orders.filter((o) => o.branchId === currentUser?.branchId).forEach((o) => m.set(o.status, (m.get(o.status) ?? 0) + 1));
    return [...m.entries()];
  }, [orders, currentUser?.branchId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Laporan Operasional{branch ? ` — ${branch.name}` : ''}</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Penjualan dan pembayaran cabang Anda pada periode terpilih</p>
        </div>
        <ReportExportButtons summary={summary} raw={raw} loading={loading} />
      </div>
      <ReportFilterBar />
      {error && <ErrorState message={error} onRetry={() => void reload()} />}
      {loading && !summary && <Skeleton className="h-48" />}
      {summary && t && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {!summary.hasSales ? (
            <EmptyState icon={BarChart3} title="Belum ada transaksi pada periode ini." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard index={0} title="Pendapatan" value={formatRupiah(t.revenue)} icon={TrendingUp} subtext="Tanpa PB1" />
                <StatCard index={1} title="Transaksi" value={t.txCount.toLocaleString('id-ID')} icon={Receipt} />
                <StatCard index={2} title="Rata-rata Transaksi" value={t.avgTicket === null ? '—' : formatRupiah(t.avgTicket)} icon={BarChart3} />
                <StatCard index={3} title="Pengeluaran" value={summary.hasExpenses ? formatRupiah(t.expenses) : '—'} icon={Wallet} subtext={summary.hasExpenses ? undefined : 'Belum ada yang tercatat'} />
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className="min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5 lg:col-span-2">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Pendapatan Harian</h2>
                  <RevenueByBranchChart series={summary.byBranch} />
                </section>
                <section className="min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
                  <h2 className="mb-4 text-sm font-semibold text-nnorte-text">Metode Pembayaran</h2>
                  {raw && raw.methods.length > 0 ? <PaymentMethodChart methods={raw.methods} /> : <EmptyState compact icon={Receipt} title="Belum ada pembayaran" />}
                </section>
              </div>
            </>
          )}
          <section className="rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-nnorte-text">Status Pesanan Terkini</h2>
            {byStatus.length === 0 ? (
              <EmptyState compact icon={Receipt} title="Belum ada pesanan." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {byStatus.map(([st, n]) => {
                  const b = getOrderStatusBadge(st);
                  return <li key={st} className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.bg} ${b.text} ${b.border}`}>{b.label}: {n}</li>;
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
