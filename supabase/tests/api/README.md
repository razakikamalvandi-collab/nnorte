# Tes API/RLS lewat PostgREST

Menguji RPC publik portal, isolasi RLS, pelunasan, laporan, dan pengeluaran melalui HTTP.

1. Postgres lokal kosong: jalankan `supabase/tests/00_local_stub.sql`, semua migrasi, lalu beri hak `anon`/`authenticated` (lihat fixture di bagian atas `api.test.mjs`: pengguna owner `cfe745f1-…`, kasir `…a2`, menu uji, meja `tok-1`, `allow_online_takeaway=false`).
2. Jalankan PostgREST (`db-schemas=public`, `db-anon-role=anon`, `jwt-secret` sama dengan `SECRET` di file, port 3300).
3. `node supabase/tests/api/api.test.mjs` — harus berakhir "SEMUA PASS". Jalankan pada database baru (tes tidak idempoten).
