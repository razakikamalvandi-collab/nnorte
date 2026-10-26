import React from 'react';
import { CheckCircle2, Mail, Phone, Users, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../../components/ui/States';

const ROLE_LABEL = { owner: 'Pemilik', branch_admin: 'Admin Cabang', cashier: 'Kasir POS', kitchen: 'Petugas Dapur', customer: 'Pelanggan' } as const;

export const KaryawanCabang: React.FC = () => {
  const { currentUser, branches, users, dataLoading } = useApp();
  const branchId = currentUser?.branchId;
  const branch = branches.find((b) => b.id === branchId);
  const staff = users.filter((u) => u.branchId === branchId && u.role !== 'owner');

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-nnorte-text sm:text-2xl">Karyawan Cabang</h1>
        <p className="mt-1 text-xs text-nnorte-muted">
          Staf yang bertugas di {branch?.name ?? 'cabang Anda'}. Penambahan akun dan perubahan akses dilakukan oleh pemilik di menu Akses Pengguna.
        </p>
      </div>

      {!dataLoading && staff.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada karyawan terdaftar." description="Minta pemilik menambahkan akun kasir atau dapur untuk cabang ini." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((u, i) => (
            <li key={u.id} className="nn-rise nn-lift flex min-w-0 flex-col gap-3 rounded-xl border border-nnorte-border bg-nnorte-surface p-5" style={{ ['--i' as string]: i }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-nnorte-border bg-nnorte-surface-2 font-bold text-nnorte-red" aria-hidden="true">{u.name.charAt(0)}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-nnorte-text">{u.name}</h3>
                    <span className="text-[11px] text-nnorte-muted">{ROLE_LABEL[u.role]}</span>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] ${u.status === 'active' ? 'text-nnorte-success' : 'text-nnorte-muted'}`}>
                  {u.status === 'active' ? <CheckCircle2 size={12} aria-hidden="true" /> : <XCircle size={12} aria-hidden="true" />}
                  {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="space-y-1.5 border-t border-nnorte-border/60 pt-3 text-xs text-nnorte-muted">
                <div className="flex items-center gap-2"><Mail size={13} aria-hidden="true" /><span className="truncate">{u.email}</span></div>
                <div className="flex items-center gap-2"><Phone size={13} aria-hidden="true" /><span>{u.phone || '—'}</span></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
