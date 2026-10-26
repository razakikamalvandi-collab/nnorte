import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, DollarSign, Eye, Receipt, TrendingUp, Utensils, Wallet, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinancialReport } from '../../hooks/useFinancialReport';
import { StatCard } from '../../components/common/StatCard';
import { ReportFilterBar } from '../../components/common/ReportFilterBar';
import { ReportExportButtons } from '../../components/common/ReportExportButtons';
import { OrderDetailModal } from '../../components/common/OrderDetailModal';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import { BranchComparisonBars, NetProfitChart, PaymentMethodChart, RevenueByBranchChart } from '../../components/charts/FinancialCharts';
import { formatPct, pctChange } from '../../lib/finance';
import { formatDateTime, formatRupiah, getOrderStatusBadge, getPaymentStatusBadge } from '../../utils/formatters';
import { Order } from '../../types';

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`nn-rise min-w-0 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5 ${className}`}>
    <header className="mb-4">
      <h2 className="text-sm font-semibold text-nnorte-text">{title}</h2>
      {subtitle && <p className="text-xs text-nnorte-muted">{subtitle}</p>}
    </header>
    {children}
  </section>
);

export const DashboardKonsolidasi: React.FC = () => {
  const { branches, orders, dataLoading, dataError, reloadData, currentUser } = useApp();
  const { summary, raw, loading, error, reload, branchId } = useFinancialReport();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const recentOrders = useMemo(
    () => orders.filter((o) => branchId === 'all' || o.branchId === branchId).slice(0, 10),
    [orders, branchId]
  );

  const activeBranches = branches.filter((b) => b.status === 'active').length;
  const showFirstLoad = (loading && !summary) || (dataLoading && branches.length === 0);

  const cmp = (current: number, prev: number | undefined, inverse = false) => {
    const pct = pctChange(current, prev ?? null);
    const label = formatPct(pct);
    if (!label) return { change: undefined, type: 'neutral' as const };
    const good = inverse ? (pct as number) <= 0 : (pct as number) >= 0;
    return { change: label, type: good ? ('positive' as const) : ('negative' as const) };
  };

  const t = summary?.totals;
  const prev = summary?.previousTotals ?? undefined;
  const revenueCmp = cmp(t?.revenue ?? 0, prev?.revenue);
  const expenseCmp = cmp(t?.expenses ?? 0, prev?.expenses, true);
  const netCmp = cmp(t?.net ?? 0, prev?.net);
  const txCmp = cmp(t?.txCount ?? 0, prev?.txCount);
  const avgCmp = cmp(t?.avgTicket ?? 0, prev?.avgTicket ?? undefined);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Dashboard Konsolidasi &amp; Laporan Keuangan</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Ringkasan performa finansial multi-cabang NNORTE Coffee &amp; Hangout</p>
        </div>
        <ReportExportButtons summary={summary} raw={raw} loading={loading} />
      </div>

      <ReportFilterBar />

      {dataError && !error && <ErrorState message={dataError} onRetry={() => void reloadData()} />}
      {error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!error && showFirstLoad && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {!error && !showFirstLoad && branches.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Belum ada cabang"
          description="Tambahkan cabang pertama untuk mulai mengelola operasional dan melihat laporan."
        />
      )}

      {!error && !showFirstLoad && summary && branches.length > 0 && (
        <div className={`space-y-5 transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'}`} aria-busy={loading}>
          {!summary.hasSales && !summary.hasExpenses ? (
            <EmptyState icon={BarChart3} title="Belum ada transaksi pada periode ini." description="Ubah cabang atau periode untuk melihat data lain. Angka akan muncul setelah ada pesanan yang lunas." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
                <StatCard index={0} title="Total Pendapatan" value={formatRupiah(t!.revenue)} change={revenueCmp.change} changeType={revenueCmp.type} icon={DollarSign} subtext="Tanpa PB1" />
                <StatCard
                  index={1}
                  title="Total Pengeluaran"
                  value={summary.hasExpenses ? formatRupiah(t!.expenses) : '—'}
                  change={summary.hasExpenses ? expenseCmp.change : undefined}
                  changeType={expenseCmp.type}
                  subtext={summary.hasExpenses ? undefined : 'Belum ada yang tercatat'}
                  icon={Wallet}
                />
                <StatCard
                  index={2}
                  title={t!.net < 0 ? 'Rugi Bersih' : 'Laba Bersih'}
                  value={formatRupiah(t!.net)}
                  change={summary.hasExpenses ? netCmp.change : undefined}
                  changeType={netCmp.type}
                  badge={summary.hasExpenses ? undefined : 'Belum dikurangi biaya'}
                  icon={TrendingUp}
                />
                <StatCard index={3} title="Total Transaksi" value={t!.txCount.toLocaleString('id-ID')} change={txCmp.change} changeType={txCmp.type} icon={Receipt} />
                <StatCard index={4} title="Rata-rata Transaksi" value={t!.avgTicket === null ? '—' : formatRupiah(t!.avgTicket)} change={t!.avgTicket === null ? undefined : avgCmp.change} changeType={avgCmp.type} icon={ArrowUpRight} />
                <StatCard index={5} title="Cabang Aktif" value={`${activeBranches} / ${branches.length}`} subtext={`${summary.byBranch.length} dalam filter`} icon={Building2} />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Card title="Pendapatan Harian per Cabang" subtitle="Pendapatan setelah dikurangi PB1" className="lg:col-span-2">
                  <RevenueByBranchChart series={summary.byBranch} />
                </Card>
                <Card title="Komposisi Metode Pembayaran" subtitle="Nilai pembayaran (termasuk pajak & service)">
                  {raw && raw.methods.length > 0 ? <PaymentMethodChart methods={raw.methods} /> : <EmptyState compact icon={Receipt} title="Belum ada pembayaran" />}
                </Card>
              </div>

              <Card title="Laba / Rugi Bersih Harian" subtitle="Pendapatan dikurangi pengeluaran tercatat; di bawah garis nol berarti rugi">
                {summary.hasExpenses ? (
                  <NetProfitChart daily={summary.daily} />
                ) : (
                  <EmptyState compact icon={Wallet} title="Belum ada pengeluaran tercatat" description="Catat pengeluaran operasional di menu Laporan Keuangan agar laba bersih dapat dihitung. Tanpa itu grafik hanya akan menyamai pendapatan." />
                )}
              </Card>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card title="Perbandingan Penjualan Antar Cabang" subtitle="Pendapatan pada periode terpilih">
                  <BranchComparisonBars series={summary.byBranch} />
                </Card>
                <Card title="Menu Terlaris" subtitle="Berdasarkan jumlah porsi terjual pada periode terpilih">
                  {raw && raw.topMenus.length > 0 ? (
                    <ol className="space-y-3">
                      {raw.topMenus.map((m, i) => (
                        <li key={`${m.menuId}-${m.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-5 text-center text-xs font-bold text-nnorte-red">#{i + 1}</span>
                            {m.image ? (
                              <img src={m.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-nnorte-border object-cover" loading="lazy" />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-sidebar text-nnorte-muted">
                                <Utensils size={16} aria-hidden="true" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <h3 className="truncate text-xs font-bold text-nnorte-text">{m.name}</h3>
                              <p className="truncate text-[11px] text-nnorte-muted">{m.category || 'Tanpa kategori'}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-bold text-nnorte-text">{formatRupiah(m.sales)}</div>
                            <div className="text-[10px] text-nnorte-success">Terjual {m.qty.toLocaleString('id-ID')} porsi</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState compact icon={Utensils} title="Belum ada penjualan menu" />
                  )}
                </Card>
              </div>

              <section className="nn-rise overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
                <header className="border-b border-nnorte-border p-4 sm:p-5">
                  <h2 className="text-sm font-bold text-nnorte-text">Performa Masing-Masing Cabang</h2>
                  <p className="text-xs text-nnorte-muted">Angka periode terpilih, dihitung dari transaksi lunas</p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-nnorte-text">
                    <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Cabang</th>
                        <th className="px-4 py-3 font-semibold">Kota</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Transaksi</th>
                        <th className="px-4 py-3 text-right font-semibold">Pendapatan</th>
                        <th className="px-4 py-3 text-right font-semibold">Pengeluaran</th>
                        <th className="px-4 py-3 text-right font-semibold">Laba</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nnorte-border">
                      {summary.byBranch.map((s) => {
                        const b = branches.find((x) => x.id === s.branchId);
                        return (
                          <tr key={s.branchId} className="transition-colors hover:bg-nnorte-surface-2/60">
                            <td className="px-4 py-3 font-medium">
                              <span className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-nnorte-muted">{b?.city}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${b?.status === 'active' ? 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success' : 'border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted'}`}>
                                {b?.status === 'active' ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">{s.totals.txCount.toLocaleString('id-ID')}</td>
                            <td className="px-4 py-3 text-right font-bold">{formatRupiah(s.totals.revenue)}</td>
                            <td className="px-4 py-3 text-right text-nnorte-muted">{s.totals.expenses > 0 ? formatRupiah(s.totals.expenses) : '—'}</td>
                            <td className={`px-4 py-3 text-right font-bold ${s.totals.net < 0 ? 'text-nnorte-error' : 'text-nnorte-text'}`}>{formatRupiah(s.totals.net)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section className="nn-rise overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
            <header className="border-b border-nnorte-border p-4 sm:p-5">
              <h2 className="text-sm font-bold text-nnorte-text">Pesanan Terbaru</h2>
              <p className="text-xs text-nnorte-muted">Sesuai cabang terpilih; diperbarui otomatis</p>
            </header>
            {recentOrders.length === 0 ? (
              <div className="p-4">
                <EmptyState compact icon={Receipt} title="Belum ada pesanan yang dapat ditampilkan." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-nnorte-text">
                  <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">No. Pesanan</th>
                      <th className="px-4 py-3 font-semibold">Cabang</th>
                      <th className="px-4 py-3 font-semibold">Waktu</th>
                      <th className="px-4 py-3 font-semibold">Pelanggan</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Pembayaran</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nnorte-border">
                    {recentOrders.map((ord) => {
                      const sb = getOrderStatusBadge(ord.status);
                      const pb = getPaymentStatusBadge(ord.paymentStatus);
                      return (
                        <tr key={ord.id} className="transition-colors hover:bg-nnorte-surface-2/60">
                          <td className="px-4 py-3 font-mono font-medium text-nnorte-red">{ord.orderNumber}</td>
                          <td className="px-4 py-3 text-nnorte-muted">{ord.branchName}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-nnorte-muted">{formatDateTime(ord.createdAt)}</td>
                          <td className="px-4 py-3 font-medium">{ord.customerName}</td>
                          <td className="px-4 py-3 font-bold">{formatRupiah(ord.totalAmount)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sb.bg} ${sb.text} ${sb.border}`}>{sb.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pb.bg} ${pb.text} ${pb.border}`}>{pb.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => setSelectedOrder(ord)} className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-2.5 py-1 text-nnorte-text hover:bg-nnorte-border">
                              <Eye size={12} aria-hidden="true" />
                              <span>Rincian</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      {/* currentUser dipakai hook; referensi agar lint tidak menganggap tak terpakai */}
      <span className="hidden">{currentUser?.role}</span>
    </div>
  );
};
