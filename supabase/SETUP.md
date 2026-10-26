# Menyiapkan database Supabase (lengkap)

## Prasyarat
- Akun Supabase dan proyek baru sudah dibuat.
- Supabase CLI terpasang (`npm install -g supabase` atau via `npx supabase`).

## Langkah-langkah

### 1. Hubungkan proyek Supabase lokal
```bash
npx supabase login
npx supabase link --project-ref GANTI_DENGAN_PROJECT_REF
```

### 2. Push skema ke database
```bash
npx supabase db push
```
Ini akan menjalankan semua migrasi di `supabase/migrations/`:
- `202610180001_initial_schema.sql` — semua tabel, enum, fungsi RPC (`create_branch_order`, `register_payment`), trigger `updated_at`, dan Row Level Security (RLS).
- `202610180002_seed_initial_data.sql` — data contoh awal (restoran + cabang/menu/meja contoh). Untuk sistem produksi gunakan `supabase/scripts/cleanup_demo_data.sql` (manual, pratinjau + rollback default) setelah backup.
- `202610190001_owner_update_member_access.sql` — pembaruan akses anggota oleh owner.
- `202610220001_nnorte_enhancements.sql` — kolom lokasi/jam/warna cabang, kode cabang otomatis (dasar), tabel `expenses`, RPC laporan (`report_daily`, `report_payment_methods`, `report_top_menus`), bucket storage `menu-images`, RPC portal pelanggan (`portal_*`), `list_team_members`, `preview_corporate_email`, `owner_set_member_status`.
- `202610240001_global_branch_codes.sql` — nomor urut global cabang aktif (`NN-KOTA-01..N`), `sort_order`, soft delete `deleted_at`, RPC `delete_branch`/`set_branch_status`, penomoran ulang transaksional, dan trigger pengaman kode.
- `202610260001_menu_categories.sql` — tabel `menu_categories` untuk kategori master katalog yang bisa ditambahkan tanpa menu, RLS owner/member, dan backfill kategori dari `menu_items`.

### Kode cabang global

> Terapkan migrasi `202610240001_global_branch_codes.sql` sebelum memakai frontend versi ini; frontend membaca `sort_order`, `archived_code`, dan `deleted_at`.

- Nomor urut selalu `01..N` per restoran, bukan per kota; kota hanya menjadi prefiks (`NN-PDG-01`, `NN-JKT-02`).
- Kode baru dihitung database (`jumlah cabang aktif + 1`) dan tidak boleh dikirim/diubah dari frontend.
- Hapus/nonaktifkan adalah soft delete: kode terakhir disimpan di `archived_code`, cabang keluar dari urutan aktif, lalu sisa cabang dinomori ulang tanpa celah.
- Mengubah kota hanya mengganti prefiks; nomor urut tetap. Mengubah status/urutan/hapus wajib lewat RPC owner.

### 3. Buat akun owner melalui Supabase Auth
Masuk ke **Supabase Dashboard > Authentication > Users**, buat pengguna pertama (email/password), lalu **salin UUID-nya** (kolom `id`). Profil dibuat otomatis oleh trigger `on_auth_user_created`.

### 4. Tetapkan pengguna pertama sebagai owner
Buka **SQL Editor**, jalankan (ganti `UUID_PEMILIK`; `restaurants.slug` sesuaikan jika Anda membuat restoran sendiri):

```sql
insert into public.memberships (restaurant_id, user_id, branch_id, role, status)
select r.id, 'UUID_PEMILIK'::uuid, null, 'owner', 'active'
from public.restaurants r
where r.slug = 'nnorte'
on conflict do nothing;
```

Akun staf lain (admin cabang, kasir, dapur) **tidak lagi dibuat lewat SQL**: pemilik membuatnya dari menu **Akses Pengguna → Tambah Pengguna**. Email korporat (`admin.<cabang>@nnorte.com`, `kasir.<cabang>@nnorte.com`, `dapur.<cabang>@nnorte.com`) dibuat otomatis. Fitur ini memerlukan Edge Function (langkah 5).

### 5. Deploy Edge Function `admin-users`
Pembuatan akun staf dan reset kata sandi pengguna lain memerlukan hak admin Supabase Auth, sehingga hanya boleh berjalan di server tepercaya:

```bash
npx supabase functions deploy admin-users
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` disuntikkan otomatis oleh Supabase ke fungsi; **jangan** menaruh service-role key di `.env` frontend. Function hanya menerima pemilik (owner) yang sudah login (`verify_jwt = true` + pemeriksaan role di dalam fungsi) dan tidak pernah mencatat kata sandi.

