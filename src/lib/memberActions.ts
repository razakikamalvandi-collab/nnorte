import { UserRole } from '../types';

/**
 * Aturan siapa boleh mencabut akses ("Hapus") seorang staf.
 * "Hapus" = cabut akses: membership dihapus + email korporat ditukar ke placeholder
 * internal (lihat Edge Function admin-users, aksi revoke_access).
 *
 * Dipakai untuk gating UI; server menegakkan ulang. CATATAN: helper ini tidak
 * mengetahui cakupan cabang — pembatasan "hanya kasir/dapur cabang sendiri" untuk
 * admin cabang ditangani pemanggil (daftar yang dirender satu cabang) dan Edge
 * Function.
 */
export function canDeleteMember(
  viewerRole: UserRole,
  target: { role: UserRole; isSelf: boolean },
): boolean {
  if (target.isSelf) return false;
  if (viewerRole === 'owner') return target.role !== 'owner';
  if (viewerRole === 'branch_admin') return target.role === 'cashier' || target.role === 'kitchen';
  return false;
}
