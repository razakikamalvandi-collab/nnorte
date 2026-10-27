import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah, formatDateTime } from "../../utils/formatters";
import { PaymentMethod, Order, MasterMenuItem } from "../../types";
import { CreditCard, QrCode, Banknote, Building2, Printer, CheckCircle2, Receipt, ArrowRight, Plus, Minus, ShoppingBag } from "lucide-react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/ui/Button";
import { Field, inputClass } from "../../components/ui/Field";

export const TransaksiPembayaran: React.FC = () => {
  const { currentUser, orders, processPayment, branches, addToast, masterMenus, branchMenus, createTakeawayOrder, settings } = useApp();
  const [paying, setPaying] = useState(false);
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchOrders = orders.filter((o) => o.branchId === branchId);
  const pendingOrders = branchOrders.filter((o) => o.paymentStatus === 'unpaid');

  const [selectedOrderId, setSelectedOrderId] = useState<string>(pendingOrders[0]?.id || branchOrders[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qris');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);
  const [takeawayOpen, setTakeawayOpen] = useState(false);
  const [takeawayBusy, setTakeawayBusy] = useState(false);
  const [takeawayError, setTakeawayError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});

  const availableMenus = masterMenus.filter((menu) => {
    const local = branchMenus.find((entry) => entry.branchId === branchId && entry.menuId === menu.id);
    return menu.status === 'active' && local?.isAvailable !== false && !local?.isSoldOutToday
      && menu.name.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'));
  });
  const cartMenus = masterMenus.filter((menu) => cart[menu.id]);
  const cartSubtotal = cartMenus.reduce((sum, menu) => {
    const price = branchMenus.find((entry) => entry.branchId === branchId && entry.menuId === menu.id)?.price ?? menu.basePrice;
    return sum + price * (cart[menu.id] ?? 0);
  }, 0);
  const cartTax = Math.round(cartSubtotal * settings.taxPercentage / 100);
  const cartService = Math.round(cartSubtotal * settings.serviceChargePercentage / 100);
  const cartTotal = cartSubtotal + cartTax + cartService;

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

  const submitTakeaway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (takeawayBusy) return;
    const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([menuId, quantity]) => ({ menuId, quantity, addonIds: [] as string[] }));
    if (!customerName.trim()) return setTakeawayError('Nama pelanggan wajib diisi.');
    if (!items.length) return setTakeawayError('Pilih minimal satu menu.');
    setTakeawayBusy(true);
    setTakeawayError(null);
    const result = await createTakeawayOrder({ customerName, customerPhone, items });
    setTakeawayBusy(false);
    if (!result.ok) return setTakeawayError(result.error);
    setTakeawayOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    setCart({});
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
        <button type="button" onClick={() => { setTakeawayError(null); setTakeawayOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-nnorte-blue px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-nnorte-blue-hover">
          <ShoppingBag size={16} /> Pesanan Takeaway
        </button>
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

      <Modal isOpen={takeawayOpen} onClose={() => !takeawayBusy && setTakeawayOpen(false)} busy={takeawayBusy} title="Pesanan Takeaway" subtitle="Pilih menu untuk pelanggan yang membawa pulang." maxWidth="xl" footer={
        <>
          <Button variant="secondary" onClick={() => setTakeawayOpen(false)} disabled={takeawayBusy}>Batal</Button>
          <Button type="submit" form="cashier-takeaway-form" loading={takeawayBusy} loadingText="Membuat pesanan…">Buat Pesanan · {formatRupiah(cartTotal)}</Button>
        </>
      }>
        <form id="cashier-takeaway-form" onSubmit={submitTakeaway} className="space-y-4">
          {takeawayError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{takeawayError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nama Pelanggan" required><input className={inputClass()} value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={80} required /></Field>
            <Field label="Nomor Telepon"><input className={inputClass()} type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={30} /></Field>
          </div>
          <input aria-label="Cari menu" className={inputClass()} placeholder="Cari menu…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {availableMenus.map((menu: MasterMenuItem) => {
              const price = branchMenus.find((entry) => entry.branchId === branchId && entry.menuId === menu.id)?.price ?? menu.basePrice;
              const quantity = cart[menu.id] ?? 0;
              return <div key={menu.id} className="flex items-center justify-between gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-nnorte-text">{menu.name}</p><p className="text-[11px] text-nnorte-muted">{formatRupiah(price)}</p></div>
                <div className="flex shrink-0 items-center gap-2"><button type="button" aria-label={`Kurangi ${menu.name}`} onClick={() => setCart((current) => ({ ...current, [menu.id]: Math.max(0, (current[menu.id] ?? 0) - 1) }))} className="rounded-md border border-nnorte-border p-1.5 text-nnorte-text"><Minus size={13} /></button><span className="w-4 text-center text-xs font-bold">{quantity}</span><button type="button" aria-label={`Tambah ${menu.name}`} onClick={() => setCart((current) => ({ ...current, [menu.id]: Math.min(50, (current[menu.id] ?? 0) + 1) }))} className="rounded-md border border-nnorte-border p-1.5 text-nnorte-text"><Plus size={13} /></button></div>
              </div>;
            })}
            {availableMenus.length === 0 && <p className="col-span-full py-6 text-center text-xs text-nnorte-muted">Tidak ada menu tersedia yang cocok.</p>}
          </div>
          <div className="space-y-1 border-t border-nnorte-border pt-3 text-xs">
            <div className="flex justify-between text-nnorte-muted"><span>Subtotal</span><span>{formatRupiah(cartSubtotal)}</span></div>
            {settings.taxPercentage > 0 && <div className="flex justify-between text-nnorte-muted"><span>Pajak ({settings.taxPercentage}%)</span><span>{formatRupiah(cartTax)}</span></div>}
            {settings.serviceChargePercentage > 0 && <div className="flex justify-between text-nnorte-muted"><span>Service ({settings.serviceChargePercentage}%)</span><span>{formatRupiah(cartService)}</span></div>}
            <div className="flex justify-between pt-1 font-bold text-nnorte-text"><span>Total</span><span>{formatRupiah(cartTotal)}</span></div>
          </div>
        </form>
      </Modal>

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
              {receiptModalOrder.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Kompensasi:</span><span>−{formatRupiah(receiptModalOrder.discount)}</span></div>}
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
