import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah, formatDateTime } from "../../utils/formatters";
import { PaymentMethod, Order } from "../../types";
import { CreditCard, QrCode, Banknote, Building2, Printer, CheckCircle2, Receipt, ArrowRight } from "lucide-react";
import { Modal } from "../../components/common/Modal";

export const TransaksiPembayaran: React.FC = () => {
  const { currentUser, orders, processPayment, branches, addToast } = useApp();
  const [paying, setPaying] = useState(false);
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchOrders = orders.filter((o) => o.branchId === branchId);
  const pendingOrders = branchOrders.filter((o) => o.paymentStatus === 'unpaid');

  const [selectedOrderId, setSelectedOrderId] = useState<string>(pendingOrders[0]?.id || branchOrders[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qris');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);

  const activeOrder = orders.find((o) => o.id === selectedOrderId);

  const total = activeOrder?.totalAmount || 0;
  const changeDue = Math.max(0, cashTendered - total);

  const handleConfirmPayment = async () => {
    if (!activeOrder || paying) return;
    if (activeOrder.paymentStatus === 'paid') {
      addToast('info', 'Pesanan ini sudah lunas.');
      return;
    }
    if (paymentMethod === 'cash' && cashTendered < total) {
      addToast('error', 'Uang tunai yang diterima kurang dari total tagihan.');
      return;
    }
    setPaying(true);
    const res = await processPayment(activeOrder.id, paymentMethod, paymentMethod === 'cash' ? cashTendered : undefined);
    setPaying(false);
    if (!res.ok) {
      addToast('error', res.error);
      return;
    }
    const updated = {
      ...activeOrder,
      paymentStatus: 'paid' as const,
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? cashTendered : undefined,
      changeDue: paymentMethod === 'cash' ? changeDue : 0,
      paidAt: new Date().toISOString(),
    };
    setReceiptModalOrder(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Terminal POS & Kasir Pembayaran
          </h1>
          <p className="text-xs text-nnorte-muted mt-1">
            Pilih tagihan meja, tentukan metode pembayaran, hitung kembalian, dan cetak struk resmi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List of orders to checkout */}
        <div className="bg-nnorte-surface border border-nnorte-border rounded-xl p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-nnorte-text">Pilih Tagihan / Pesanan</h3>
          <p className="text-xs text-nnorte-muted">Pesanan meja dan takeaway yang siap dibayar</p>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {branchOrders.map((ord) => {
              const isSelected = ord.id === selectedOrderId;
              const isPaid = ord.paymentStatus === 'paid';

              return (
                <div
                  key={ord.id}
                  onClick={() => {
                    setSelectedOrderId(ord.id);
                    setCashTendered(ord.totalAmount);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-nnorte-red-dark/30 border-nnorte-red shadow-md'
                      : 'bg-nnorte-surface-2 border-nnorte-border hover:border-nnorte-subtle'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-nnorte-text">{ord.orderNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        isPaid
                          ? 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30'
                          : 'bg-nnorte-error/10 text-nnorte-error border-nnorte-error/30'
                      }`}
                    >
                      {isPaid ? 'Sudah Lunas' : 'Belum Lunas'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-nnorte-text">{ord.customerName}</span>
                      <span className="text-[11px] text-nnorte-muted block">{ord.tableNumber || 'Takeaway'}</span>
                    </div>
                    <span className="font-bold text-nnorte-red">{formatRupiah(ord.totalAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Checkout Details & Tender Terminal (2 cols) */}
        <div className="lg:col-span-2 bg-nnorte-surface border border-nnorte-border rounded-xl p-5 space-y-5">
          {activeOrder ? (
            <>
              <div className="flex items-center justify-between border-b border-nnorte-border pb-4">
                <div>
                  <span className="text-[10px] font-mono text-nnorte-red font-bold">RINCIAN TAGIHAN</span>
                  <h3 className="text-base font-bold text-nnorte-text">
                    #{activeOrder.orderNumber} ({activeOrder.tableNumber || 'Takeaway'})
                  </h3>
                  <p className="text-xs text-nnorte-muted">Pelanggan: {activeOrder.customerName}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-nnorte-muted block">Total Tagihan Bersih:</span>
                  <span className="text-xl font-extrabold text-nnorte-red">{formatRupiah(activeOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-xs">
                {activeOrder.items.map((it, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-nnorte-surface-2 border border-nnorte-border">
                    <div>
                      <span className="font-semibold text-nnorte-text">{it.name}</span>
                      {it.variantChoice && <span className="text-[11px] text-nnorte-muted block">({it.variantChoice})</span>}
                    </div>
                    <span className="font-bold text-nnorte-text">{it.quantity}x {formatRupiah(it.price)}</span>
                  </div>
                ))}
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-nnorte-text mb-2">Pilih Cara Pembayaran:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'qris'
                        ? 'bg-nnorte-red-dark border-nnorte-red text-white shadow-lg'
                        : 'bg-nnorte-surface-2 border-nnorte-border text-nnorte-muted hover:text-nnorte-text'
                    }`}
                  >
                    <QrCode size={18} />
                    <span className="text-xs font-bold">QRIS Dinamis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setCashTendered(activeOrder.totalAmount);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-nnorte-red-dark border-nnorte-red text-white shadow-lg'
                        : 'bg-nnorte-surface-2 border-nnorte-border text-nnorte-muted hover:text-nnorte-text'
                    }`}
                  >
                    <Banknote size={18} />
                    <span className="text-xs font-bold">Uang Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit_card')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'credit_card'
                        ? 'bg-nnorte-red-dark border-nnorte-red text-white shadow-lg'
                        : 'bg-nnorte-surface-2 border-nnorte-border text-nnorte-muted hover:text-nnorte-text'
                    }`}
                  >
                    <CreditCard size={18} />
                    <span className="text-xs font-bold">Kartu Kredit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('debit_card')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'debit_card'
                        ? 'bg-nnorte-red-dark border-nnorte-red text-white shadow-lg'
                        : 'bg-nnorte-surface-2 border-nnorte-border text-nnorte-muted hover:text-nnorte-text'
                    }`}
                  >
                    <Building2 size={18} />
                    <span className="text-xs font-bold">Debit / Transfer</span>
                  </button>
                </div>
              </div>

              {/* Cash Calculation Terminal */}
              {paymentMethod === 'cash' && (
                <div className="p-4 rounded-xl bg-nnorte-surface-2 border border-nnorte-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-nnorte-muted">Uang Tunai Diterima (Tendered):</span>
                    <input
                      type="number"
                      step="5000"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      className="px-3 py-1.5 bg-nnorte-surface border border-nnorte-border rounded-lg text-sm font-bold text-nnorte-text text-right focus:border-nnorte-blue focus:outline-none w-44"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-nnorte-border">
                    <span className="font-semibold text-nnorte-muted">Kembalian (Change Due):</span>
                    <span className="text-base font-extrabold text-nnorte-success">{formatRupiah(changeDue)}</span>
                  </div>
                </div>
              )}

              {/* Confirm Payment Button */}
              <div className="pt-3">
                <button
                  onClick={handleConfirmPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-nnorte-red hover:bg-nnorte-red-hover text-white font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  <span>
                    {activeOrder.paymentStatus === 'paid'
                      ? 'Cetak Ulang Struk Pembayaran'
                      : `Konfirmasi Pembayaran ${formatRupiah(activeOrder.totalAmount)}`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-nnorte-muted">
              Pilih pesanan di sebelah kiri untuk memulai pembayaran.
            </div>
          )}
        </div>
      </div>

      {/* Official Receipt Thermal Preview Modal */}
      {receiptModalOrder && (
        <Modal
          isOpen={true}
          onClose={() => setReceiptModalOrder(null)}
          title="Struk Resmi Pembayaran NNORTE"
          subtitle={`No: ${receiptModalOrder.orderNumber}`}
          maxWidth="sm"
        >
          <div className="bg-white text-black p-6 rounded-xl font-mono text-xs space-y-3 shadow-inner">
            <div className="text-center pb-2 border-b border-dashed border-zinc-400">
              <h3 className="font-black text-sm tracking-wider">NNORTE WOOD-FIRED</h3>
              <p className="text-[10px] text-zinc-600">{branch.name}</p>
              <p className="text-[10px] text-zinc-500">{branch.address}</p>
              <p className="text-[10px] text-zinc-500">Tel: {branch.phone}</p>
            </div>

            <div className="text-[11px] space-y-1 pb-2 border-b border-dashed border-zinc-400">
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formatDateTime(receiptModalOrder.paidAt || receiptModalOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Meja:</span>
                <span>{receiptModalOrder.tableNumber || 'Takeaway'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span>{receiptModalOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{currentUser?.name || 'Dimas S.'}</span>
              </div>
            </div>

            <div className="space-y-1.5 py-1 pb-2 border-b border-dashed border-zinc-400">
              {receiptModalOrder.items.map((it, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span>{it.quantity}x {it.name}</span>
                  <span>{formatRupiah(it.quantity * it.price)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-zinc-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(receiptModalOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>PB1 Restoran (10%):</span>
                <span>{formatRupiah(receiptModalOrder.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service (5%):</span>
                <span>{formatRupiah(receiptModalOrder.serviceCharge)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1">
                <span>TOTAL:</span>
                <span>{formatRupiah(receiptModalOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Metode:</span>
                <span className="uppercase">{receiptModalOrder.paymentMethod || 'QRIS'} (LUNAS)</span>
              </div>
              {receiptModalOrder.cashTendered && (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>Tunai Diterima:</span>
                    <span>{formatRupiah(receiptModalOrder.cashTendered)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(receiptModalOrder.changeDue || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center text-[10px] pt-1 text-zinc-600">
              <p>Terima kasih atas kunjungan Anda!</p>
              <p>Follow IG: @nnorte.grill</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                window.print();
                setReceiptModalOrder(null);
              }}
              className="w-full py-2.5 rounded-lg bg-nnorte-red hover:bg-nnorte-red-hover text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Printer size={15} />
              <span>Cetak Struk Thermal</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};