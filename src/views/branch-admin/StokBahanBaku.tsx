import React, { useMemo, useState } from "react";
import { EMPTY_BRANCH } from '../../lib/emptyBranch';
import { useApp } from "../../context/AppContext";
import { formatRupiah } from "../../utils/formatters";
import { AlertTriangle, CheckCircle2, Package, Plus, XCircle } from "lucide-react";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/ui/Button";
import { Field, inputClass } from "../../components/ui/Field";

const EMPTY_ADD = {
  name: "",
  category: "",
  unit: "",
  currentStock: "0",
  minThreshold: "0",
  costPerUnit: "0",
};

export const StokBahanBaku: React.FC = () => {
  const { currentUser, branches, inventory, masterMenus, adjustStock, addInventoryItem } = useApp();
  const branchId = currentUser?.branchId || '';
  const branch = branches.find((b) => b.id === branchId) ?? EMPTY_BRANCH;

  const branchInv = inventory.filter((i) => i.branchId === branchId);

  const suggestions = useMemo(() => {
    const byName = new Map<string, { name: string; unit: string }>();
    masterMenus.forEach((menu) => (menu.ingredients ?? []).forEach((ingredient) => {
      const name = ingredient.name.trim();
      const unit = ingredient.unit.trim();
      if (!name || !unit) return;
      const key = name.toLocaleLowerCase('id-ID');
      if (!byName.has(key)) byName.set(key, { name, unit });
    }));
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [masterMenus]);

  const [adjustItem, setAdjustItem] = useState<{ id: string; name: string; unit: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(10);
  const [adjustNote, setAdjustNote] = useState("Penerimaan Suplai Rutin");

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState(EMPTY_ADD);

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustItem) {
      adjustStock(adjustItem.id, adjustAmount, adjustNote);
      setAdjustItem(null);
    }
  };

  const openAdd = () => {
    setAddForm(EMPTY_ADD);
    setAddError(null);
    setAddOpen(true);
  };

  const handleAddName = (value: string) => {
    const match = suggestions.find((s) => s.name.toLocaleLowerCase('id-ID') === value.trim().toLocaleLowerCase('id-ID'));
    setAddForm((f) => ({ ...f, name: value, unit: match ? match.unit : f.unit }));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addSaving) return;
    const name = addForm.name.trim();
    const unit = addForm.unit.trim();
    const currentStock = Number(addForm.currentStock);
    const minThreshold = Number(addForm.minThreshold);
    const costPerUnit = Number(addForm.costPerUnit);

    if (!branchId) return setAddError('Cabang aktif tidak ditemukan.');
    if (!name) return setAddError('Nama bahan wajib diisi.');
    if (!unit) return setAddError('Satuan wajib diisi.');
    if (![currentStock, minThreshold, costPerUnit].every((v) => Number.isFinite(v) && v >= 0)) {
      return setAddError('Stok, ambang minimum, dan harga harus berupa angka 0 atau lebih.');
    }

    setAddError(null);
    setAddSaving(true);
    try {
      const res = await addInventoryItem({
        name,
        category: addForm.category,
        unit,
        currentStock,
        minThreshold,
        costPerUnit,
      });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">
            Stok Bahan Baku & Inventaris Dapur
          </h1>
          <p className="mt-1 text-xs text-nnorte-muted">
            Cabang {branch.name} · Tambah bahan, atur stok, dan resep Master Katalog akan memotong stok otomatis saat pesanan masuk.
          </p>
        </div>
        <Button icon={<Plus size={15} />} onClick={openAdd} disabled={!branchId}>Tambah Bahan</Button>
      </div>

      {branchInv.length === 0 ? (
        <div className="rounded-xl border border-dashed border-nnorte-border bg-nnorte-surface p-8 text-center">
          <Package size={30} className="mx-auto text-nnorte-muted" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-nnorte-text">Belum ada bahan baku di cabang ini</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-nnorte-muted">
            Tambahkan bahan pertama. Nama dan satuan dari resep Master Katalog akan muncul sebagai saran agar stok bisa terpotong otomatis.
          </p>
          <Button className="mt-4" icon={<Plus size={14} />} onClick={openAdd} disabled={!branchId}>Tambah Bahan Pertama</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-nnorte-text">
              <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama Bahan Baku</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Stok Saat Ini</th>
                  <th className="px-4 py-3 font-semibold">Ambang Min.</th>
                  <th className="px-4 py-3 font-semibold">Estimasi Biaya Satuan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nnorte-border">
                {branchInv.map((item) => {
                  const status = item.status === 'out_of_stock'
                    ? { label: 'Habis', className: 'border-nnorte-error/30 bg-nnorte-error/10 text-nnorte-error', Icon: XCircle }
                    : item.status === 'low_stock'
                      ? { label: 'Menipis', className: 'border-nnorte-warning/30 bg-nnorte-warning/10 text-nnorte-warning', Icon: AlertTriangle }
                      : { label: 'Tersedia Aman', className: 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success', Icon: CheckCircle2 };

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-nnorte-surface-2/60">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-[var(--c-red)]" aria-hidden="true" />
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-nnorte-muted">{item.category}</td>
                      <td className="px-4 py-3 text-sm font-bold">
                        {item.currentStock} <span className="text-xs font-normal text-nnorte-muted">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-nnorte-muted">{item.minThreshold} {item.unit}</td>
                      <td className="px-4 py-3 text-nnorte-muted">{formatRupiah(item.costPerUnit)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                          <status.Icon size={11} aria-hidden="true" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setAdjustItem({ id: item.id, name: item.name, unit: item.unit })}
                          className="nn-press cursor-pointer rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-2.5 py-1 text-nnorte-text transition-colors hover:bg-nnorte-border"
                        >
                          Sesuaikan Stok
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={addOpen}
        onClose={() => { if (!addSaving) setAddOpen(false); }}
        busy={addSaving}
        title="Tambah Bahan Baku"
        subtitle={`Cabang ${branch.name}`}
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={addSaving}>Batal</Button>
            <Button type="submit" form="stock-add-form" loading={addSaving} loadingText="Menyimpan…">Tambah Bahan</Button>
          </>
        }
      >
        <form id="stock-add-form" onSubmit={handleAdd} noValidate className="space-y-3">
          {addError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{addError}</p>}

          <Field label="Nama Bahan" required hint="Pilih dari resep Master Katalog agar nama dan satuan cocok.">
            <input
              type="text"
              list="stock-ingredient-suggestions"
              className={inputClass()}
              value={addForm.name}
              onChange={(e) => handleAddName(e.target.value)}
              maxLength={100}
              placeholder="Contoh: Kentang"
            />
          </Field>
          <datalist id="stock-ingredient-suggestions">
            {suggestions.map((s) => <option key={s.name} value={s.name} label={`${s.name} (${s.unit})`} />)}
          </datalist>

          <Field label="Kategori" hint="Kosongkan untuk memakai kategori Bahan Baku.">
            <input
              type="text"
              className={inputClass()}
              value={addForm.category}
              onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
              maxLength={60}
              placeholder="Bahan Baku"
            />
          </Field>

          <Field label="Satuan" required hint="Harus sama dengan satuan di resep, misalnya kg, gram, atau pcs.">
            <input
              type="text"
              className={inputClass()}
              value={addForm.unit}
              onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
              maxLength={30}
              placeholder="kg"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Stok Awal" required>
              <input
                type="number"
                min={0}
                step={0.001}
                className={inputClass()}
                value={addForm.currentStock}
                onChange={(e) => setAddForm((f) => ({ ...f, currentStock: e.target.value }))}
              />
            </Field>
            <Field label="Ambang Minimum" required>
              <input
                type="number"
                min={0}
                step={0.001}
                className={inputClass()}
                value={addForm.minThreshold}
                onChange={(e) => setAddForm((f) => ({ ...f, minThreshold: e.target.value }))}
              />
            </Field>
            <Field label="Harga per Satuan" required>
              <input
                type="number"
                min={0}
                step={100}
                className={inputClass()}
                value={addForm.costPerUnit}
                onChange={(e) => setAddForm((f) => ({ ...f, costPerUnit: e.target.value }))}
              />
            </Field>
          </div>
        </form>
      </Modal>

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
              <label className="mb-1 block font-medium text-nnorte-muted">
                Jumlah Penambahan / Pengurangan (+/-)
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-3 py-2 font-bold text-nnorte-text focus:border-nnorte-blue focus:outline-none"
                required
              />
              <span className="mt-1 block text-[11px] text-nnorte-muted">
                Gunakan angka positif untuk barang masuk (+), atau negatif (-) untuk barang rusak/koreksi.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-medium text-nnorte-muted">Catatan / Alasan Mutasi</label>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g. Suplai dari vendor daging PT Boga..."
                className="w-full rounded-lg border border-nnorte-border bg-nnorte-surface-2 px-3 py-2 text-nnorte-text focus:border-nnorte-blue focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-nnorte-border pt-3">
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="rounded-lg bg-nnorte-surface-2 px-3 py-1.5 text-nnorte-muted hover:text-nnorte-text"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-nnorte-red px-4 py-1.5 font-semibold text-nnorte-on-brand"
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
