import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah, formatDateTime } from "../../utils/formatters";
import { Search, Printer, Receipt, Eye } from "lucide-react";
import { Modal } from "../../components/common/Modal";
import { Order } from "../../types";

export const RiwayatTransaksi: React.FC = () => {
  const { currentUser, orders, branches } = useApp();
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchPaidOrders = orders.filter((o) => o.branchId === branchId && o.paymentStatus === "paid");
  const [search, setSearch] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<Order | null>(null);

  const filtered = branchPaidOrders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Riwayat Transaksi & Pembayaran Selesai
          </h1>
          <p className="text-xs text-nnorte-muted mt-1">
            Arsip seluruh pembayaran terverifikasi di gerai {`${branch.name.split('-')[0]}`}
          </p>
        </div>
      </div>

      <div className="bg-nnorte-surface p-3 rounded-xl border border-nnorte-border">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted"/>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor nota atau pelanggan..."
            className="w-full pl-9 pr-3 py-1.5 bg-nnorte-input border border-nnorte-border rounded-lg text-xs text-nnorte-text placeholder-nnorte-subtle focus:outline-none focus:border-[var(--c-blue)]"
          />
        </div>
      </div>

      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-nnorte-text">
            <thead className="bg-nnorte-sidebar text-nnorte-muted uppercase text-[10px] tracking-wider border-b border-nnorte-border">
              <tr>
                <th className="py-3 px-4 font-semibold">No. Invoice</th>
                <th className="py-3 px-4 font-semibold">Waktu Pembayaran</th>
                <th className="py-3 px-4 font-semibold">Pelanggan</th>
                <th className="py-3 px-4 font-semibold">Meja</th>
                <th className="py-3 px-4 font-semibold">Metode</th>
                <th className="py-3 px-4 font-semibold">Total Tagihan</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nnorte-border">
              {filtered.map((ord) => (
                <tr key={ord.id} className="hover:bg-nnorte-surface-2/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[var(--c-red)]">{ord.orderNumber}</td>
                  <td className="py-3 px-4 text-nnorte-muted">{formatDateTime(ord.paidAt || ord.createdAt)}</td>
                  <td className="py-3 px-4 font-medium">{ord.customerName}</td>
                  <td className="py-3 px-4 text-nnorte-muted">{ord.tableNumber || "Takeaway"}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-nnorte-surface-2 border border-nnorte-border text-nnorte-text">
                      {ord.paymentMethod || "QRIS"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-nnorte-success">{formatRupiah(ord.totalAmount)}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setActiveReceipt(ord)}
                      className="px-2.5 py-1 rounded-lg bg-nnorte-surface-2 hover:bg-nnorte-border text-nnorte-text border border-nnorte-border inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer size={13} />
                      <span>Cetak Ulang</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeReceipt && (
        <Modal
          isOpen={true}
          onClose={() => setActiveReceipt(null)}
          title="Struk Transaksi"
          subtitle={activeReceipt.orderNumber}
          maxWidth="sm"
        >
          <div className="p-4 bg-white text-black font-mono text-xs rounded-lg space-y-2">
            <div className="text-center font-bold pb-2 border-b border-black">
              NNORTE CAFE ({branch.name})
            </div>
            <div className="flex justify-between">
              <span>Order:</span>
              <span>{activeReceipt.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Meja:</span>
              <span>{activeReceipt.tableNumber || "Takeaway"}</span>
            </div>
            <div className="flex justify-between">
              <span>Total:</span>
              <span className="font-bold">{formatRupiah(activeReceipt.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-600">
              <span>Status:</span>
              <span>LUNAS ({activeReceipt.paymentMethod?.toUpperCase()})</span>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                window.print();
              }}
              className="w-full py-2 bg-nnorte-red text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cetak Ulang Struk
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};




