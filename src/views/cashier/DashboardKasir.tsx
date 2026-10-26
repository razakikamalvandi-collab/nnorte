import React from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { StatCard } from "../../components/common/StatCard";
import { formatRupiah, formatDateTime, getOrderStatusBadge } from "../../utils/formatters";
import { todayInBusinessTz } from "../../lib/dates";
import { isSalesOrder, salesDate } from "../../lib/sales";
import { CircleDollarSign, Clock, CheckCircle2, Receipt, ArrowRight } from "lucide-react";

interface DashboardKasirProps {
  onGoToCheckout: () => void;
}

export const DashboardKasir: React.FC<DashboardKasirProps> = ({ onGoToCheckout }) => {
  const { currentUser, orders, branches } = useApp();
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchOrders = orders.filter((o) => o.branchId === branchId);
  const pendingPaymentOrders = branchOrders.filter((o) => o.paymentStatus === "unpaid");
  const paidOrders = branchOrders.filter(isSalesOrder);
  const today = todayInBusinessTz();
  const todayPaidOrders = paidOrders.filter((o) => salesDate(o) === today);

  const verifiedTotal = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const shiftTotal = todayPaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-nnorte-red/10 text-nnorte-red-hover border border-nnorte-red/30 text-xs font-semibold mb-1">
            <span>Terminal Kasir POS · {`${branch.name.split('-')[0]}`}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Dashboard Kasir & Transaksi
          </h1>
          <p className="text-xs text-nnorte-muted mt-0.5">
            Kelola penerimaan pembayaran meja, verifikasi QRIS, dan cetak struk pembayaran
          </p>
        </div>

        <button
          onClick={onGoToCheckout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nnorte-red hover:bg-nnorte-red-hover text-white text-xs font-semibold transition-all shadow-lg cursor-pointer"
        >
          <CircleDollarSign size={16} />
          <span>Buka Mesin Kasir / Checkout</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pembayaran Terverifikasi"
          value={formatRupiah(verifiedTotal)}
          icon={CircleDollarSign}
        />
        <StatCard
          title="Menunggu Pembayaran"
          value={`${pendingPaymentOrders.length} Tagihan`}
          changeType={pendingPaymentOrders.length > 0 ? "negative" : "positive"}
          subtext="Perlu penagihan kasir"
          icon={Clock}
        />
        <StatCard
          title="Transaksi Lunas Hari Ini"
          value={`${todayPaidOrders.length} Pesanan`}
          icon={CheckCircle2}
        />
        <StatCard
          title="Total Nilai Shift Ini"
          value={formatRupiah(shiftTotal)}
          icon={Receipt}
        />
      </div>

      {/* Action Required: Pending Payments List */}
      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-nnorte-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-nnorte-text">Tagihan Belum Lunas (Menunggu Tindakan Kasir)</h3>
            <p className="text-xs text-nnorte-muted">Pelanggan meminta tagihan di meja atau pesanan baru takeaway</p>
          </div>
        </div>

        <div className="divide-y divide-nnorte-border">
          {pendingPaymentOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-nnorte-muted">
              Semua tagihan meja saat ini sudah lunas. Tidak ada antrean pembayaran.
            </div>
          ) : (
            pendingPaymentOrders.map((ord) => (
              <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-nnorte-surface-2/60">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[var(--c-red)]">{ord.orderNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-nnorte-surface-2 text-nnorte-text font-semibold border border-nnorte-border">
                      {ord.tableNumber || "Takeaway"}
                    </span>
                  </div>
                  <div className="text-xs text-nnorte-muted mt-1">
                    Atas Nama: <strong className="text-nnorte-text">{ord.customerName}</strong> · {ord.items.length} Menu
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-nnorte-muted block">Total Tagihan:</span>
                    <span className="font-bold text-sm text-nnorte-text">{formatRupiah(ord.totalAmount)}</span>
                  </div>

                  <button
                    onClick={onGoToCheckout}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-nnorte-red hover:bg-nnorte-red-hover text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                  >
                    <span>Proses Bayar</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};




