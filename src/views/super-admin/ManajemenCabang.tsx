import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock, Edit2, Mail, MapPin, Phone, Plus, Trash2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Branch } from '../../types';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { PlacePicker } from '../../components/common/PlacePicker';
import { BRANCH_COLOR_NAMES, resolveBranchColors } from '../../lib/finance';
import { supabase } from '../../lib/supabase';

interface FormState {
  name: string;
  tagline: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  placeId: string;
  phone: string;
  email: string;
  is24Hours: boolean;
  openingTime: string;
  closingTime: string;
  totalTables: string;
  chartColor: string;
  status: 'active' | 'inactive';
}

const EMPTY: FormState = {
  name: '', tagline: '', address: '', city: '', province: '', postalCode: '', latitude: '', longitude: '', placeId: '',
  phone: '', email: '', is24Hours: false, openingTime: '10:00', closingTime: '22:00', totalTables: '10', chartColor: '', status: 'active',
};

const toForm = (b: Branch): FormState => ({
  name: b.name, tagline: b.tagline, address: b.address, city: b.city, province: b.province ?? '', postalCode: b.postalCode ?? '',
  latitude: b.latitude !== undefined ? String(b.latitude) : '', longitude: b.longitude !== undefined ? String(b.longitude) : '',
  placeId: b.placeId ?? '', phone: b.phone, email: b.email, is24Hours: b.is24Hours,
  openingTime: b.openingTime?.slice(0, 5) || '10:00', closingTime: b.closingTime?.slice(0, 5) || '22:00',
  totalTables: String(b.totalTables), chartColor: b.chartColor ?? '', status: b.status,
});

