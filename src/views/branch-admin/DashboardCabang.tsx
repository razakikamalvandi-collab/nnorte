import React from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { StatCard } from "../../components/common/StatCard";
import { formatRupiah, formatDateTime, getOrderStatusBadge } from "../../utils/formatters";
import { addDays, todayInBusinessTz } from "../../lib/dates";
import { formatPct, pctChange } from "../../lib/finance";
import { sumSalesOnDate } from "../../lib/sales";
import {
  DollarSign,
  Receipt,
  UtensilsCrossed,
  Clock,
  AlertTriangle,
  QrCode,
  Flame,
  CheckCircle2,
} from "lucide-react";

export const DashboardCabang: React.FC = () => {
  const { currentUser, branches, orders, tables, inventory } = useApp();

  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchOrders = orders.filter((o) => o.branchId === branchId);
  const branchTables = tables.filter((t) => t.branchId === branchId);
  const branchInventory = inventory.filter((i) => i.branchId === branchId);

  const today = todayInBusinessTz();
  const todaySales = sumSalesOnDate(branchOrders, today);
  const previousSales = sumSalesOnDate(branchOrders, addDays(today, -1));
  const salesChange = formatPct(pctChange(todaySales, previousSales));

  const activeOrdersCount = branchOrders.filter(
    (o) => o.status === 'cooking' || o.status === 'kitchen_queue' || o.status === 'pending'
  ).length;

  const occupiedTables = branchTables.filter((t) => t.status === 'occupied').length;
  const lowStockCount = branchInventory.filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-nnorte-red/10 text-nnorte-red-hover border border-nnorte-red/30 text-xs font-semibold mb-1">
            <span>{branch.name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Dashboard Operasional Cabang
          </h1>
          <p className="text-xs text-nnorte-muted mt-0.5">
            {branch.address} · Jam Operasional: {branch.operatingHours}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Penjualan Hari Ini"
          value={formatRupiah(todaySales)}
          change={salesChange}
          changeType={salesChange?.startsWith('-') ? 'negative' : 'positive'}
          icon={DollarSign}
        />
        <StatCard
          title="Pesanan Sedang Aktif"
          value={`${activeOrdersCount} Tiket`}
          subtext="Dapur & Antrean"
          icon={Flame}
        />
        <StatCard
          title="Okupansi Meja"
          value={`${occupiedTables} / ${branchTables.length || branch.totalTables}`}
          badge={`${Math.round((occupiedTables / (branchTables.length || 1)) * 100)}% Terisi`}
          icon={QrCode}
        />
        <StatCard
          title="Peringatan Stok Rendah"
          value={`${lowStockCount} Bahan`}
          changeType={lowStockCount > 0 ? 'negative' : 'positive'}
          subtext={lowStockCount > 0 ? 'Perlu Restock Segera' : 'Stok Aman'}
          icon={AlertTriangle}
        />
      </div>

      {/* Quick Visual Overview: Table Map & Kitchen Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Map Overview */}
        <div className="lg:col-span-2 bg-nnorte-surface border border-nnorte-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-nnorte-text">Denah & Keterisian Meja</h3>
              <p className="text-xs text-nnorte-muted">Status langsung dari pemindaian QR pelanggan</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-nnorte-success">
                <span className="w-2.5 h-2.5 rounded-full bg-nnorte-success"></span> Tersedia
              </span>
              <span className="flex items-center gap-1.5 text-nnorte-error">
                <span className="w-2.5 h-2.5 rounded-full bg-nnorte-error"></span> Terisi
              </span>
              <span className="flex items-center gap-1.5 text-nnorte-warning">
                <span className="w-2.5 h-2.5 rounded-full bg-nnorte-warning"></span> Billing
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {branchTables.map((tbl) => {
              const color =
                tbl.status === 'occupied'
                  ? 'border-nnorte-error/60 bg-nnorte-error/10 text-nnorte-error'
                  : tbl.status === 'billing'
                  ? 'border-nnorte-warning/60 bg-nnorte-warning/10 text-nnorte-warning'
                  : tbl.status === 'reserved'
                  ? 'border-purple-500/60 bg-purple-500/10 text-purple-400'
                  : 'border-nnorte-success/40 bg-nnorte-success/5 text-nnorte-success';

              return (
                <div
                  key={tbl.id}
                  className={`p-3.5 rounded-xl border ${color} flex flex-col justify-between transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-nnorte-text">{tbl.tableNumber}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                      {tbl.capacity}P
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="capitalize">{tbl.status}</span>
                    <QrCode size={13} className="text-nnorte-muted" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-nnorte-surface border border-nnorte-border rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-nnorte-text">Peringatan Bahan Baku</h3>
            <p className="text-xs text-nnorte-muted">Bahan yang mendekati batas minimum</p>
          </div>

          <div className="space-y-2.5">
            {branchInventory.map((inv) => (
              <div
                key={inv.id}
                className="p-3 rounded-lg bg-nnorte-surface-2 border border-nnorte-border flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-nnorte-text">{inv.name}</h4>
                  <span className="text-[11px] text-nnorte-muted">
                    Sisa: {inv.currentStock} {inv.unit} (Min: {inv.minThreshold})
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    inv.status === 'low_stock'
                      ? 'bg-nnorte-warning/10 text-nnorte-warning border-nnorte-warning/30'
                      : 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30'
                  }`}
                >
                  {inv.status === 'low_stock' ? 'Stok Rendah' : 'Cukup'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Branch Orders Stream */}
      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-nnorte-border">
          <h3 className="text-sm font-bold text-nnorte-text">Pesanan Berjalan Hari Ini</h3>
          <p className="text-xs text-nnorte-muted">Pesanan khusus cabang {branch.name}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-nnorte-text">
            <thead className="bg-nnorte-sidebar text-nnorte-muted uppercase text-[10px] tracking-wider border-b border-nnorte-border">
              <tr>
                <th className="py-3 px-4 font-semibold">No. Pesanan</th>
                <th className="py-3 px-4 font-semibold">Waktu Masuk</th>
                <th className="py-3 px-4 font-semibold">Pelanggan</th>
                <th className="py-3 px-4 font-semibold">Meja</th>
                <th className="py-3 px-4 font-semibold">Total</th>
                <th className="py-3 px-4 font-semibold">Status Dapur</th>
                <th className="py-3 px-4 font-semibold">Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nnorte-border">
              {branchOrders.map((ord) => {
                const statusBadge = getOrderStatusBadge(ord.status);
                return (
                  <tr key={ord.id} className="hover:bg-nnorte-surface-2/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-nnorte-red">{ord.orderNumber}</td>
                    <td className="py-3 px-4 text-nnorte-muted">{formatDateTime(ord.createdAt)}</td>
                    <td className="py-3 px-4 font-semibold">{ord.customerName}</td>
                    <td className="py-3 px-4 text-nnorte-muted">{ord.tableNumber || 'Takeaway'}</td>
                    <td className="py-3 px-4 font-bold text-nnorte-text">{formatRupiah(ord.totalAmount)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        ord.paymentStatus === 'paid'
                          ? 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30'
                          : 'bg-nnorte-error/10 text-nnorte-error border-nnorte-error/30'
                      }`}>
                        {ord.paymentStatus === 'paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};




