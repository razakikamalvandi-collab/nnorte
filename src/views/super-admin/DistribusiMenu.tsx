import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, Share2, ShieldCheck, Utensils, MinusCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatRupiah } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';

const Thumb: React.FC<{ src?: string; alt: string; className: string }> = ({ src, alt, className }) =>
  src ? (
    <img src={src} alt={alt} className={`${className} object-cover`} loading="lazy" />
  ) : (
    <span className={`${className} flex items-center justify-center bg-nnorte-sidebar text-nnorte-muted`} aria-hidden="true">
      <Utensils size={16} />
    </span>
  );

const SelectAll: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}> = ({ checked, indeterminate = false, disabled = false, onChange, children }) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label className={`flex min-h-9 items-center gap-2 text-xs ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input ref={ref} type="checkbox" className="h-4 w-4 accent-[var(--c-red)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
};

export const DistribusiMenu: React.FC = () => {
  const { masterMenus, branches, branchMenus, distributeMenus, addToast } = useApp();
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedMenuIds((prev) => {
      const valid = prev.filter((id) => masterMenus.some((m) => m.id === id));
      if (valid.length === prev.length && valid.length > 0) return prev;
      if (valid.length > 0) return valid;
      return masterMenus[0] ? [masterMenus[0].id] : [];
    });
  }, [masterMenus]);

  const selectedMenus = useMemo(() => masterMenus.filter((m) => selectedMenuIds.includes(m.id)), [masterMenus, selectedMenuIds]);
  const owned = useMemo(() => new Set(branchMenus.map((b) => `${b.branchId}|${b.menuId}`)), [branchMenus]);
  const missingCount = (branchId: string) => selectedMenus.filter((m) => !owned.has(`${branchId}|${m.id}`)).length;

  const branchRows = branches.map((branch) => ({ branch, missing: missingCount(branch.id) }));
  const selectableBranches = branchRows.filter((r) => r.missing > 0).map((r) => r.branch.id);
  const targets = selectedBranches.filter((id) => selectableBranches.includes(id));
  const pairCount = branchRows.reduce((sum, r) => (targets.includes(r.branch.id) ? sum + r.missing : sum), 0);

  const allMenusChecked = masterMenus.length > 0 && selectedMenuIds.length === masterMenus.length;
  const someMenusChecked = selectedMenuIds.length > 0 && !allMenusChecked;
  const allBranchesChecked = selectableBranches.length > 0 && selectableBranches.every((id) => selectedBranches.includes(id));
  const someBranchesChecked = selectedBranches.some((id) => selectableBranches.includes(id)) && !allBranchesChecked;

  const toggleMenu = (id: string) => setSelectedMenuIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleBranch = (id: string) => setSelectedBranches((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const selectAllMenus = (checked: boolean) => setSelectedMenuIds(checked ? masterMenus.map((m) => m.id) : []);
  const selectAllBranches = (checked: boolean) => setSelectedBranches(checked ? selectableBranches : []);

  const apply = async () => {
    if (busy) return;
    if (selectedMenus.length === 0) return addToast('info', 'Pilih setidaknya satu menu master.');
    if (targets.length === 0) return addToast('info', 'Pilih cabang yang belum memiliki menu terpilih.');
    setBusy(true);
    const res = await distributeMenus(selectedMenus.map((m) => m.id), targets);
    setBusy(false);
    if (!res.ok) return addToast('error', res.error);
    setSelectedBranches([]);
    addToast('success', `${res.added ?? 0} entri menu ditambahkan ke ${targets.length} cabang.`);
  };

  if (masterMenus.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-extrabold text-nnorte-text sm:text-2xl">Distribusi Menu ke Cabang</h1>
        <EmptyState icon={Utensils} title="Belum ada menu" description="Tambahkan menu di Master Katalog Menu terlebih dahulu." />
      </div>
    );
  }

  const buttonLabel =
    selectedMenus.length > 1 ? `Distribusikan ${selectedMenus.length} Menu ke ${targets.length} Cabang` : `Distribusikan ke ${targets.length} Cabang`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Distribusi Menu ke Cabang</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Tambahkan menu dari katalog pusat ke cabang tanpa menimpa harga dan ketersediaan lokal.</p>
        </div>
        <Button
          icon={<Share2 size={16} />}
          onClick={() => void apply()}
          loading={busy}
          loadingText="Mendistribusikan…"
          disabled={targets.length === 0 || selectedMenus.length === 0}
        >
          {buttonLabel}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-nnorte-red">Langkah 1</span>
              <h2 className="text-sm font-bold text-nnorte-text">Pilih Menu Master</h2>
            </div>
            <SelectAll checked={allMenusChecked} indeterminate={someMenusChecked} onChange={selectAllMenus}>
              Pilih semua
            </SelectAll>
          </div>
          <ul className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {masterMenus.map((m) => {
              const checked = selectedMenuIds.includes(m.id);
              return (
                <li key={m.id}>
                  <label
                    className={`nn-press flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors ${checked ? 'border-nnorte-red bg-nnorte-red/10' : 'border-nnorte-border hover:border-nnorte-muted'}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleMenu(m.id)} className="h-5 w-5 shrink-0 accent-[var(--c-red)]" />
                    <Thumb src={m.image} alt="" className="h-11 w-11 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-nnorte-text">{m.name}</span>
                      <span className="text-[11px] font-semibold text-nnorte-red">{formatRupiah(m.basePrice)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-nnorte-muted">
            {selectedMenuIds.length} dari {masterMenus.length} menu dipilih.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-nnorte-border bg-nnorte-surface p-4 sm:p-5 lg:col-span-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-nnorte-red">Langkah 2</span>
            <h2 className="text-sm font-bold text-nnorte-text">Cabang Penerima &amp; Status Lokal</h2>
          </div>

          {selectedMenus.length === 1 && (
            <div className="flex items-center gap-4 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-4">
              <Thumb src={selectedMenus[0].image} alt={selectedMenus[0].name} className="h-16 w-16 shrink-0 rounded-xl border border-nnorte-border" />
              <div className="min-w-0">
                <span className="rounded border border-nnorte-border bg-nnorte-surface px-2 py-0.5 font-mono text-[10px] text-nnorte-muted">{selectedMenus[0].sku}</span>
                <h3 className="mt-1 truncate text-sm font-bold text-nnorte-text">{selectedMenus[0].name}</h3>
                <p className="text-xs text-nnorte-muted">{selectedMenus[0].category || 'Tanpa kategori'} · Harga dasar {formatRupiah(selectedMenus[0].basePrice)}</p>
              </div>
            </div>
          )}

          {selectedMenus.length > 1 && (
            <div className="flex items-center gap-4 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-nnorte-border bg-nnorte-surface text-nnorte-red" aria-hidden="true">
                <Utensils size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-nnorte-text">{selectedMenus.length} menu dipilih</h3>
                <p className="truncate text-xs text-nnorte-muted">{selectedMenus.map((m) => m.name).join(', ')}</p>
                <p className="mt-0.5 text-[11px] text-nnorte-muted">Harga awal tiap cabang mengikuti harga dasar masing-masing menu.</p>
              </div>
            </div>
          )}

          {selectedMenus.length === 0 && (
            <p className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-4 text-xs text-nnorte-muted">
              Pilih minimal satu menu master di Langkah 1 untuk melihat cabang penerima.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs text-nnorte-muted">Cabang yang belum memiliki {selectedMenus.length > 1 ? 'semua menu terpilih' : 'menu ini'} dapat dipilih:</span>
            <SelectAll checked={allBranchesChecked} indeterminate={someBranchesChecked} disabled={selectableBranches.length === 0} onChange={selectAllBranches}>
              Pilih semua yang belum
            </SelectAll>
          </div>

          {branches.length === 0 ? (
            <EmptyState compact icon={Building2} title="Belum ada cabang" />
          ) : (
            <ul className="space-y-2.5">
              {branchRows.map(({ branch, missing }) => {
                const already = missing === 0 || selectedMenus.length === 0;
                const local =
                  selectedMenus.length === 1 ? branchMenus.find((bm) => bm.branchId === branch.id && bm.menuId === selectedMenus[0].id) : undefined;
                return (
                  <li key={branch.id} className="flex flex-col justify-between gap-3 rounded-xl border border-nnorte-border p-3.5 sm:flex-row sm:items-center">
                    <label className={`flex min-h-11 items-center gap-3 ${already ? 'opacity-70' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={already || selectedBranches.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="h-5 w-5 accent-[var(--c-red)]"
                      />
                      <span>
                        <span className="block text-xs font-bold text-nnorte-text">{branch.name}</span>
                        <span className="text-[11px] text-nnorte-muted">{branch.city} · {branch.code}</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-4 pl-8 text-xs sm:pl-0">
                      {selectedMenus.length === 1 ? (
                        <div>
                          <span className="block text-[10px] text-nnorte-muted">Harga Lokal</span>
                          <span className="font-bold text-nnorte-text">{local ? formatRupiah(local.price) : '—'}</span>
                        </div>
                      ) : (
                        <div>
                          <span className="block text-[10px] text-nnorte-muted">Menu belum ada</span>
                          <span className="font-bold text-nnorte-text">{missing} / {selectedMenus.length}</span>
                        </div>
                      )}
                      <div className="text-right">
                        <span className="block text-[10px] text-nnorte-muted">Status</span>
                        {selectedMenus.length === 0 ? (
                          <span className="text-[11px] text-nnorte-muted">—</span>
                        ) : missing === 0 ? (
                          selectedMenus.length === 1 && local ? (
                            local.isAvailable ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-nnorte-success"><CheckCircle2 size={12} aria-hidden="true" />Aktif dijual</span>
                            ) : (
                              <span className="text-[11px] text-nnorte-muted">Nonaktif</span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-nnorte-success"><CheckCircle2 size={12} aria-hidden="true" />Sudah lengkap</span>
                          )
                        ) : missing === selectedMenus.length ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-nnorte-muted"><MinusCircle size={12} aria-hidden="true" />Belum didistribusikan</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-nnorte-muted"><CheckCircle2 size={12} aria-hidden="true" />Sebagian sudah ada</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3.5 text-xs text-nnorte-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-nnorte-success" aria-hidden="true" />
            <p className="leading-relaxed">
              <span className="font-semibold text-nnorte-text">Proteksi harga cabang:</span> distribusi hanya menambahkan menu ke cabang yang belum memilikinya;
              harga dan ketersediaan yang sudah diatur Admin Cabang tidak diubah.
              {pairCount > 0 && <> <span className="font-semibold text-nnorte-text">{pairCount} entri</span> akan ditambahkan.</>}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
