import React, { useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah } from "../../utils/formatters";
import { Search, Tag, Check, X, AlertCircle, Edit3 } from "lucide-react";
import { Modal } from "../../components/common/Modal";

export const MenuHargaCabang: React.FC = () => {
  const {
    currentUser,
    branches,
    masterMenus,
    branchMenus,
    updateBranchPrice,
    toggleBranchAvailability,
    toggleBranchSoldOut,
  } = useApp();

  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const [search, setSearch] = useState('');
  const [editingPriceItem, setEditingPriceItem] = useState<{ menuId: string; name: string; currentPrice: number } | null>(null);
  const [newPrice, setNewPrice] = useState(0);

  // Tampilkan hanya menu aktif yang sudah didistribusikan ke cabang ini.
  // Katalog pusat juga memuat salinan cabang dan menu arsip; menampilkan
  // semuanya menyebabkan satu hidangan terlihat dua kali.
  const branchMenuIds = new Set(
    branchMenus.filter((item) => item.branchId === branchId).map((item) => item.menuId),
  );
  const filteredMenus = masterMenus.filter(
    (menu) =>
      menu.status === 'active' &&
      branchMenuIds.has(menu.id) &&
      (menu.name.toLowerCase().includes(search.toLowerCase()) ||
        menu.category.toLowerCase().includes(search.toLowerCase())),
  );

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPriceItem) {
      updateBranchPrice(branchId, editingPriceItem.menuId, newPrice);
      setEditingPriceItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-nnorte-text tracking-tight">
            Menu & Harga Jual Cabang ({`${branch.name.split('-')[0]}`})
          </h1>
          <p className="text-xs text-nnorte-muted mt-1">
            Sesuaikan harga jual lokal dan kontrol ketersediaan stok menu hari ini tanpa merusak katalog pusat
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
            placeholder="Cari hidangan atau kategori..."
            className="w-full pl-9 pr-3 py-1.5 bg-nnorte-surface-2 border border-nnorte-border rounded-lg text-xs text-nnorte-text placeholder-nnorte-subtle focus:outline-none focus:border-nnorte-blue"
          />
        </div>
      </div>

      <div className="bg-nnorte-surface border border-nnorte-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-nnorte-text">
            <thead className="bg-nnorte-sidebar text-nnorte-muted uppercase text-[10px] tracking-wider border-b border-nnorte-border">
              <tr>
                <th className="py-3 px-4 font-semibold">Menu Hidangan</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold">Harga Pusat (Base)</th>
                <th className="py-3 px-4 font-semibold">Harga Jual Cabang</th>
                <th className="py-3 px-4 font-semibold">Status Stok</th>
                <th className="py-3 px-4 font-semibold">Penjualan Lokal</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nnorte-border">
              {filteredMenus.map((menu) => {
                const localPricing = branchMenus.find(
                  (bm) => bm.branchId === branchId && bm.menuId === menu.id
                );
                const price = localPricing?.price || menu.basePrice;
                const isAvailable = localPricing?.isAvailable !== false;
                const isSoldOut = !!localPricing?.isSoldOutToday;

                return (
                  <tr key={menu.id} className="hover:bg-nnorte-surface-2/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={menu.image}
                          alt={menu.name}
                          className="w-10 h-10 rounded-lg object-cover border border-nnorte-border"
                        />
                        <div>
                          <div className="font-bold text-nnorte-text">{menu.name}</div>
                          <div className="text-[10px] text-nnorte-muted font-mono">{menu.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-nnorte-muted">{menu.category}</td>
                    <td className="py-3 px-4 text-nnorte-muted">{formatRupiah(menu.basePrice)}</td>
                    <td className="py-3 px-4 font-bold text-[var(--c-red)]">{formatRupiah(price)}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleBranchSoldOut(branchId, menu.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${
                          isSoldOut
                            ? 'bg-nnorte-error/10 text-nnorte-error border-nnorte-error/30'
                            : 'bg-nnorte-success/10 text-nnorte-success border-nnorte-success/30'
                        }`}>
                      {isSoldOut ? 'Habis Hari Ini' : 'Tersedia'}
                    </button>

                        {isSoldOut ? 'Habis Hari Ini' : 'Tersedia'}

                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleBranchAvailability(branchId, menu.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                          isAvailable
                            ? 'bg-nnorte-surface-2 text-nnorte-success border border-nnorte-border'
                            : 'bg-nnorte-surface-2 text-nnorte-muted border border-nnorte-border'
                        }`}
                      >
                        {isAvailable ? "Aktif" : "Dinonaktifkan"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingPriceItem({ menuId: menu.id, name: menu.name, currentPrice: price });
                          setNewPrice(price);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-nnorte-surface-2 hover:bg-nnorte-border text-nnorte-text border border-nnorte-border inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Ubah Harga</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingPriceItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingPriceItem(null)}
          title={`Ubah Harga Jual: ${editingPriceItem.name}`}
          subtitle={`Cabang: ${branch.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleSavePrice} className="space-y-4 text-xs">
            <div>
              <label className="block text-nnorte-muted mb-1 font-medium">Harga Jual Baru (IDR)</label>
              <input
                type="number"
                step="1000"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-nnorte-surface-2 border border-nnorte-border rounded-lg text-nnorte-text focus:border-nnorte-blue focus:outline-none text-base font-bold text-nnorte-red"
                required
              />
              <span className="text-[11px] text-nnorte-muted mt-1 block">
                Format: {formatRupiah(newPrice)}
              </span>
            </div>

            <div className="pt-3 border-t border-nnorte-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPriceItem(null)}
                className="px-3 py-1.5 rounded-lg bg-nnorte-surface-2 text-nnorte-muted hover:text-nnorte-text"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-nnorte-red text-white font-semibold"
              >
                Simpan Harga Cabang
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};




