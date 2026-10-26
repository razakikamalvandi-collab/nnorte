# Cabut Akses (Hapus Tim) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner (Admin & Hak Akses) dan admin cabang (Karyawan Cabang) dapat mencabut akses staf secara permanen: membership dihapus + email korporat ditukar ke placeholder, tanpa menghapus akun Auth.

**Architecture:** Semua operasi berisiko lewat Edge Function `admin-users` (service role) — aksi baru `revoke_access` menegakkan cakupan hak (owner = semua non-owner; admin cabang = kasir/dapur cabangnya), menghapus membership, menukar email, lalu menulis audit. Frontend hanya memanggil lib baru + menampilkan tombol/modal konfirmasi, dengan gating UI dari helper murni.

**Tech Stack:** React 19 + TS, Deno Edge Function, Supabase (service role admin API), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-hapus-akun-design.md`

## Global Constraints

- Service-role key hanya dibaca di Edge Function; tidak ada di frontend.
- Tidak ada yang bisa mencabut owner atau dirinya sendiri.
- Target yang punya membership di restoran lain ditolak (tukar email bersifat global).
- Email placeholder: `nonaktif.<8hex>@nnorte-removed.local`, dikonfirmasi otomatis.
- Audit aksi: `CABUT_AKUN` (actor = pemanggil, target memuat nama + email lama + role).
- UI memakai token `nnorte-*`; copy Indonesia; tombol aksi berbahaya memakai `Button variant="danger"` dengan modal konfirmasi.
- Jangan mengubah alur Nonaktifkan/Edit/ganti sandi yang sudah ada.

## Review Focus

- Admin cabang mencoba mencabut admin cabang lain → harus ditolak server (403), bukan cuma disembunyikan di UI. *(Test: E2E Task 6, assert pesan 403 + membership masih ada.)*
- Target punya membership di restoran lain → ditolak sebelum email ditukar. *(Test: E2E Task 6, cabang QA kedua di restoran berbeda.)*
- Pemanggil mencabut diri sendiri → 400, tanpa perubahan apa pun. *(Test: unit Task 1 + guard server Task 2.)*
- Gagal tukar email setelah verifikasi → 500, membership TIDAK dihapus (urutan: tukar email dulu, hapus membership kemudian). *(Review manual saat code review; tidak bisa diuji otomatis tanpa fault injection.)*
- Setelah akses dicabut, email korporat lama harus bebas: akun baru dengan role/cabang sama mendapat email tanpa akhiran. *(Test: E2E Task 6.)*

---

### Task 1: Helper murni `canDeleteMember` (TDD)

**Files:**
- Create: `src/lib/memberActions.ts`
- Create: `src/lib/__tests__/memberActions.test.ts`

**Interfaces:**
- Produces: `canDeleteMember(viewerRole: UserRole, target: { role: UserRole; isSelf: boolean }): boolean`
  - `owner`: true bila target non-owner dan bukan diri sendiri.
  - `branch_admin`: true bila target role `cashier`/`kitchen` dan bukan diri sendiri.
  - selain itu (`cashier`, `kitchen`, `customer`): false.

- [x] **Step 1: Tulis test gagal** — `memberActions.test.ts` menutup: owner menghapus branch_admin/cashier/kitchen = true; owner menghapus owner = false; branch_admin menghapus cashier/kitchen = true; branch_admin menghapus branch_admin = false; isSelf selalu false untuk semua role; cashier/kitchen/customer = false semua target.

- [x] **Step 2: Jalankan & pastikan gagal** — `npm test -- src/lib/__tests__/memberActions.test.ts`; expect FAIL (modul belum ada).

- [x] **Step 3: Implementasi** — `memberActions.ts` tanpa import supabase (murni).

- [x] **Step 4: Jalankan & pastikan lulus** — `npm test -- src/lib/__tests__/memberActions.test.ts`; expect PASS.

---

### Task 2: Edge Function aksi `revoke_access`

**Files:**
- Modify: `supabase/functions/admin-users/index.ts`

**Interfaces:**
- Consumes: pola yang sudah ada (`HttpError`, `json()`, `audit()`, `admin` service-role client, `UUID_RE`).
- Produces: `POST { action: 'revoke_access', user_id }` → `200 { ok: true }` atau error `{ ok: false, error }`.
- Produces (untuk Task 3/4/5): caller check diperluas — aktif `owner` ATAU `branch_admin`:
  - owner: `restaurantId` dari membership owner; `callerRole = 'owner'`.
  - branch_admin: `restaurantId` + `branchId` dari membership branch_admin; `callerRole = 'branch_admin'`.
  - keduanya tidak ada → 403 (pesan lama).
  - Aksi lama (`create_user`, `reset_password`) tetap wajib owner → guard `callerRole !== 'owner'` di awal masing-masing aksi lama.

- [x] **Step 1: Perluas caller check** — ganti blok "Pemanggil wajib owner aktif" (baris ~76-86) menjadi query `memberships` (`select restaurant_id, role, branch_id`) `.eq('user_id', caller.id).eq('status','active')`, ambil semua baris (bukan `limit(1)`), lalu tentukan `callerRole/restaurantId/callerBranchId`. Owner menang bila keduanya ada.

- [x] **Step 2: Tambah guard owner-only pada aksi lama** — awal blok `create_user` dan `reset_password`: `if (callerRole !== 'owner') throw new HttpError(403, 'Hanya pemilik utama yang dapat mengelola akun pengguna.');`

- [x] **Step 3: Implementasi aksi `revoke_access`** — urutan:
  1. `if (callerRole === undefined) throw 403` (tak mungkin, sudah diguard di atas).
  2. Validasi `user_id` UUID; `user_id === caller.id` → 400 "Tidak dapat mencabut akses akun Anda sendiri."
  3. Snapshot membership target (admin client): semua baris `user_id = target`; jika kosong → 404 "Pengguna bukan staf di restoran mana pun."
  4. Ada baris `role = 'owner'` → 403. Ada baris `restaurant_id !== restaurantId` → 403 "Pengguna juga terdaftar di restoran lain."
  5. Cakupan: `callerRole === 'branch_admin'` → semua baris target wajib `role in (cashier,kitchen)` dan `branch_id === callerBranchId`, selain itu 403 "Admin cabang hanya dapat mencabut akses kasir/dapur di cabangnya."
  6. Ambil email lama: `admin.auth.admin.getUserById(userId)`; profil nama: `admin.from('profiles').select('full_name').eq('id', userId).maybeSingle()`.
  7. Tukar email: `admin.auth.admin.updateUserById(userId, { email: 'nonaktif.' + crypto.randomUUID().replaceAll('-','').slice(0,8) + '@nnorte-removed.local', email_confirm: true })`; gagal → 500 (membership belum disentuh).
  8. Hapus membership: `admin.from('memberships').delete().eq('user_id', userId).eq('restaurant_id', restaurantId)`; gagal → 500.
  9. `audit(branchTarget, 'CABUT_AKUN', '<full_name> <oldEmail> (<role>)')`.
  10. `return json(req, 200, { ok: true })`.

- [x] **Step 4: Update komentar header** — daftar aksi + kalimat "Owner atau admin cabang (cakupan dibatasi) dapat mencabut akses".

- [x] **Step 5: Type-check Deno lokal tidak tersedia — verifikasi sintaks via deploy di Task 6; sementara cukup review mandiri.**

---

### Task 3: Lib `revokeStaffAccess`

**Files:**
- Modify: `src/lib/adminUsers.ts`

**Interfaces:**
- Consumes: `callAdmin` (sudah ada).
- Produces: `export const revokeStaffAccess = (userId: string) => callAdmin<Record<string, never>>({ action: 'revoke_access', user_id: userId });`

- [x] **Step 1: Tambahkan fungsi** di akhir `adminUsers.ts` persis seperti Interfaces.

- [x] **Step 2: `npm run typecheck`** — expect PASS.

---

### Task 4: Tombol Hapus di AdminHakAkses (owner)

**Files:**
- Modify: `src/views/super-admin/AdminHakAkses.tsx`

**Interfaces:**
- Consumes: `canDeleteMember` (Task 1), `revokeStaffAccess` (Task 3), `Modal`/`Button`/`ErrBox` yang sudah ada; `Button variant="danger"`.
- Produces: `mode` union bertambah `'revoke'`; state `revokeBusy`.

- [x] **Step 1: Impor & state** — `Trash2` dari lucide; `canDeleteMember` dari `../../lib/memberActions`; `revokeStaffAccess` dari `../../lib/adminUsers`. Mode union jadi `null | 'create' | 'edit' | 'password' | 'revoke'`. Reuse `busy`/`err` yang sudah ada (tidak perlu state baru bila submit memakai `busy`).

- [x] **Step 2: Handler** — `openRevoke(u)` (set target + mode), `submitRevoke(e)`: guard `busy || !target`; `setBusy(true)`; `const res = await revokeStaffAccess(target.id)`; gagal → `setErr(res.error)`; sukses → `addToast('success', 'Akses ' + target.name + ' dicabut. Email korporatnya bebas dipakai ulang.')`, `setMode(null)`, `await reloadData()`.

- [x] **Step 3: Tombol di baris** — di dalam blok `manageable &&` ketiga (setelah tombol UserCog): tombol ikon `Trash2`, `aria-label={"Hapus akses " + u.name}`, `title="Cabut akses permanen"`, gaya sama dengan tombol lain tapi `text-nnorte-red hover:border-nnorte-red/60`. Gating: `manageable` tetap, DAN konsisten dengan helper — biarkan server yang menegakkan ulang.

- [x] **Step 4: Modal konfirmasi** — blok `mode === 'revoke'` di Modal yang sudah ada:
  - Konten: `ErrBox`, paragraf peringatan permanen ("Akses {target.name} dicabut permanen. Akun tidak bisa login lagi; riwayat tetap ada; email korporat {target.email} bebas dipakai ulang."), dan info role memakai `ROLE_LABEL[target.role]`.
  - Footer: tombol submit `form={formId}` dengan `variant="danger"` label "Cabut Akses".
  - `title` untuk mode revoke: `Cabut Akses: {target?.name ?? ''}`.
- [x] **Step 5: `npm run typecheck`** — expect PASS.

---

### Task 5: Tombol Hapus di KaryawanCabang (admin cabang)

**Files:**
- Modify: `src/views/branch-admin/KaryawanCabang.tsx`

**Interfaces:**
- Consumes: `canDeleteMember`, `revokeStaffAccess`, `Modal`, `Button`, `useApp().reloadData/addToast/dataLoading`.
- Produces: modal konfirmasi hapus per kartu staf kasir/dapur.

- [x] **Step 1: State & handler** — `const [target, setTarget]`, `const [busy, setBusy]`, `const [err, setErr]`; `openRevoke(u)`, `submitRevoke(e)` (pola sama dengan Task 4 Step 2; toast sukses sama).

- [x] **Step 2: Tombol di kartu** — di kanan atas kartu (sejajar badge status), tampilkan hanya bila `canDeleteMember('branch_admin', { role: u.role, isSelf: u.id === currentUser?.id })` → tombol ikon `Trash2` (`aria-label={"Hapus akses " + u.name}`), gaya merah tipis sama dengan Task 4.

- [x] **Step 3: Modal konfirmasi** — `maxWidth="sm"`, konten: peringatan permanen + nama/email/role target, footer `Button variant="danger"` "Cabut Akses" + `variant="secondary"` Batal.

- [x] **Step 4: Update copy header** — ganti kalimat "Penambahan akun dan perubahan akses dilakukan oleh pemilik di menu Akses Pengguna." menjadi: "Penambahan akun dan perubahan akses dilakukan oleh pemilik di menu Akses Pengguna. Admin cabang dapat mencabut akses kasir/dapur cabang ini secara permanen."

- [x] **Step 5: `npm run typecheck`** — expect PASS.

---

### Task 6: Verifikasi, deploy, E2E

**Files:** tidak ada perubahan produksi kecuali bug ditemukan.

- [x] **Step 1: Test + typecheck + build** — `npm test` (all pass), `npm run typecheck`, `npm run build`. *(Hasil: 10 file / 71 test lulus, typecheck lulus, build lulus.)*

- [x] **Step 2: Push migrasi + deploy Edge Function** — `npx supabase db push` (migrasi `202610260004`) lalu `npx supabase functions deploy admin-users` (CLI versi ini tidak memakai flag `--linked`). *(Dikerjakan sebelum deploy ulang berikutnya.)*

- [x] **Step 3: E2E tenant QA sementara** (pola seed/cleanup yang sudah ada di sesi ini):
  - Seed: restoran A + cabang A1 + owner + admin cabang A1 + kasir; restoran B + cabang + admin cabang B (target lintas restoran).
  - Admin cabang A1 login → Karyawan Cabang → hapus kasir → assert: kartu hilang; membership kasir terhapus; email kasir jadi `nonaktif.*@nnorte-removed.local`; audit `CABUT_AKUN` tercatat. ✔
  - Buat kasir baru (role sama, cabang sama) via UI owner → email tanpa akhiran (email lama bebas). ✔ (`kasircabutqa@nnorte.com` tanpa akhiran)
  - Admin cabang A1 mencoba mencabut admin cabang B / dirinya sendiri via API langsung → 403/400, membership tetap ada. ✔ (Fase A)
  - Owner → Admin & Hak Akses → hapus admin cabang A1 via UI → assert sama seperti di atas. ✔
  - Owner mencoba mencabut dirinya sendiri via API → 400. ✔ (Fase C)
  - Kasir yang sudah dicabut tidak bisa login lagi dengan email korporat lama. ✔ (`invalid_credentials`)
  - Cleanup semua data QA (pola `qa_stock_cleanup.sql`), assert sisa = 0. ✔ (semua 0)

- [x] **Step 4: Lapor hasil** — ringkas bukti (SQL assert + screenshot bila ada) ke user; commit file terkait.

---

## Catatan eksekusi (hasil nyata + review akhir)

1. **Migrasi tambahan `202610260004_service_role_delete_membership.sql`** — desain awal bilang
   "tanpa migrasi DB", ternyata `service_role` di project ini TIDAK mewarisi `DELETE` pada
   tabel `memberships` (revoke pertama di produksi gagal: *permission denied for table
   memberships*). Perbaikan: `grant delete on public.memberships to service_role;` — aman
   karena service role tidak pernah dipakai browser.
2. **Urutan aksi mengikuti rencana** (tukar email dulu → hapus membership), ditambah
   pemulihan: bila hapus membership gagal setelah email tertukar, email lama dipulihkan dan
   audit dicatat dengan `outcome: 'error'`; semua jalur gagal tetap bisa diulang.
3. **Perbaikan dari review fresh-context** (10 temuan; 1 MAJOR + 3 MAJOR-minor ditangani):
   snapshot membership diurutkan (`branch_id`, `role`) + daftar role digabung untuk audit
   deterministik; pesan 403 pemanggil non-owner jadi generik ("Anda tidak memiliki izin…");
   placeholder email memakai UUID penuh; doc-comment `canDeleteMember` menjelaskan bahwa
   cakupan cabang ditangani pemanggil/server.
4. **Deviasi kecil yang diterima**: tombol sampah bergaya muted-dengan-hover-merah
   (konsisten dengan Pencil/KeyRound/UserCog), bukan merah permanen; modal revoke memakai
   `maxWidth="sm"`.
5. **Temuan runtime QA** (untuk seed tenant sementara berikutnya): akun `auth.users` buatan
   SQL wajib punya `confirmation_token/recovery_token/email_change/email_change_token_new`
   berisi `''` (bukan NULL) dan `is_super_admin = NULL`, kalau GoTrue menjawab 500
   "Database error querying schema". Dev server Vite sesekali menyajikan modul usang
   (HMR kelewat) — restart dev server sebelum E2E UI.
