import React from 'react';
import { Order } from '../../types';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { formatDateTime, formatRupiah, getOrderStatusBadge, getPaymentStatusBadge } from '../../utils/formatters';

const METHOD_LABEL: Record<string, string> = {
  qris: 'QRIS',
  cash: 'Tunai',
  credit_card: 'Kartu Kredit',
  debit_card: 'Kartu Debit',
  bank_transfer: 'Transfer Bank',
};

const pct = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Rincian pesanan; persentase pajak/service diambil dari pengaturan restoran (bukan angka tetap). */
export const OrderDetailModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const { settings } = useApp();
  const status = getOrderStatusBadge(order.status);
  const payment = getPaymentStatusBadge(order.paymentStatus);
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Pesanan #${order.orderNumber}`}
      subtitle={`${order.branchName} • ${formatDateTime(order.createdAt)}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-3">
          <div>
            <span className="block text-nnorte-muted">Pelanggan</span>
            <span className="font-semibold text-nnorte-text">{order.customerName}</span>
          </div>
          <div>
            <span className="block text-nnorte-muted">Meja / Layanan</span>
            <span className="font-semibold text-nnorte-text">{order.orderType === 'dine_in' ? order.tableNumber || 'Dine-in' : 'Takeaway'}</span>
          </div>
          <div>
            <span className="mb-0.5 block text-nnorte-muted">Status Pesanan</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text} ${status.border}`}>{status.label}</span>
          </div>
          <div>
            <span className="mb-0.5 block text-nnorte-muted">Pembayaran</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${payment.bg} ${payment.text} ${payment.border}`}>
              {payment.label}
              {order.paymentMethod ? ` • ${METHOD_LABEL[order.paymentMethod]}` : ''}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-nnorte-border">
          <div className="bg-nnorte-sidebar px-3 py-2 text-[10px] font-bold uppercase text-nnorte-muted">Item Pesanan</div>
          <div className="divide-y divide-nnorte-border">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-semibold text-nnorte-text">{item.name}</div>
                  {item.variantChoice && <div className="text-[11px] text-nnorte-muted">Pilihan: {item.variantChoice}</div>}
                  {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="text-[11px] text-nnorte-muted">Tambahan: {item.selectedAddons.map((a) => a.name).join(', ')}</div>
                  )}
                  {item.notes && <div className="text-[11px] text-nnorte-warning">Catatan: {item.notes}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-nnorte-text">
                    {item.quantity}x {formatRupiah(item.price)}
                  </div>
                  <div className="text-[11px] text-nnorte-muted">{formatRupiah(item.quantity * item.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-nnorte-border bg-nnorte-surface-2 p-3">
          <div className="flex justify-between text-nnorte-muted">
            <span>Subtotal</span>
            <span>{formatRupiah(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-nnorte-muted">
            <span>PB1 ({pct(settings.taxPercentage)}%)</span>
            <span>{formatRupiah(order.tax)}</span>
          </div>
          <div className="flex justify-between text-nnorte-muted">
            <span>Service Charge ({pct(settings.serviceChargePercentage)}%)</span>
            <span>{formatRupiah(order.serviceCharge)}</span>
          </div>
          <div className="flex justify-between border-t border-nnorte-border pt-2 text-sm font-bold text-nnorte-text">
            <span>Total</span>
            <span className="text-nnorte-red">{formatRupiah(order.totalAmount)}</span>
          </div>
          {order.cashTendered != null && (
            <div className="flex justify-between text-nnorte-muted">
              <span>Tunai diterima / kembalian</span>
              <span>
                {formatRupiah(order.cashTendered)} / {formatRupiah(order.changeDue ?? 0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
