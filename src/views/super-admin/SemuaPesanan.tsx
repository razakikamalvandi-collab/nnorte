import React, { useMemo, useState } from 'react';
import { Eye, FileSpreadsheet, Filter, Receipt, Search, Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah, formatDateTime, getOrderStatusBadge, getPaymentStatusBadge } from '../../utils/formatters';
import { OrderDetailModal } from '../../components/common/OrderDetailModal';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { inputClass } from '../../components/ui/Field';
import { exportOrdersXlsx } from '../../lib/ordersExport';
import { Order } from '../../types';

export const SemuaPesanan: React.FC = () => {
  const { orders, branches, currentUser, hasMoreOrders, loadMoreOrders, dataLoading, dataError, reloadData, addToast } = useApp();
  const isOwner = currentUser?.role === 'owner';
  const [branchSel, setBranchSel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Order | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const branchId = isOwner ? branchSel : currentUser?.branchId ?? 'all';

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (branchId === 'all' || o.branchId === branchId) &&
        (statusFilter === 'all' || o.status === statusFilter) &&
        (!t || o.orderNumber.toLowerCase().includes(t) || o.customerName.toLowerCase().includes(t) || (o.tableNumber ?? '').toLowerCase().includes(t))
    );
  }, [orders, branchId, statusFilter, q]);

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const label = branchId === 'all' ? 'Semua-Cabang' : branches.find((b) => b.id === branchId)?.code ?? 'Cabang';
      const name = await exportOrdersXlsx(filtered, label);
      addToast('success', `Rekap diunduh: ${name}`);
    } catch (e) {
      addToast('error', `Ekspor gagal: ${e instanceof Error ? e.message : 'kesalahan tidak dikenal'}`);
    } finally {
      setExporting(false);
    }
  };

  const more = async () => {
    setLoadingMore(true);
    try { await loadMoreOrders(); } finally { setLoadingMore(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">{isOwner ? 'Semua Pesanan' : 'Pesanan Cabang'}</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Pantau seluruh pesanan masuk, status dapur, dan status pelunasan.</p>
        </div>
        <Button variant="accent" icon={<FileSpreadsheet size={14} className="text-nnorte-on-brand" />} onClick={() => void doExport()} loading={exporting} loadingText="Membuat Excel…" disabled={filtered.length === 0}>
          Ekspor Rekap
        </Button>
      </div>

      {dataError && <ErrorState message={dataError} onRetry={() => void reloadData()} />}

      <div className={`grid grid-cols-1 gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-3 ${isOwner ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-blue-soft" aria-hidden="true" />
          <input type="search" aria-label="Cari pesanan" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari No. Pesanan / Pelanggan / Meja…" className={`${inputClass()} pl-9`} />
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Building2 size={14} className="shrink-0 text-nnorte-red" aria-hidden="true" />
            <select aria-label="Filter cabang" value={branchSel} onChange={(e) => setBranchSel(e.target.value)} className={inputClass()}>
              <option value="all">Semua Cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Filter size={14} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" />
          <select aria-label="Filter status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass()}>
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Konfirmasi</option>
            <option value="kitchen_queue">Antrean Dapur</option>
            <option value="cooking">Sedang Dimasak</option>
            <option value="ready_to_serve">Siap Disajikan</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
      </div>

      {!dataLoading && filtered.length === 0 ? (
        <EmptyState icon={Receipt} title={orders.length === 0 ? 'Belum ada pesanan yang dapat ditampilkan.' : 'Tidak ada pesanan yang cocok dengan filter.'} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-nnorte-text">
              <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                <tr>
                  {['No. Pesanan', 'Cabang', 'Waktu', 'Pelanggan', 'Meja', 'Item', 'Total', 'Status Dapur', 'Pembayaran'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                  <th className="px-4 py-3 text-right font-semibold">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nnorte-border">
                {filtered.map((o) => {
                  const sb = getOrderStatusBadge(o.status);
                  const pb = getPaymentStatusBadge(o.paymentStatus);
                  return (
                    <tr key={o.id} className="hover:bg-nnorte-surface-2/60">
                      <td className="px-4 py-3 font-mono font-medium text-nnorte-red">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-nnorte-muted">{o.branchName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-nnorte-muted">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{o.customerName}</td>
                      <td className="px-4 py-3 text-nnorte-muted">{o.tableNumber || 'Takeaway'}</td>
                      <td className="px-4 py-3 text-nnorte-muted">{o.items.reduce((s, i) => s + i.quantity, 0)} item</td>
                      <td className="px-4 py-3 font-bold">{formatRupiah(o.totalAmount)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sb.bg} ${sb.text} ${sb.border}`}>{sb.label}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pb.bg} ${pb.text} ${pb.border}`}>{pb.label}{o.paymentStatus === 'paid' && o.paymentMethod ? ` (${o.paymentMethod.toUpperCase()})` : ''}</span></td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setActive(o)} className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-2.5 py-1 hover:bg-nnorte-border"><Eye size={12} aria-hidden="true" />Buka</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMoreOrders && (
            <div className="border-t border-nnorte-border p-3 text-center">
              <Button variant="secondary" size="sm" onClick={() => void more()} loading={loadingMore} loadingText="Memuat…">Muat pesanan lebih lama</Button>
            </div>
          )}
        </div>
      )}

      {active && <OrderDetailModal order={active} onClose={() => setActive(null)} />}
    </div>
  );
};
