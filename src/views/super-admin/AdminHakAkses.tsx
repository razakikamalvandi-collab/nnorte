import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, KeyRound, Pencil, Plus, Search, Shield, Trash2, UserCog, Users, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { STAFF_ROLE_LABEL, StaffRole, createStaffUser, previewCorporateEmail, resetUserPassword, revokeStaffAccess, validatePassword, validatePhone } from '../../lib/adminUsers';
import { canDeleteMember } from '../../lib/memberActions';
import { TeamMember, UserRole } from '../../types';

const ROLE_LABEL: Record<UserRole, string> = { owner: 'Pemilik', branch_admin: 'Admin Cabang', cashier: 'Kasir', kitchen: 'Dapur', customer: 'Pelanggan' };
const ROLE_BADGE: Record<UserRole, string> = {
  owner: 'border-nnorte-red/40 bg-nnorte-red/10 text-nnorte-red',
  branch_admin: 'border-nnorte-blue/30 bg-nnorte-blue/10 text-nnorte-blue-soft',
  cashier: 'border-nnorte-success/30 bg-nnorte-success/10 text-nnorte-success',
  kitchen: 'border-nnorte-warning/30 bg-nnorte-warning/10 text-nnorte-warning',
  customer: 'border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted',
};
const STAFF_ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

const fmtLogin = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso)) : 'Belum pernah';

const ErrBox: React.FC<{ msg: string | null }> = ({ msg }) =>
  msg ? <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{msg}</p> : null;

