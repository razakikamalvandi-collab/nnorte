# Sistem Restoran Multi Cabang

Dashboard operasional restoran multi cabang berbasis React, Vite, dan Tailwind CSS.

## Menjalankan aplikasi

Memerlukan Node.js 20.19+ atau 22.12+.

```bash
npm install
npm run dev
```

Buka alamat yang dicetak oleh Vite (umumnya `http://localhost:5173`). Untuk membuat dan melihat build produksi:

```bash
npm run build
npm run preview
```

## Konfigurasi

Salin `.env.example` ke `.env.local`:

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | ya | Proyek Supabase (anon key bersifat publik; **jangan** pernah menaruh service-role key di frontend) |

Pemilih lokasi cabang memakai **OpenStreetMap + Leaflet** dan **Nominatim** untuk pencarian/reverse geocoding. Tidak ada API key Google Maps yang dibutuhkan; cukup koneksi internet dari browser. Batas layanan gratis dan kebijakan pemakaian dijelaskan di [supabase/SETUP.md](supabase/SETUP.md#peta--pencarian-alamat-openstreetmap).

Setup database, akun owner pertama, deploy Edge Function `admin-users`, dan pembersihan data demo: lihat [supabase/SETUP.md](supabase/SETUP.md).

## Perintah

```bash
npm run dev        # pengembangan
npm run typecheck  # tsc --noEmit
npm test           # vitest (tanggal WIB & perhitungan keuangan)
npm run build      # build produksi
```

Tes database: `supabase/tests/enhancements_test.sql` dan `supabase/tests/global_branch_codes_test.sql`; tes API/RLS: `supabase/tests/api/`.

## Ringkasan fitur

- Dashboard & Laporan Keuangan nyata (filter cabang + tanggal WIB, grafik per cabang, laba/rugi, pengeluaran, ekspor PDF/Excel).
- Manajemen cabang: kode otomatis dengan nomor urut global cabang aktif (tidak direset per kota), tombol hapus dengan soft delete + penomoran ulang, peta OpenStreetMap (Leaflet) + pencarian Nominatim + lokasi perangkat, jam operasional 24 jam/lintas tengah malam, warna grafik.
- Akses pengguna: email korporat otomatis, pembuatan akun & reset kata sandi lewat Edge Function (service-role hanya di server).
- Master menu dengan unggah gambar (Supabase Storage) dan distribusi ke cabang tanpa menimpa harga lokal.
- Portal pelanggan (QR) via RPC publik dengan splash screen, harga dihitung server, pelacakan pesanan dengan token.

## Penomoran cabang

- Cabang aktif memakai satu urutan global per restoran: `NN-{KODE_KOTA}-{NOMOR}` (mis. `NN-PDG-01`, `NN-JKT-02`). Nomor tidak direset per kota.
- Nomor cabang baru = jumlah cabang aktif + 1. Kode dibuat trigger database dan tidak dapat diubah manual.
- Hapus/nonaktifkan memakai soft delete: kode terakhir disimpan di `archived_code`, lalu seluruh cabang aktif dinomori ulang tanpa celah.
- Mengubah kota hanya mengganti prefiks kota; nomor urut cabang tetap.
- Hard delete dicabut dari role `authenticated`; gunakan RPC `delete_branch` atau `set_branch_status` (owner saja).
