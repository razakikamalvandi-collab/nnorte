import { supabase } from './supabase';
import { UserRole } from '../types';

export type StaffRole = Exclude<UserRole, 'owner' | 'customer'>;

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  branch_admin: 'Admin Cabang',
  cashier: 'Kasir',
  kitchen: 'Dapur',
};

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus mengandung huruf dan angka.';
  if (pw.length > 72) return 'Kata sandi maksimal 72 karakter.';
  return null;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s().-]/g, '');
}

export function validatePhone(phone: string): string | null {
  const value = phone.trim();
  if (!value) return 'Nomor telepon wajib diisi.';
  if (value.length > 30) return 'Nomor telepon maksimal 30 karakter.';
  if (!/^(?:\+62|62|0)[1-9][0-9]{7,12}$/.test(normalizePhone(value))) {
    return 'Masukkan nomor telepon Indonesia yang valid, misalnya 081234567890.';
  }
  return null;
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = (await ctx.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* pakai pesan default */
      }
    } else if (/Failed to send|fetch/i.test(msg)) {
      msg = 'Layanan pengelolaan akun belum dapat dijangkau. Pastikan Edge Function "admin-users" sudah di-deploy.';
    }
    return { ok: false, error: msg };
  }
  const res = data as { ok?: boolean; error?: string } & T;
  if (!res?.ok) return { ok: false, error: res?.error ?? 'Permintaan ditolak.' };
  return { ok: true, data: res };
}

export async function previewCorporateEmail(role: StaffRole, branchId: string): Promise<string> {
  const { data, error } = await supabase.rpc('preview_corporate_email', { p_role: role, p_branch: branchId });
  if (error) throw new Error(error.message);
  return String(data);
}

export const createStaffUser = (v: { fullName: string; role: StaffRole; branchId: string; password: string; phone?: string }) =>
  callAdmin<{ user: { id: string; email: string } }>({ action: 'create_user', full_name: v.fullName, role: v.role, branch_id: v.branchId, password: v.password, phone: v.phone || undefined });

export const resetUserPassword = (userId: string, newPassword: string) =>
  callAdmin<Record<string, never>>({ action: 'reset_password', user_id: userId, new_password: newPassword });

export const revokeStaffAccess = (userId: string) =>
  callAdmin<Record<string, never>>({ action: 'revoke_access', user_id: userId });

export const updateStaffProfile = (userId: string, profile: { fullName: string; phone: string }) =>
  callAdmin<Record<string, never>>({ action: 'update_profile', user_id: userId, full_name: profile.fullName, phone: profile.phone });