export const AdminHakAkses: React.FC = () => {
  const { users, branches, currentUser, setMemberStatus, updateMemberAccess, reloadData, dataError, dataLoading, addToast, addAuditLog } = useApp();
  const { updatePassword, user: authUser } = useAuth();
  const isOwner = currentUser?.role === 'owner';

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [mode, setMode] = useState<null | 'create' | 'edit' | 'password' | 'revoke'>(null);
  const [target, setTarget] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole | ''>('');
  const [branchId, setBranchId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [emailPreview, setEmailPreview] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => (roleFilter === 'all' || u.role === roleFilter) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  }, [users, search, roleFilter]);

  // Pratinjau email korporat (backend yang menjamin keunikan; ini hanya pratinjau).
  useEffect(() => {
    if (mode !== 'create' || !branchId || !role) {
      setEmailPreview('');
      return;
    }
    let cancelled = false;
    setEmailBusy(true);
    previewCorporateEmail(role, branchId)
      .then((e) => !cancelled && setEmailPreview(e))
      .catch(() => !cancelled && setEmailPreview(''))
      .finally(() => !cancelled && setEmailBusy(false));
    return () => {
      cancelled = true;
    };
  }, [mode, role, branchId]);

  const reset = () => {
    setErr(null);
    setPassword('');
    setConfirm('');
    setOldPassword('');
  };
  const close = () => {
    if (busy) return;
    setMode(null);
    setTarget(null);
  };
  const openCreate = () => {
    reset();
    setFullName('');
    setPhone('');
    setRole('');
    setBranchId('');
    setEmailPreview('');
    setMode('create');
  };
  const openEdit = (u: TeamMember) => {
    reset();
    setTarget(u);
    setFullName(u.name);
    setPhone(u.phone ?? '');
    setRole((u.role === 'owner' || u.role === 'customer' ? 'cashier' : u.role) as StaffRole);
    setBranchId(u.branchId ?? branches[0]?.id ?? '');
    setMode('edit');
  };
  const openPassword = (u: TeamMember) => {
    reset();
    setTarget(u);
    setMode('password');
  };
  const openRevoke = (u: TeamMember) => {
    reset();
    setTarget(u);
    setMode('revoke');
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!fullName.trim()) return setErr('Nama lengkap wajib diisi.');
    const phe = validatePhone(phone);
    if (phe) return setErr(phe);
    if (!role) return setErr('Pilih role / jabatan.');
    if (!branchId) return setErr('Pilih cabang.');
    const pe = validatePassword(password);
    if (pe) return setErr(pe);
    if (password !== confirm) return setErr('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    setErr(null);
    const res = await createStaffUser({ fullName: fullName.trim(), role, branchId, password, phone: phone.trim() });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    addToast('success', `Akun dibuat: ${res.data.user.email}`);
    setMode(null);
    await reloadData();
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !target) return;
    if (!fullName.trim()) return setErr('Nama lengkap wajib diisi.');
    const phe = validatePhone(phone);
    if (phe) return setErr(phe);
    if (!role) return setErr('Pilih role / jabatan.');
    if (!branchId) return setErr('Pilih cabang.');
    setBusy(true);
    setErr(null);
    const res = await updateMemberAccess(target.id, { fullName: fullName.trim(), phone: phone.trim(), role, branchId });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    addToast('success', 'Akses pengguna diperbarui.');
    setMode(null);
  };

  const isSelf = !!target && target.id === currentUser?.id;
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !target) return;
    const pe = validatePassword(password);
    if (pe) return setErr(pe);
    if (password !== confirm) return setErr('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    setErr(null);
    if (isSelf) {
      const email = authUser?.email;
      if (!email || !oldPassword) {
        setBusy(false);
        return setErr('Masukkan kata sandi saat ini.');
      }
      const { error: vErr } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
      if (vErr) {
        setBusy(false);
        return setErr('Kata sandi saat ini salah.');
      }
      const r = await updatePassword(password);
      setBusy(false);
      if (!r.ok) return setErr(r.error || 'Gagal mengubah kata sandi.');
      void addAuditLog('UBAH_KATA_SANDI', 'Kata sandi akun sendiri diubah');
    } else {
      const r = await resetUserPassword(target.id, password);
      setBusy(false);
      if (!r.ok) return setErr(r.error);
    }
    addToast('success', 'Kata sandi berhasil diubah.');
    setMode(null);
  };

  const toggleStatus = async (u: TeamMember) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !window.confirm(`Nonaktifkan akses ${u.name}?`)) return;
    const res = await setMemberStatus(u.id, next);
    addToast(res.ok ? 'success' : 'error', res.ok ? `Akses ${u.name} ${next === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.` : res.error);
  };

  const submitRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !target) return;
    setBusy(true);
    setErr(null);
    const res = await revokeStaffAccess(target.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    addToast('success', `Akses ${target.name} dicabut. Email korporatnya bebas dipakai ulang.`);
    setMode(null);
    setTarget(null);
    await reloadData();
  };

  const pwFields = (
    <>
      {isSelf && (
        <Field label="Kata Sandi Saat Ini" required>
          <input type="password" name="current-password" autoComplete="current-password" className={inputClass()} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        </Field>
      )}
      <Field label="Kata Sandi Baru" required hint="Minimal 8 karakter, mengandung huruf dan angka.">
        <input type="password" name="new-user-password" autoComplete="new-password" className={inputClass()} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Ulangi Kata Sandi Baru" required>
        <input type="password" name="confirm-user-password" autoComplete="new-password" className={inputClass()} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
    </>
  );

  const roleBranchFields = (
    <>
      <Field label="Role" required>
        <select
          className={inputClass(false, !role)}
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
          name="new-user-role"
          autoComplete="off"
          required
        >
          <option value="" disabled>Pilih role / jabatan...</option>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label="Cabang" required>
        <select
          className={inputClass(false, !branchId)}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          name="new-user-branch"
          autoComplete="off"
          required
        >
          <option value="" disabled>Pilih cabang lokasi...</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
    </>
  );

  const title = mode === 'create' ? 'Tambah Pengguna Internal' : mode === 'edit' ? `Edit Akses: ${target?.name ?? ''}` : mode === 'revoke' ? `Cabut Akses: ${target?.name ?? ''}` : isSelf ? 'Ubah Kata Sandi Saya' : `Ubah Kata Sandi: ${target?.name ?? ''}`;
  const formId = 'user-form';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Akses Pengguna</h1>
          <p className="mt-1 text-xs text-nnorte-muted">Kelola role, penugasan cabang, dan kata sandi pengguna internal.</p>
        </div>
        {isOwner && <Button icon={<Plus size={16} />} onClick={openCreate} disabled={branches.length === 0}>Tambah Pengguna</Button>}
      </div>

      {dataError && <ErrorState message={dataError} onRetry={() => void reloadData()} />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nnorte-muted" aria-hidden="true" />
          <input type="search" aria-label="Cari pengguna" placeholder="Cari nama atau email…" className={`${inputClass()} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select aria-label="Filter role" className={`${inputClass()} sm:w-48`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}>
          <option value="all">Semua Role</option>
          {(['owner', ...STAFF_ROLES] as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {!dataLoading && users.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada pengguna internal" description={isOwner ? 'Tambahkan admin cabang, kasir, atau dapur.' : undefined} action={isOwner ? <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Pengguna</Button> : undefined} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-nnorte-border bg-nnorte-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-nnorte-border bg-nnorte-sidebar text-[10px] uppercase tracking-wider text-nnorte-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pengguna</th>
                  <th className="px-4 py-3 font-semibold">Email &amp; Kontak</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Cabang</th>
                  <th className="px-4 py-3 font-semibold">Login Terakhir</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nnorte-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-nnorte-muted">Tidak ada pengguna yang cocok dengan filter.</td></tr>
                ) : (
                  filtered.map((u) => {
                    const self = u.id === currentUser?.id;
                    const manageable = isOwner && u.role !== 'owner' && !self;
                    const revocable = isOwner && canDeleteMember('owner', { role: u.role, isSelf: self });
                    return (
                      <tr key={u.id} className="hover:bg-nnorte-surface-2/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-nnorte-border bg-nnorte-surface-2 font-bold text-nnorte-red">{u.name.charAt(0).toUpperCase()}</span>
                            <span className="font-bold text-nnorte-text">{u.name}{self && <span className="ml-1.5 text-[10px] font-normal text-nnorte-muted">(Anda)</span>}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-nnorte-muted"><div className="text-nnorte-text">{u.email}</div><div className="text-[10px]">{u.phone || '-'}</div></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[u.role]}`}><Shield size={10} aria-hidden="true" />{ROLE_LABEL[u.role]}</span></td>
                        <td className="px-4 py-3 text-nnorte-muted"><span className="inline-flex items-center gap-1.5"><Building2 size={13} className="text-nnorte-blue-soft" aria-hidden="true" />{u.branchName || 'Seluruh Cabang'}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-nnorte-muted">{fmtLogin(u.lastSignInAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${u.status === 'active' ? 'text-nnorte-success' : 'text-nnorte-muted'}`}>
                            {u.status === 'active' ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                            {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {manageable && (
                              <button type="button" aria-label={`Edit akses ${u.name}`} title="Edit role dan cabang" onClick={() => openEdit(u)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"><Pencil size={14} /></button>
                            )}
                            {(manageable || self) && (
                              <button type="button" aria-label={`Ubah kata sandi ${u.name}`} title="Ubah kata sandi" onClick={() => openPassword(u)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"><KeyRound size={14} /></button>
                            )}
                            {manageable && (
                              <button type="button" aria-label={u.status === 'active' ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`} title={u.status === 'active' ? 'Nonaktifkan akses' : 'Aktifkan akses'} onClick={() => void toggleStatus(u)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-blue/40 hover:text-nnorte-text"><UserCog size={14} /></button>
                            )}
                            {revocable && (
                              <button type="button" aria-label={`Cabut akses ${u.name}`} title="Cabut akses permanen" onClick={() => openRevoke(u)} className="nn-press inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-red/60 hover:text-nnorte-red"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={mode !== null}
        onClose={close}
        busy={busy}
        title={title}
        titleClassName="text-xl"
        maxWidth={mode === 'revoke' ? 'sm' : 'xl'}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Batal</Button>
            <Button type="submit" form={formId} variant={mode === 'revoke' ? 'danger' : 'primary'} loading={busy} loadingText={mode === 'revoke' ? 'Mencabut…' : 'Menyimpan…'}>
              {mode === 'create' ? 'Buat Akun' : mode === 'password' ? 'Ubah Kata Sandi' : mode === 'revoke' ? 'Cabut Akses' : 'Simpan'}
            </Button>
          </>
        }
      >
        {mode === 'create' && (
          <form id={formId} onSubmit={submitCreate} noValidate autoComplete="off" className="flex flex-col gap-4">
            <ErrBox msg={err} />
            <Field label="Nama Lengkap" required>
              <input
                type="text"
                className={inputClass()}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                autoComplete="off"
                name="new-user-full-name"
                maxLength={80}
                required
              />
            </Field>
            <Field label="Telepon" required>
              <input
                type="tel"
                className={inputClass()}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                autoComplete="off"
                name="new-user-phone"
                inputMode="tel"
                maxLength={30}
                required
              />
            </Field>
            {roleBranchFields}
            <Field label="Email Korporat" hint="Dibuat otomatis; bila sudah dipakai, sistem menambahkan akhiran angka.">
              <input
                type="text"
                readOnly
                className={`${inputClass()} font-mono`}
                value={emailBusy ? 'Memuat…' : emailPreview}
                placeholder="Otomatis terisi oleh sistem"
                autoComplete="off"
                name="new-user-email"
                aria-live="polite"
              />
            </Field>
            {pwFields}
          </form>
        )}
        {mode === 'edit' && (
          <form id={formId} onSubmit={submitEdit} noValidate autoComplete="off" className="flex flex-col gap-4">
            <ErrBox msg={err} />
            <Field label="Email">
              <input type="text" readOnly className={inputClass()} value={target?.email ?? ''} autoComplete="off" name="edit-user-email" />
            </Field>
            <Field label="Nama Lengkap" required>
              <input
                type="text"
                className={inputClass()}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                autoComplete="off"
                name="edit-user-full-name"
                maxLength={80}
                required
              />
            </Field>
            <Field label="Telepon" required>
              <input
                type="tel"
                className={inputClass()}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                autoComplete="off"
                name="edit-user-phone"
                inputMode="tel"
                maxLength={30}
                required
              />
            </Field>
            {roleBranchFields}
          </form>
        )}
        {mode === 'password' && (
          <form id={formId} onSubmit={submitPassword} noValidate autoComplete="off" className="flex flex-col gap-4">
            <ErrBox msg={err} />
            {pwFields}
          </form>
        )}
        {mode === 'revoke' && (
          <form id={formId} onSubmit={submitRevoke} noValidate className="flex flex-col gap-4">
            <ErrBox msg={err} />
            <p className="text-sm text-nnorte-text">
              Cabut akses <span className="font-bold">{target?.name}</span>
              {target && <> ({ROLE_LABEL[target.role]})</>} secara permanen?
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-nnorte-muted">
              <li>Akun langsung keluar dari daftar tim dan tidak bisa login lagi dengan email korporatnya.</li>
              <li>Email korporat <span className="font-mono text-nnorte-text">{target?.email}</span> bebas dipakai untuk akun baru.</li>
              <li>Riwayat audit dan pengeluaran tetap tersimpan.</li>
            </ul>
          </form>
        )}
      </Modal>
    </div>
  );
};