export const ManajemenCabang: React.FC = () => {
  const { branches, addBranch, updateBranch, deleteBranch, dataLoading, dataError, reloadData } = useApp();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [codePreview, setCodePreview] = useState<string>('');
  const [editCodePreview, setEditCodePreview] = useState<string>('');
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const colors = useMemo(() => resolveBranchColors(branches), [branches]);
  const open = adding || editing !== null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Pratinjau kode cabang (hanya informasi; kode final dibuat database saat simpan).
  useEffect(() => {
    if (!adding) return;
    const city = form.city.trim();
    if (city.length < 3) {
      setCodePreview('');
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('preview_branch_code', { p_city: city });
      if (!cancelled) setCodePreview(error ? '' : String(data));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [adding, form.city]);

  // Saat mengedit kota, nomor urut tetap; hanya prefiks kota yang berubah.
  useEffect(() => {
    if (!editing) {
      setEditCodePreview('');
      return;
    }
    const city = form.city.trim();
    if (city.length < 3 || editing.status !== 'active' || city === editing.city) {
      setEditCodePreview(editing.code);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('preview_branch_code_for', {
        p_branch: editing.id,
        p_city: city,
      });
      if (!cancelled) setEditCodePreview(error ? editing.code : String(data));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [editing, form.city]);

  const openAdd = () => {
    setForm(EMPTY);
    setErrors({});
    setFormError(null);
    setCodePreview('');
    setEditCodePreview('');
    setEditing(null);
    setAdding(true);
  };
  const openEdit = (b: Branch) => {
    setForm(toForm(b));
    setErrors({});
    setFormError(null);
    setCodePreview('');
    setEditCodePreview(b.code);
    setAdding(false);
    setEditing(b);
  };
  const close = () => {
    if (saving) return;
    setAdding(false);
    setEditing(null);
  };

  const openDelete = (b: Branch) => {
    setDeleting(b);
    setDeleteError(null);
  };
  const closeDelete = () => {
    if (deleteBusy) return;
    setDeleting(null);
    setDeleteError(null);
  };
  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await deleteBranch(deleting.id);
    setDeleteBusy(false);
    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }
    setDeleting(null);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Nama cabang wajib diisi.';
    if (!form.city.trim()) e.city = 'Kota wajib diisi.';
    if (!form.address.trim()) e.address = 'Alamat wajib diisi.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Format email tidak valid.';
    const tables = Number(form.totalTables);
    if (!Number.isInteger(tables) || tables < 0 || tables > 500) e.totalTables = 'Isi bilangan bulat 0–500.';
    if (!form.is24Hours) {
      if (!form.openingTime) e.openingTime = 'Wajib diisi.';
      if (!form.closingTime) e.closingTime = 'Wajib diisi.';
      if (form.openingTime && form.closingTime && form.openingTime === form.closingTime) e.closingTime = 'Jam tutup tidak boleh sama dengan jam buka (pilih Operasional 24 Jam).';
    }
    const hasLat = form.latitude.trim() !== '';
    const hasLng = form.longitude.trim() !== '';
    if (hasLat !== hasLng) e.latitude = 'Isi latitude dan longitude bersamaan.';
    else if (hasLat) {
      const la = Number(form.latitude);
      const lo = Number(form.longitude);
      if (!Number.isFinite(la) || la < -90 || la > 90) e.latitude = 'Latitude harus −90 s.d. 90.';
      if (!Number.isFinite(lo) || lo < -180 || lo > 180) e.longitude = 'Longitude harus −180 s.d. 180.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    setFormError(null);
    const hasCoord = form.latitude.trim() !== '' && form.longitude.trim() !== '';
    const payload = {
      name: form.name, tagline: form.tagline, address: form.address, city: form.city, province: form.province,
      postalCode: form.postalCode, phone: form.phone, email: form.email, totalTables: Number(form.totalTables),
      latitude: hasCoord ? Number(form.latitude) : undefined, longitude: hasCoord ? Number(form.longitude) : undefined,
      placeId: form.placeId || undefined, is24Hours: form.is24Hours,
      openingTime: form.is24Hours ? undefined : form.openingTime, closingTime: form.is24Hours ? undefined : form.closingTime,
      chartColor: form.chartColor || undefined, status: form.status,
      operatingHours: '',
    };
    const res = editing ? await updateBranch(editing.id, payload) : await addBranch(payload);
    setSaving(false);
    if (!res.ok) return setFormError(res.error);
    setAdding(false);
    setEditing(null);
  };

  const overnight = !form.is24Hours && form.openingTime && form.closingTime && form.closingTime < form.openingTime;
  const codeShown = editing
    ? editCodePreview || editing.code
    : codePreview || 'Dibuat otomatis setelah kota diisi';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Manajemen Cabang</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Kelola data outlet, lokasi, dan jam operasional. Nomor cabang aktif mengikuti urutan global.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openAdd}>Tambah Cabang</Button>
      </div>

      {dataError && <ErrorState message={dataError} onRetry={() => void reloadData()} />}

      {!dataLoading && !dataError && branches.length === 0 && (
        <EmptyState icon={Building2} title="Belum ada cabang" description="Tambahkan cabang pertama untuk mulai mengelola operasional." action={<Button icon={<Plus size={14} />} onClick={openAdd}>Tambah Cabang</Button>} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {branches.map((b, i) => (
          <article key={b.id} className="nn-rise nn-lift flex min-w-0 flex-col gap-3 rounded-2xl border border-nnorte-border bg-nnorte-surface p-5" style={{ ['--i' as string]: i }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full border border-nnorte-border" style={{ backgroundColor: colors.get(b.id) }} title="Warna grafik" />
                  <h3 className="truncate text-sm font-bold text-nnorte-text">{b.name}</h3>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-nnorte-muted"><span className="font-mono">{b.code}</span>{b.status !== 'active' ? ' (arsip)' : ''}{b.tagline ? ` • ${b.tagline}` : ''}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${b.status === 'active' ? 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success' : 'border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted'}`}>
                <CheckCircle2 size={10} aria-hidden="true" />
                {b.status === 'active' ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="space-y-1.5 border-t border-nnorte-border pt-3 text-[11px] text-nnorte-muted">
              <div className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0 text-nnorte-blue-soft" aria-hidden="true" /><span>{[b.address, b.city].filter(Boolean).join(', ')}</span></div>
              {b.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" /><span>{b.phone}</span></div>}
              {b.email && <div className="flex items-center gap-1.5"><Mail size={12} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" /><span className="truncate">{b.email}</span></div>}
              <div className="flex items-center gap-1.5"><Clock size={12} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" /><span>{b.is24Hours ? 'Buka 24 Jam' : b.operatingHours}</span></div>
              <div className="flex items-center gap-1.5"><Users size={12} className="shrink-0 text-nnorte-blue-soft" aria-hidden="true" /><span>{b.totalTables} meja</span></div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" icon={<Edit2 size={13} />} onClick={() => openEdit(b)}>Edit</Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => openDelete(b)}
                aria-label={`Hapus cabang ${b.name}`}
              >
                Hapus
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        isOpen={open}
        onClose={close}
        busy={saving}
        title={editing ? `Edit Cabang: ${editing.name}` : 'Tambah Cabang Baru'}
        subtitle="Kode cabang mengikuti urutan global cabang aktif dan tidak dapat diubah manual."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>Batal</Button>
            <Button type="submit" form="branch-form" loading={saving} loadingText="Menyimpan…">{editing ? 'Simpan Perubahan' : 'Tambah Cabang'}</Button>
          </>
        }
      >
        <form id="branch-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{formError}</p>}

          <Field
            label="Kode Cabang"
            hint={editing
              ? 'Nomor urut cabang aktif; mengganti kota hanya mengubah prefiks kota.'
              : 'Nomor urut global berdasarkan jumlah cabang aktif (mis. NN-PDG-01). Nomor tidak direset per kota.'}
          >
            <input type="text" readOnly value={codeShown} className={`${inputClass()} font-mono`} />
          </Field>
          {editing && editing.status !== 'active' && (
            <p className="-mt-2 text-[11px] text-nnorte-muted">
              Kode arsip. Jika diaktifkan kembali, cabang akan mendapat nomor aktif berikutnya.
            </p>
          )}
          <Field label="Nama Cabang" required error={errors.name}>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="mis. NNORTE Padang" maxLength={80} className={inputClass(!!errors.name)} />
          </Field>
          <Field label="Tagline">
            <input type="text" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} className={inputClass()} />
          </Field>

          <fieldset className="space-y-3 rounded-xl border border-nnorte-border p-3">
            <legend className="px-1 text-xs font-semibold text-nnorte-text">Lokasi</legend>
            <PlacePicker
              latitude={form.latitude !== '' && Number.isFinite(Number(form.latitude)) ? Number(form.latitude) : undefined}
              longitude={form.longitude !== '' && Number.isFinite(Number(form.longitude)) ? Number(form.longitude) : undefined}
              address={form.address}
              city={form.city}
              province={form.province}
              postalCode={form.postalCode}
              onPick={(p) =>
                setForm((f) => ({
                  ...f,
                  address: p.address ?? f.address,
                  city: p.city || f.city,
                  province: p.province || f.province,
                  postalCode: p.postalCode || f.postalCode,
                  placeId: p.placeId ?? '',
                  latitude: p.latitude.toFixed(6),
                  longitude: p.longitude.toFixed(6),
                }))
              }
              onClear={() => setForm((f) => ({ ...f, latitude: '', longitude: '', placeId: '' }))}
            />
            <Field label="Alamat" required error={errors.address}>
              <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={300} className={inputClass(!!errors.address)} />
            </Field>
            <Field label="Kota" required error={errors.city}>
              <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass(!!errors.city)} />
            </Field>
            <Field label="Provinsi">
              <input type="text" value={form.province} onChange={(e) => set('province', e.target.value)} className={inputClass()} />
            </Field>
            <Field label="Kode Pos">
              <input type="text" inputMode="numeric" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} maxLength={10} className={inputClass()} />
            </Field>
            {(errors.latitude || errors.longitude) && (
              <p role="alert" className="text-[11px] font-medium text-nnorte-error">
                {errors.latitude || errors.longitude}
              </p>
            )}
          </fieldset>

          <Field label="Telepon">
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass()} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass(!!errors.email)} />
          </Field>

          <fieldset className="space-y-3 rounded-xl border border-nnorte-border p-3">
            <legend className="px-1 text-xs font-semibold text-nnorte-text">Jam Operasional</legend>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-xs text-nnorte-text">
              <span>Operasional 24 Jam</span>
              <input type="checkbox" role="switch" checked={form.is24Hours} onChange={(e) => set('is24Hours', e.target.checked)} className="h-5 w-5 accent-[var(--c-red)]" />
            </label>
            {!form.is24Hours && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jam Buka" required error={errors.openingTime}>
                  <input type="time" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} className={inputClass(!!errors.openingTime)} />
                </Field>
                <Field label="Jam Tutup" required error={errors.closingTime}>
                  <input type="time" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} className={inputClass(!!errors.closingTime)} />
                </Field>
              </div>
            )}
            {overnight && <p className="text-[11px] text-nnorte-muted">Jam tutup melewati tengah malam (hari berikutnya).</p>}
          </fieldset>

          <Field label="Jumlah Meja" error={errors.totalTables}>
            <input type="number" min={0} max={500} value={form.totalTables} onChange={(e) => set('totalTables', e.target.value)} className={inputClass(!!errors.totalTables)} />
          </Field>

          <Field label="Warna Grafik" hint="Dipakai pada grafik dashboard. Kosongkan untuk warna otomatis.">
            <select value={form.chartColor} onChange={(e) => set('chartColor', e.target.value)} className={inputClass()}>
              <option value="">Otomatis</option>
              {Object.entries(BRANCH_COLOR_NAMES).map(([hex, label]) => <option key={hex} value={hex}>{label}</option>)}
            </select>
          </Field>

          {editing && (
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')} className={inputClass()}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </Field>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={deleting !== null}
        onClose={closeDelete}
        busy={deleteBusy}
        maxWidth="sm"
        title="Hapus Cabang?"
        subtitle="Cabang dinonaktifkan (soft delete); nomor cabang aktif tetap rapat tanpa celah."
        footer={
          <>
            <Button variant="secondary" onClick={closeDelete} disabled={deleteBusy}>Batal</Button>
            <Button variant="danger" loading={deleteBusy} loadingText="Menghapus…" icon={<Trash2 size={14} />} onClick={() => void confirmDelete()}>
              Hapus Cabang
            </Button>
          </>
        }
      >
        {deleteError && <p role="alert" className="mb-3 rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{deleteError}</p>}
        {deleting && (
          <div className="space-y-3 text-sm text-nnorte-text">
            <p>Cabang berikut akan dihapus dari daftar manajemen:</p>
            <div className="rounded-xl border border-nnorte-border bg-nnorte-surface-2 p-3">
              <p className="font-semibold">{deleting.name}</p>
              <p className="mt-0.5 font-mono text-xs text-nnorte-muted">{deleting.code}</p>
              <p className="mt-1 text-[11px] text-nnorte-muted">{deleting.city}</p>
            </div>
            <p className="text-xs leading-relaxed text-nnorte-muted">
              Data transaksi, pembayaran, stok, anggota, dan audit lama tetap tersimpan. Jika cabang ini aktif, cabang aktif setelahnya akan dinomori ulang tanpa celah, apa pun kotanya.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