### 6. Isi environment frontend
Buat file `.env.local` di root project berdasarkan `.env.example`:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key_anda_disini
```

Peta cabang memakai OpenStreetMap (Leaflet) dan Nominatim, jadi tidak ada key tambahan yang perlu diisi.

Jangan ever menyertakan `service_role` key di kode frontend.

### 7. Jalankan aplikasi
```bash
npm install
npm run dev
```

## Struktur database yang dibuat

| Tabel | Keterangan |
|-------|------------|
| `restaurants` | Tenan restoran (multi-tenant) |
| `profiles` | Profil pengguna (terkait `auth.users`) |
| `branches` | Cabang restoran |
| `memberships` | Hak akses pengguna per cabang (owner, branch_admin, cashier, kitchen) |
| `menu_items` | Katalog menu pusat |
| `menu_categories` | Kategori katalog master (bisa ada tanpa menu) |
| `branch_menu_items` | Harga & ketersediaan menu per cabang |
| `dining_tables` | Meja & token QR |
| `inventory_items` | Stok bahan baku per cabang |
| `orders` | Pesanan |
| `order_items` | Item pesanan |
| `order_item_addons` | Tambahan item pesanan |
| `payments` | Pembayaran (via `register_payment`) |
| `audit_logs` | Log aktivitas |

## Fungsi RPC

- `create_branch_order(...)` / `register_payment(...)` — pesanan & pelunasan oleh sesi terautentikasi (validasi stok, harga, total, hak akses cabang).
- `report_daily`, `report_payment_methods`, `report_top_menus` — laporan keuangan (SECURITY INVOKER, RLS tetap berlaku; zona waktu Asia/Jakarta; pesanan belum lunas/dibatalkan/refund tidak dihitung).
- `portal_get_branches`, `portal_get_menu`, `portal_resolve_table`, `portal_create_order`, `portal_get_order_status` — portal pelanggan anonim. Harga, pajak, dan total selalu dihitung server; tabel `orders`/`payments` tidak dibuka untuk insert anonim. Status pesanan hanya terbaca dengan `tracking_token` milik pesanan itu.
- `preview_branch_code(city)`, `preview_branch_code_for(branch, city)`, `preview_corporate_email(role, branch)` — pratinjau untuk owner (kode/email final ditetapkan database/Edge Function).
- `delete_branch(branch)` — soft delete cabang (owner saja), menyimpan data historis lalu menomori ulang seluruh cabang aktif.
- `set_branch_status(branch, status)` — aktif/nonaktif cabang (owner saja), sekaligus menomori ulang atau menambahkan ke urutan aktif.

## Peta & pencarian alamat (OpenStreetMap)

Pemilih lokasi cabang memakai **Leaflet** dengan tile standar **OpenStreetMap** dan **Nominatim** untuk pencarian alamat serta reverse geocoding. Tidak ada API key atau layanan berbayar yang perlu diaktifkan.

- Pencarian hanya dikirim saat pengguna menekan tombol **Cari** (tidak ada autocomplete), maksimal 1 permintaan/detik, hasil di-cache 15 menit, dan dibatasi 5 hasil untuk Indonesia.
- Reverse geocoding berjalan setelah pengguna mengklik peta, menggeser penanda, atau memakai lokasi perangkat. Alamat yang sudah diedit manual tidak ditimpa.
- Tile hanya dimuat untuk area yang terlihat; tidak ada pengunduhan massal. Atribusi OpenStreetMap selalu tampil di peta.
- Layanan gratis Nominatim/OSM bersifat best-effort tanpa SLA. Untuk trafik tinggi, gunakan instance Nominatim sendiri atau penyedia tile berbayar; jangan menaikkan beban ke server publik.
- Lokasi perangkat memerlukan HTTPS (atau `localhost`) dan izin browser.

## Pengujian database

```bash
psql -f supabase/tests/00_local_stub.sql -f supabase/migrations/*.sql -f supabase/tests/enhancements_test.sql -f supabase/tests/global_branch_codes_test.sql
```
dijalankan pada Postgres lokal kosong (stub `auth`/`storage` ada di `00_local_stub.sql`). Edge Function belum diuji otomatis; uji manual setelah deploy (lihat README).

## Catatan penting
- Frontend tidak lagi memiliki mode demo; semua data berasal dari Supabase. Tanpa `.env.local` yang benar, aplikasi menampilkan galat konfigurasi.
- Uji isolasi tenant, pembatasan per cabang, pembuatan pesanan, dan pembayaran di proyek staging sebelum migrasi data operasional.
