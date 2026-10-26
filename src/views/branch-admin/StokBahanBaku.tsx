import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah } from "../../utils/formatters";
import { Package, AlertTriangle, Plus, RotateCcw, CheckCircle2, TrendingDown } from "lucide-react";
import { Modal } from "../../components/common/Modal";

export const StokBahanBaku: React.FC = () => {
  const { currentUser, branches, inventory, adjustStock } = useApp();
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchInv = inventory.filter((i) => i.branchId === branchId);

  const [adjustItem, setAdjustItem] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(10);
  const [adjustNote, setAdjustNote] = useState("Penerimaan Suplai Rutin");

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustItem) {
      adjustStock(adjustItem.id, adjustAmount, adjustNote);
      setAdjustItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Stok Bahan Baku & Inventaris Dapur
          </h1>
          <p className="text-xs text-nnorte-muted mt-1">
            Cabang {branch.name} · Monitor persediaan daging prime, bumbu artisan, dan kayu bakar
          </p>
        </div>
      </div>

      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-nnorte-text">
            <thead className="bg-nnorte-sidebar text-nnorte-muted uppercase text-[10px] tracking-wider border-b border-nnorte-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Nama Bahan Baku</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold">Stok Saat Ini</th>
                <th className="py-3 px-4 font-semibold">Ambang Min.</th>
                <th className="py-3 px-4 font-semibold">Estimasi Biaya Satuan</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nnorte-border">
              {branchInv.map((item) => (
                <tr key={item.id} className="hover:bg-nnorte-surface-2/60 transition-colors">
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-[var(--c-red)]" />
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-nnorte-muted">{item.category}</td>
                  <td className="py-3 px-4 font-bold text-sm">
                    {item.currentStock} <span className="text-xs font-normal text-nnorte-muted">{item.unit}</span>
                  </td>
                  <td className="py-3 px-4 text-nnorte-muted">{item.minThreshold} {item.unit}</td>
                  <td className="py-3 px-4 text-nnorte-muted">{formatRupiah(item.costPerUnit)}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        item.status === 'low_stock'
                          ? 'bg-nnorte-warning/10 text-nnorte-warning border-nnorte-warning/30'
                          : 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30'
                      }`}>
                  {item.status === 'low_stock' ? 'Menipis' : 'Tersedia Aman'}
                    </span>

                      {item.status === "low_stock" ? (
                        <>
                          <AlertTriangle size={11} />
                          Menipis
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={11} />
                          Tersedia Aman
                        </>
                      )}

                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setAdjustItem({ id: item.id, name: item.name, unit: item.unit })}
                      className="px-2.5 py-1 rounded-lg bg-nnorte-surface-2 hover:bg-nnorte-border text-nnorte-text border border-nnorte-border transition-colors cursor-pointer"
                    >
                      Sesuaikan Stok
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjustItem && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustItem(null)}
          title={`Penyesuaian Stok: ${adjustItem.name}`}
          subtitle={`Satuan: ${adjustItem.unit}`}
          maxWidth="sm"
        >
          <form onSubmit={handleAdjust} className="space-y-4 text-xs">
            <div>
              <label className="block text-nnorte-muted mb-1 font-medium">
                Jumlah Penambahan / Pengurangan (+/-)
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-nnorte-surface-2 border border-nnorte-border rounded-lg text-nnorte-text focus:border-nnorte-blue focus:outline-none font-bold"
                required
              />
              <span className="text-[11px] text-nnorte-muted mt-1 block">
                Gunakan angka positif untuk barang masuk (+), atau negatif (-) untuk barang rusak/koreksi.
              </span>
            </div>

            <div>
              <label className="block text-nnorte-muted mb-1 font-medium">Catatan / Alasan Mutasi</label>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g. Suplai dari vendor daging PT Boga..."
                className="w-full px-3 py-2 bg-nnorte-surface-2 border border-nnorte-border rounded-lg text-nnorte-text focus:border-nnorte-blue focus:outline-none"
                required
              />
            </div>

            <div className="pt-3 border-t border-nnorte-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="px-3 py-1.5 rounded-lg bg-nnorte-surface-2 text-nnorte-muted hover:text-nnorte-text"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-nnorte-red text-nnorte-on-brand font-semibold"
              >
                Terapkan Mutasi Stok
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};




