import React, { useState } from 'react';
import { CheckCircle2, Mail, Phone, Trash2, Users, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { revokeStaffAccess } from '../../lib/adminUsers';
import { canDeleteMember } from '../../lib/memberActions';
import { TeamMember } from '../../types';

const ROLE_LABEL = { owner: 'Pemilik', branch_admin: 'Admin Cabang', cashier: 'Kasir POS', kitchen: 'Petugas Dapur', customer: 'Pelanggan' } as const;

const ErrBox: React.FC<{ msg: string | null }> = ({ msg }) =>
  msg ? <p role="alert" className="rounded-lg border border-nnorte-error/40 bg-nnorte-error/10 p-2.5 text-xs text-nnorte-error">{msg}</p> : null;

const revokeFormId = 'karyawan-revoke-form';

export const KaryawanCabang: React.FC = () => {
  const { currentUser, branches, users, dataLoading, reloadData, addToast } = useApp();
  const branchId = currentUser?.branchId;
  const branch = branches.find((b) => b.id === branchId);
  const staff = users.filter((u) => u.branchId === branchId && u.role !== 'owner');

  const [target, setTarget] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openRevoke = (u: TeamMember) => {
    setErr(null);
    setTarget(u);
  };
  const close = () => {
    if (busy) return;
    setTarget(null);
    setErr(null);
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
    setTarget(null);
    await reloadData();
  };

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Karyawan Cabang</h1>
        <p className="mt-1 text-xs text-nnorte-muted">
          Staf yang bertugas di {branch?.name ?? 'cabang Anda'}. Penambahan akun dan perubahan akses dilakukan oleh pemilik di menu Akses Pengguna. Admin cabang dapat mencabut akses kasir/dapur cabang ini secara permanen.
        </p>
      </div>

      {!dataLoading && staff.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada karyawan terdaftar." description="Minta pemilik menambahkan akun kasir atau dapur untuk cabang ini." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((u, i) => {
            const revocable = canDeleteMember('branch_admin', { role: u.role, isSelf: u.id === currentUser?.id });
            return (
              <li key={u.id} className="nn-rise nn-lift flex min-w-0 flex-col gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-5" style={{ ['--i' as string]: i }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-nnorte-border bg-nnorte-surface-2 font-bold text-nnorte-red" aria-hidden="true">{u.name.charAt(0)}</span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-nnorte-text">{u.name}</h3>
                      <span className="text-[11px] text-nnorte-muted">{ROLE_LABEL[u.role]}</span>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5">
                    {revocable && (
                      <button type="button" aria-label={`Cabut akses ${u.name}`} title="Cabut akses permanen" onClick={() => openRevoke(u)} className="nn-press inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-nnorte-border bg-nnorte-surface-2 text-nnorte-muted hover:border-nnorte-red/60 hover:text-nnorte-red"><Trash2 size={13} /></button>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[11px] ${u.status === 'active' ? 'text-nnorte-success' : 'text-nnorte-muted'}`}>
                      {u.status === 'active' ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
                      {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5 border-t border-nnorte-border/60 pt-3 text-xs text-nnorte-muted">
                  <div className="flex items-center gap-2"><Mail size={13} aria-hidden="true" /><span className="truncate">{u.email}</span></div>
                  <div className="flex items-center gap-2"><Phone size={13} aria-hidden="true" /><span>{u.phone || '—'}</span></div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={target !== null}
        onClose={close}
        busy={busy}
        title={target ? `Cabut Akses: ${target.name}` : ''}
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Batal</Button>
            <Button type="submit" form={revokeFormId} variant="danger" loading={busy} loadingText="Mencabut…">Cabut Akses</Button>
          </>
        }
      >
        <form id={revokeFormId} onSubmit={submitRevoke} noValidate className="flex flex-col gap-4">
          <ErrBox msg={err} />
          <p className="text-sm text-nnorte-text">
            Cabut akses <span className="font-bold">{target?.name}</span>
            {target && <> ({ROLE_LABEL[target.role]})</>} secara permanen?
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-nnorte-muted">
            <li>Akun langsung keluar dari daftar tim dan tidak bisa login lagi dengan email korporatnya.</li>
            <li>Email korporat <span className="font-mono text-nnorte-text">{target?.email}</span> bebas dipakai untuk akun baru.</li>
            <li>Riwayat tetap tersimpan.</li>
          </ul>
        </form>
      </Modal>
    </div>
  );
};
