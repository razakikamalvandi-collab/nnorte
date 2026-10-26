import React, { useState } from 'react';
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/formatters';
import { StatCard } from '../../components/common/StatCard';
import { TrendingUp, Users, Clock, Receipt, Download } from 'lucide-react';

export const AuditKeamanan: React.FC = () => {
  const { currentUser, branches, orders } = useApp();
  const [branchId, setBranchId] = useState('all');
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const visibleOrders = orders.filter(
    (o) => branchId === 'all' || o.branchId === branchId
  );
  const totalRevenue = visibleOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageTicket = visibleOrders.length
    ? Math.round(totalRevenue / visibleOrders.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Audit &amp; Keamanan
          </h1>
          <p className="text-xs text-nnorte-muted mt-1">
            Rekap aktivitas transaksi, login, dan perubahan data di seluruh cabang.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-nnorte-surface border border-nnorte-border rounded-lg px-3 py-2 text-xs text-nnorte-text focus:outline-none"
          >
            <option value="all" className="bg-nnorte-surface text-nnorte-text">
              Semua Cabang
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-nnorte-surface text-nnorte-text">
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-nnorte-red hover:bg-nnorte-red-hover text-nnorte-on-brand text-xs font-semibold transition-all shadow-md cursor-pointer"
          >
            <Download size={14} />
            Ekspor Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Transaksi"
          value={String(visibleOrders.length)}
          icon={Receipt}
        />
        <StatCard
          title="Total Pendapatan"
          value={formatRupiah(totalRevenue)}
          icon={TrendingUp}
        />
        <StatCard
          title="Rata-rata Transaksi"
          value={formatRupiah(averageTicket)}
          subtext="Per transaksi"
          icon={Clock}
        />
        <StatCard
          title="Cabang Terdaftar"
          value={String(branches.length)}
          subtext={branch ? branch.name : 'Semua cabang'}
          icon={Users}
        />
      </div>

      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-nnorte-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-nnorte-text">Log Aktivitas Terbaru</h3>
          <span className="text-xs text-nnorte-muted">{visibleOrders.length} catatan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-nnorte-sidebar text-nnorte-muted uppercase text-[10px] tracking-wider border-b border-nnorte-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu</th>
                <th className="py-3 px-4 font-semibold">Nomor Pesanan</th>
                <th className="py-3 px-4 font-semibold">Cabang</th>
                <th className="py-3 px-4 font-semibold">Pelanggan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nnorte-border">
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-nnorte-muted">
                    Belum ada aktivitas transaksi.
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-nnorte-surface-2/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-nnorte-muted">
                      {new Date(order.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-bold text-nnorte-red">{order.orderNumber}</td>
                    <td className="py-3 px-4 text-nnorte-muted">{order.branchName}</td>
                    <td className="py-3 px-4 font-medium text-nnorte-text">
                      {order.customerName}
                    </td>
                    <td className="py-3 px-4 uppercase text-nnorte-muted">{order.status}</td>
                    <td className="py-3 px-4 text-right font-bold text-nnorte-red">
                      {formatRupiah(order.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {currentUser && (
        <p className="text-[11px] text-nnorte-muted">
          Audit dibuka oleh {currentUser.name} ({currentUser.role}).
        </p>
      )}
    </div>
  );
};
