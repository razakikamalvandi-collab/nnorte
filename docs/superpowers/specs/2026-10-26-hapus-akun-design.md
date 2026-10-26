# Cabut Akses + Tukar Email — Admin & Hak Akses + Karyawan Cabang

Tanggal: 2026-10-26 · Status: disetujui & terverifikasi (lihat bagian Verifikasi)

## Intent
Tombol "Hapus" **tidak menghapus akun**. Yang dilakukan:
1. Membership staf dihapus (ia hilang dari daftar tim, role-nya hilang).
2. Email korporatnya **ditukar** menjadi email placeholder internal
   (`nonaktif.<acak>@nnorte-removed.local`) — jadi email korporat **bebas dipakai lagi**
   untuk staf baru.
3. Akun Auth & profil **tetap ada** (riwayat audit/expenses tetap tertaut), tetapi orang itu
   tidak bisa login lagi dengan email korporat lama (emailnya sudah diganti diam-diam,
   dia tidak tahu email barunya) dan tidak punya membership → jatuh ke role customer.

## Keputusan (dari percakapan)
- Pendekatan: **tukar email, tanpa hapus akun** (pengganti "hapus total").
- Halaman **Karyawan Cabang** (admin cabang): tombol **Hapus** hanya untuk kasir/dapur di
  cabangnya sendiri. Tidak bisa menghapus admin cabang lain.
- Halaman **Admin & Hak Akses** (owner): Edit (sudah ada) + **Hapus** untuk semua staf
  non-owner (semua cabang).
- Tidak ada yang bisa menembak **owner** atau **diri sendiri**.

## Aturan hak (ditegakkan server-side di Edge Function)
| Pemanggil | Boleh mencabut akses |
|---|---|
| Owner aktif | Semua member non-owner di restorannya (semua cabang) |
| Admin cabang aktif | Hanya cashier/kitchen dengan branch = cabang pemanggil |
| Lainnya | Tidak bisa |

Pengaman tambahan: target yang punya membership di restoran **lain** ditolak (tukar email
berlaku global per proyek), dan pemanggil tidak bisa mencabut dirinya sendiri.

## Implementasi
1. **Edge Function `admin-users`** — aksi baru `revoke_access`:
   - Verifikasi membership aktif pemanggil (owner / branch_admin) dari token.
   - Snapshot data target via service role (diurutkan agar audit deterministik); tolak
     bila owner / diri sendiri / di luar cakupan / punya membership di restoran lain.
   - Tukar email dulu, lalu hapus baris `memberships` target di restoran pemanggil
     (bila hapus gagal, email lama dipulihkan + audit `outcome: 'error'` — semua jalur
     gagal bisa diulang).
   - `admin.auth.admin.updateUserById(id, { email: 'nonaktif.<uuid>@nnorte-removed.local', email_confirm: true })`.
   - Tulis `audit_logs` (`CABUT_AKUN`, actor = pemanggil, detail nama + email lama + role).
2. **`src/lib/adminUsers.ts`** — `revokeStaffAccess(userId)` + helper murni
   `canDeleteMember(viewerRole, targetRole)` untuk gating UI + unit test.
3. **`AdminHakAkses.tsx`** — tombol Hapus (sampah) di baris staf; modal konfirmasi
   (nama + email + teks "akses dicabut permanen, email bisa dipakai ulang; riwayat tetap ada").
4. **`KaryawanCabang.tsx`** — tombol Hapus pada baris kasir/dapur; modal konfirmasi sama.
5. **Migrasi `202610260004_service_role_delete_membership.sql`** — `grant delete on
   public.memberships to service_role;` (deviasi dari rencana awal "tanpa migrasi":
   `service_role` project ini tidak mewarisi DELETE pada tabel tersebut; revoke pertama
   gagal *permission denied*. Service role tidak pernah dipakai browser, jadi aman).

## Non-goals
- Tidak menghapus `auth.users`/`profiles` (beda dengan hapus total).
- Tidak mengubah alur Nonaktifkan/Edit/ganti sandi. Nonaktifkan tetap ada untuk
  penonaktifan yang bisa dipulihkan; tombol Hapus ini permanen.
- Tidak ada hapus massal.

## Verifikasi (hasil nyata, 2026-10-26)
- Vitest `canDeleteMember`: 5 test lulus (total 10 file / 71 test). Typecheck + build lulus.
- Migrasi `202610260004` di-push ke project tertaut; Edge Function di-deploy (2x: awal +
  setelah refactor hasil review).
- E2E tenant QA sementara (semua sudah dihapus, sisa 0):
  - UI admin cabang mencabut kasir: kartu hilang, email jadi `nonaktif.*@nnorte-removed.local`,
    audit `CABUT_AKUN` oleh admin tercatat; kartu admin lain tidak punya tombol hapus.
  - UI owner mencabut admin cabang: baris hilang, audit `CABUT_AKUN` oleh owner tercatat.
  - Bukti email bebas: owner membuat kasir baru di cabang sama dan mendapat email korporat
    lama tanpa akhiran (`kasircabutqa@nnorte.com`).
  - API negatif: admin → diri sendiri 400; admin → owner 403; admin → admin restoran lain
    403; kasir (non-pemanggil berhak) 403; owner → diri sendiri 400; target tanpa
    membership 404. Kasir yang dicabut tidak bisa login (invalid_credentials).
- Screenshot: `qa_revoke_modal_admin.png`, `qa_revoke_modal_owner.png`,
  `qa_revoke_owner_new_kasir.png` (di folder temp QA).
