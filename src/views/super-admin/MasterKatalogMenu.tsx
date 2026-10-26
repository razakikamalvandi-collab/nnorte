import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Clock, Edit3, ImagePlus, Plus, Search, Star, Trash2, Utensils, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MasterMenuItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, removeMenuImageByPath, storagePathFromUrl, uploadMenuImage, validateImageFile } from '../../lib/menuImages';
import { toRecipeIngredients, validateRecipeRows, type RecipeDraft } from '../../lib/recipes';

const parseList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

interface FormState {
  name: string; sku: string; category: string; description: string; ingredients: RecipeDraft[]; allergens: string;
  basePrice: string; prepTime: string; isPopular: boolean;
}
const EMPTY: FormState = { name: '', sku: '', category: '', description: '', ingredients: [], allergens: '', basePrice: '', prepTime: '15', isPopular: false };

export const MasterKatalogMenu: React.FC = () => {
  const { masterMenus, menuCategories, branches, branchMenus, currentUser, restaurantId, addMenuCategory, addMasterMenu, updateMasterMenu, setMasterMenuStatus, deleteMasterMenu, addToast, dataError, dataLoading, reloadData } = useApp();
  const canEdit = currentUser?.role === 'owner';

  const [cat, setCat] = useState('Semua');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterMenuItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'image', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  // gambar: file baru (belum diunggah), atau penghapusan gambar lama
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [removeImage, setRemoveImage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const categories = useMemo(() => {
    const byName = new Map<string, string>();
    [...menuCategories, ...masterMenus.map((m) => m.category)].forEach((raw) => {
      const name = raw.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, name);
    });
    return Array.from(byName.values()).sort((a, b) => a.localeCompare(b));
  }, [menuCategories, masterMenus]);
  const filtered = masterMenus.filter((m) => {
    const t = q.trim().toLowerCase();
    return (cat === 'Semua' || m.category.trim().toLowerCase() === cat.toLowerCase()) && (!t || m.name.toLowerCase().includes(t) || m.sku.toLowerCase().includes(t));
  });

  // Bebaskan object URL.
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const resetImage = (url = '') => {
    setFile(null);
    setRemoveImage(false);
    setPreview(url);
    if (fileInput.current) fileInput.current.value = '';
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, ingredients: [] });
    setErrors({});
    setFormError(null);
    setTargets(branches.filter((b) => b.status === 'active').map((b) => b.id));
    resetImage();
    setOpen(true);
  };
  const openEdit = (m: MasterMenuItem) => {
    setEditing(m);
    setForm({
      name: m.name, sku: m.sku, category: categories.find((c) => c.toLowerCase() === m.category.trim().toLowerCase()) ?? m.category.trim(), description: m.description,
      ingredients: (m.ingredients ?? []).map((ingredient) => ({
        name: ingredient.name,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
      })),
      allergens: (m.allergens ?? []).join(', '), basePrice: String(m.basePrice), prepTime: String(m.preparationTimeMinutes), isPopular: !!m.isPopular,
    });
    setErrors({});
    setFormError(null);
    resetImage(m.image || '');
    setOpen(true);
  };
  const close = () => { if (!saving) setOpen(false); };

  const addRecipeRow = () => setForm((f) => ({
    ...f,
    ingredients: [...f.ingredients, { name: '', quantity: '1', unit: '' }],
  }));
  const updateRecipeRow = (index: number, patch: Partial<RecipeDraft>) => setForm((f) => ({
    ...f,
    ingredients: f.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)),
  }));
  const removeRecipeRow = (index: number) => setForm((f) => ({
    ...f,
    ingredients: f.ingredients.filter((_, i) => i !== index),
  }));

  const openAddCategory = () => {
    setCategoryName('');
    setCategoryError(null);
    setCategoryOpen(true);
  };
  const closeCategory = () => { if (!categorySaving) setCategoryOpen(false); };
  const submitCategory = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (categorySaving) return;
    const name = categoryName.trim();
    if (!name) return setCategoryError('Nama kategori wajib diisi.');
    if (name.length > 60) return setCategoryError('Nama kategori maksimal 60 karakter.');
    setCategoryError(null);
    setCategorySaving(true);
    try {
      const res = await addMenuCategory(name);
      if (!res.ok) {
        setCategoryError(res.error);
        return;
      }
      if (open) setForm((f) => ({ ...f, category: name }));
      setCategoryOpen(false);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    } finally {
      setCategorySaving(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const msg = await validateImageFile(f);
    if (msg) {
      setErrors((x) => ({ ...x, image: msg }));
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setErrors((x) => ({ ...x, image: undefined }));
    setFile(f);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Nama menu wajib diisi.';
    if (!form.sku.trim()) e.sku = 'SKU wajib diisi.';
    const price = Number(form.basePrice);
    if (form.basePrice === '' || !Number.isFinite(price) || price < 0) e.basePrice = 'Harga tidak valid.';
    const prep = Number(form.prepTime);
    if (!Number.isInteger(prep) || prep < 1 || prep > 240) e.prepTime = 'Isi 1–240 menit.';
    const recipeError = validateRecipeRows(form.ingredients);
    if (recipeError) e.ingredients = recipeError;
    setErrors((x) => ({ ...x, ...e, image: x.image }));
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving || !validate()) return;
    if (!restaurantId) return setFormError('Restoran tidak ditemukan.');
    setSaving(true);
    setFormError(null);
    let uploaded: { url: string; path: string } | null = null;
    try {
      if (file) uploaded = await uploadMenuImage(restaurantId, file);
      const oldUrl = editing?.image || '';
      const image = uploaded ? uploaded.url : removeImage ? '' : oldUrl;
      const payload = {
        name: form.name, sku: form.sku, category: form.category.trim(), description: form.description,
        ingredients: toRecipeIngredients(form.ingredients), allergens: parseList(form.allergens), basePrice: Number(form.basePrice),
        image, preparationTimeMinutes: Number(form.prepTime), isPopular: form.isPopular,
      };
      const res = editing ? await updateMasterMenu(editing.id, payload) : await addMasterMenu({ ...payload, status: 'active' }, targets);
      if (!res.ok) {
        if (uploaded) await removeMenuImageByPath(uploaded.path).catch(() => undefined); // jangan tinggalkan berkas yatim
        setFormError(res.error);
        return;
      }
      // Hapus berkas lama hanya setelah data tersimpan.
      if (editing && oldUrl && (uploaded || removeImage)) await removeMenuImageByPath(storagePathFromUrl(oldUrl)).catch(() => undefined);
      setOpen(false);
    } catch (err) {
      if (uploaded) await removeMenuImageByPath(uploaded.path).catch(() => undefined);
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan menu.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: MasterMenuItem) => {
    const used = branchMenus.some((b) => b.menuId === m.id);
    const ok = window.confirm(used ? `Hapus ${m.name}? Jika sudah pernah dipakai transaksi, menu akan diarsipkan (bukan dihapus permanen).` : `Hapus ${m.name} dari katalog master?`);
    if (!ok) return;
    const res = await deleteMasterMenu(m.id);
    if (!res.ok) return addToast('error', res.error);
    addToast('success', res.archived ? `${m.name} diarsipkan karena sudah pernah dipakai transaksi.` : `${m.name} dihapus.`);
    if (!res.archived && m.image) await removeMenuImageByPath(storagePathFromUrl(m.image)).catch(() => undefined);
  };

  const toggleStatus = async (m: MasterMenuItem) => {
    const next = m.status === 'active' ? 'archived' : 'active';
    if (next === 'archived') {
      const ok = window.confirm(`Arsipkan ${m.name}? Menu tidak akan tampil di portal pelanggan sampai diaktifkan kembali.`);
      if (!ok) return;
    }
    setStatusSavingId(m.id);
    try {
      const res = await setMasterMenuStatus(m.id, next);
      if (!res.ok) addToast('error', res.error);
    } finally {
      setStatusSavingId(null);
    }
  };

  const shownPreview = removeImage ? '' : preview;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Master Katalog Menu</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Katalog global yang dapat didistribusikan ke seluruh cabang.</p>
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Menu Baru</Button>}
      </div>

      {dataError && <ErrorState message={dataError} onRetry={() => void reloadData()} />}

      <div className="flex flex-col gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted" aria-hidden="true" />
          <input type="search" aria-label="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama menu atau SKU…" className={`${inputClass()} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Semua', ...categories].map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`nn-press min-h-9 cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${cat === c ? 'bg-nnorte-red text-nnorte-on-brand' : 'border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:text-nnorte-text'}`}>{c}</button>
          ))}
          {canEdit && (
            <button type="button" onClick={openAddCategory} className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-dashed border-nnorte-border bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text">
              <Plus size={12} aria-hidden="true" /> Tambah Kategori
            </button>
          )}
        </div>
      </div>

      {!dataLoading && filtered.length === 0 ? (
        <EmptyState icon={Utensils} title="Belum ada menu" description={masterMenus.length === 0 && canEdit ? 'Tambahkan menu baru ke katalog master.' : 'Tidak ada menu yang cocok dengan filter.'} action={masterMenus.length === 0 && canEdit ? <Button icon={<Plus size={14} />} onClick={openAdd}>Tambah Menu Baru</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m, i) => (
            <article key={m.id} className="nn-rise nn-lift group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-nnorte-border bg-nnorte-surface hover:border-nnorte-blue/40" style={{ ['--i' as string]: i }}>
              <div className="relative h-40 w-full overflow-hidden bg-nnorte-sidebar">
                {m.image ? (
                  <img src={m.image} alt={m.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-nnorte-muted"><Utensils size={32} aria-hidden="true" /></div>
                )}
                {m.isPopular && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-nnorte-red px-2 py-0.5 text-[10px] font-bold text-nnorte-on-brand shadow-md"><Star size={10} className="fill-current" aria-hidden="true" />Best Seller</span>}
                <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.status === 'active' ? 'border-nnorte-success/30 bg-nnorte-success/15 text-nnorte-success' : 'border-nnorte-border bg-nnorte-surface-2/90 text-nnorte-muted'}`}>{m.status === 'active' ? 'Aktif' : 'Arsip'}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-nnorte-muted">{m.category || 'Tanpa kategori'}</span>
                <h3 className="line-clamp-1 text-sm font-bold text-nnorte-text">{m.name}</h3>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-nnorte-muted">{m.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-nnorte-muted">
                  <span className="font-mono">{m.sku}</span>
                  <span className="flex items-center gap-1"><Clock size={10} aria-hidden="true" />{m.preparationTimeMinutes} mnt</span>
                  <span className={`flex items-center gap-1 ${(m.ingredients?.length ?? 0) === 0 ? 'text-nnorte-warning' : ''}`}>
                    <Utensils size={10} aria-hidden="true" />{m.ingredients?.length ?? 0} bahan
                  </span>
                </div>
              </div>
              <div className="mt-auto space-y-2 border-t border-nnorte-border p-3">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void toggleStatus(m)}
                    disabled={!!statusSavingId}
                    className={`nn-press inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                      m.status === 'active'
                        ? 'border-nnorte-warning/30 bg-nnorte-warning/10 text-nnorte-warning hover:border-nnorte-warning/60'
                        : 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success hover:border-nnorte-success/60'
                    }`}
                  >
                    {m.status === 'active' ? <Archive size={13} aria-hidden="true" /> : <ArchiveRestore size={13} aria-hidden="true" />}
                    {statusSavingId === m.id ? 'Menyimpan…' : m.status === 'active' ? 'Arsipkan' : 'Aktifkan'}
                  </button>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-nnorte-red">{formatRupiah(m.basePrice)}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" aria-label={`Edit ${m.name}`} onClick={() => openEdit(m)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"><Edit3 size={13} /></button>
                      <button type="button" aria-label={`Hapus ${m.name}`} onClick={() => void remove(m)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-red hover:border-nnorte-red"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={close}
        busy={saving}
        title={editing ? `Edit Menu: ${editing.name}` : 'Tambah Menu Master Baru'}
        subtitle="Harga dasar menjadi harga awal cabang; harga cabang yang sudah diubah tidak tertimpa."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>Batal</Button>
            <Button type="submit" form="menu-form" loading={saving} loadingText={file ? 'Mengunggah & menyimpan…' : 'Menyimpan…'}>{editing ? 'Simpan Perubahan' : 'Tambah Menu'}</Button>
          </>
        }
      >
        <form id="menu-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{formError}</p>}

          <Field label="Foto Menu" error={errors.image} hint={`JPEG, PNG, atau WebP, maksimal ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`}>
            <input ref={fileInput} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={(e) => void onPickFile(e)} className="block w-full cursor-pointer text-xs text-nnorte-muted file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border file:border-nnorte-border file:bg-nnorte-surface-2 file:px-3 file:text-xs file:font-semibold file:text-nnorte-text" />
          </Field>
          {shownPreview ? (
            <div className="flex items-center gap-3">
              <img src={shownPreview} alt="Pratinjau foto menu" className="h-24 w-32 rounded-lg border border-nnorte-border object-cover" />
              <Button variant="secondary" size="sm" icon={<X size={12} />} onClick={() => { if (file) resetImage(editing?.image || ''); else setRemoveImage(true); }}>
                {file ? 'Batalkan foto baru' : 'Hapus foto'}
              </Button>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-nnorte-border text-xs text-nnorte-muted"><ImagePlus size={16} aria-hidden="true" />{removeImage ? 'Foto akan dihapus saat disimpan' : 'Belum ada foto'}</div>
          )}

          <Field label="Nama Menu" required error={errors.name}><input type="text" className={inputClass(!!errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} /></Field>
          <Field label="SKU" required error={errors.sku}><input type="text" className={`${inputClass(!!errors.sku)} font-mono`} value={form.sku} onChange={(e) => set('sku', e.target.value)} maxLength={40} /></Field>
          <Field label="Kategori" hint={categories.length === 0 ? 'Belum ada kategori. Tambahkan kategori baru di bawah.' : 'Pilih dari kategori yang sudah ditambahkan.'}>
            <select className={inputClass()} value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <button type="button" onClick={openAddCategory} className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg border border-dashed border-nnorte-border px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text">
            <Plus size={12} aria-hidden="true" /> Tambah kategori baru
          </button>
          <Field label="Harga Dasar (Rp)" required error={errors.basePrice}><input type="number" min={0} step={500} inputMode="numeric" className={inputClass(!!errors.basePrice)} value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} /></Field>
          <Field label="Waktu Saji (menit)" error={errors.prepTime}><input type="number" min={1} max={240} className={inputClass(!!errors.prepTime)} value={form.prepTime} onChange={(e) => set('prepTime', e.target.value)} /></Field>
          <Field label="Deskripsi"><textarea rows={3} className={inputClass()} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} /></Field>
          <fieldset className="space-y-2 rounded-xl border border-nnorte-border p-3">
            <legend className="px-1 text-xs font-semibold text-nnorte-text">Bahan per Porsi</legend>
            <p className="text-[11px] leading-relaxed text-nnorte-muted">
              Stok bahan di cabang berkurang sesuai takaran ini setiap 1 porsi terjual. Nama dan satuan harus sama dengan stok bahan di cabang.
            </p>
            {form.ingredients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-nnorte-border p-3 text-center text-[11px] text-nnorte-muted">
                Belum ada bahan. Menu tanpa resep tidak akan memotong stok.
              </p>
            ) : (
              <div className="space-y-2">
                {form.ingredients.map((row, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_auto] items-center gap-1.5">
                    <input
                      type="text"
                      aria-label={`Nama bahan ${index + 1}`}
                      placeholder="Nama bahan"
                      className={inputClass()}
                      value={row.name}
                      onChange={(e) => updateRecipeRow(index, { name: e.target.value })}
                      maxLength={100}
                    />
                    <input
                      type="number"
                      aria-label={`Jumlah bahan ${index + 1}`}
                      placeholder="Qty"
                      min={0.001}
                      step={0.001}
                      className={inputClass()}
                      value={row.quantity}
                      onChange={(e) => updateRecipeRow(index, { quantity: e.target.value })}
                    />
                    <input
                      type="text"
                      aria-label={`Satuan bahan ${index + 1}`}
                      placeholder="Satuan"
                      className={inputClass()}
                      value={row.unit}
                      onChange={(e) => updateRecipeRow(index, { unit: e.target.value })}
                      maxLength={30}
                    />
                    <button
                      type="button"
                      aria-label={`Hapus bahan ${index + 1}`}
                      onClick={() => removeRecipeRow(index)}
                      className="nn-press inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted transition-colors hover:border-nnorte-red/50 hover:text-nnorte-red"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.ingredients && <p role="alert" className="text-[11px] text-nnorte-error">{errors.ingredients}</p>}
            <button
              type="button"
              onClick={addRecipeRow}
              className="nn-press inline-flex min-h-9 cursor-pointer items-center gap-1 self-start rounded-lg border border-dashed border-nnorte-border px-2.5 py-1.5 text-[11px] font-semibold text-nnorte-muted transition-colors hover:border-nnorte-blue/50 hover:text-nnorte-text"
            >
              <Plus size={12} aria-hidden="true" /> Tambah bahan
            </button>
          </fieldset>
          <Field label="Alergen"><input type="text" className={inputClass()} value={form.allergens} onChange={(e) => set('allergens', e.target.value)} /></Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-nnorte-text">
            <input type="checkbox" checked={form.isPopular} onChange={(e) => set('isPopular', e.target.checked)} className="h-5 w-5 accent-[var(--c-red)]" />
            Tandai sebagai menu populer (Best Seller)
          </label>

          {!editing && (
            <fieldset className="space-y-2 rounded-xl border border-nnorte-border p-3">
              <legend className="px-1 text-xs font-semibold text-nnorte-text">Distribusi ke Cabang</legend>
              {branches.length === 0 ? <p className="text-xs text-nnorte-muted">Belum ada cabang. Menu tetap tersimpan di katalog.</p> : branches.map((b) => (
                <label key={b.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-xs text-nnorte-text">
                  <input type="checkbox" checked={targets.includes(b.id)} onChange={() => setTargets((t) => (t.includes(b.id) ? t.filter((x) => x !== b.id) : [...t, b.id]))} className="h-5 w-5 accent-[var(--c-red)]" />
                  {b.name}
                </label>
              ))}
            </fieldset>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={categoryOpen}
        onClose={closeCategory}
        busy={categorySaving}
        title="Tambah Kategori"
        subtitle="Kategori baru langsung tersedia di filter dan form menu."
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeCategory} disabled={categorySaving}>Batal</Button>
            <Button type="submit" form="category-form" loading={categorySaving} loadingText="Menyimpan…">Tambah Kategori</Button>
          </>
        }
      >
        <form id="category-form" onSubmit={submitCategory} noValidate className="space-y-3">
          {categoryError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{categoryError}</p>}
          <Field label="Nama Kategori" required>
            <input
              type="text"
              className={inputClass(!!categoryError)}
              value={categoryName}
              onChange={(e) => {
                setCategoryName(e.target.value);
                if (categoryError) setCategoryError(null);
              }}
              maxLength={60}
              autoFocus
              placeholder="Contoh: Dessert"
            />
          </Field>
          <p className="text-[11px] leading-relaxed text-nnorte-muted">Kategori yang sudah ada tidak perlu ditambahkan lagi.</p>
        </form>
      </Modal>
    </div>
  );
};
