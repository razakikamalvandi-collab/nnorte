# Stok Bahan & Resep per Porsi — Design

**Tujuan:** cabang dapat menambah bahan baku dan stok berkurang otomatis saat pesanan dibuat, memakai takaran bahan per porsi dari Master Katalog.

## Keputusan yang sudah disepakati

- Pengurangan memakai **takaran per porsi** (contoh: 0,2 kg kentang per porsi), bukan selalu 1 satuan.
- Bahan diambil dari **resep terstruktur** di Master Katalog, bukan hasil parsing deskripsi bebas.
- Stok hanya dipotong untuk bahan yang sudah memiliki baris inventory di cabang. Bahan tanpa inventory dilewati agar pesanan lama tidak langsung gagal.
- Jika bahan sudah punya inventory tetapi stoknya kurang, pesanan ditolak dan seluruh transaksi di-rollback.
- Jika satuan resep dan satuan inventory berbeda, pesanan ditolak dengan pesan yang jelas; tidak ada konversi satuan otomatis.
- Stok dikembalikan saat pesanan berstatus `cancelled`, tepat satu kali.
- Stok dipotong saat pesanan dibuat (bukan saat dibayar), karena pesanan sudah memesan bahan.

## Data model

- `public.menu_ingredients`: satu baris per bahan per menu.
  - `restaurant_id`, `menu_item_id`, `name`, `quantity numeric(14,3) > 0`, `unit`, timestamps.
  - Unik per menu dengan nama case-insensitive.
  - RLS: anggota restoran boleh membaca; owner boleh mengelola.
- `public.order_ingredient_usage`: ledger pemakaian bahan per item pesanan.
  - `order_id`, `order_item_id`, `inventory_item_id`, `ingredient_name`, `quantity`, `unit`, `restored_at`.
  - Tidak dapat ditulis langsung oleh client; hanya fungsi security definer.
- `public.inventory_items`: tambah unique index `(branch_id, lower(btrim(name)))` agar pencocokan nama tidak ambigu.
- `public.menu_items`: tambah kolom `allergens text[]`; field alergen yang sudah ada di form jadi benar-benar tersimpan.

## Alur

1. Owner mengisi **Bahan per porsi** di form Master Katalog: nama, jumlah, satuan.
2. Branch admin membuka **Stok & Bahan Baku**, menekan **Tambah Bahan**, memilih nama dari saran resep, mengisi satuan yang sama, stok awal, ambang minimum, dan harga satuan.
3. Pelanggan membuat pesanan lewat `portal_create_order`.
4. Di transaksi yang sama, `consume_order_ingredients(order_id)`:
   - membaca `order_items` + `menu_ingredients`;
   - mencari inventory cabang berdasarkan nama case-insensitive;
   - melewati bahan yang belum punya inventory;
   - menolak bila satuan tidak cocok atau stok kurang;
   - mengurangi `current_stock` sebesar `quantity_per_portion × quantity` dan menulis ledger.
5. Saat status pesanan diubah menjadi `cancelled`, trigger memanggil `restore_order_ingredients(order_id)` dan menandai baris ledger `restored_at`.

## UI

- Master Katalog: editor resep baris-per-baris (nama, qty, satuan), tambah/hapus baris, validasi duplikat dan qty > 0. Field lama "Bahan (pisahkan dengan koma)" diganti.
- Stok: tombol **Tambah Bahan**, empty state yang menjelaskan belum ada inventory, saran nama/satuan dari resep katalog, dan status `Habis`/`Menipis`/`Tersedia Aman`.
- Semua memakai token tema `nnorte-*`, bukan warna hard-coded.

## Keamanan dan batasan

- Tidak ada service-role key di frontend.
- Penulisan stok oleh order hanya lewat security definer; client tidak boleh mengirim customer ID atau jumlah stok.
- `menu_ingredients` dan ledger tidak membuka jalur tulis langsung ke pelanggan.
- Tidak mengubah harga, jumlah, pembayaran, atau status pesanan selain pemotongan/pengembalian stok.
- Fungsi order lama `create_branch_order` tidak dipakai frontend saat ini; perubahan difokuskan ke `portal_create_order` yang benar-benar dipakai. Tidak ada perubahan pada alur kasir/pembayaran.

## Non-goals

- Parsing deskripsi menu otomatis.
- Konversi satuan (kg ↔ gram) otomatis.
- Resep untuk add-on atau varian.
- Halaman stok untuk role owner; halaman tetap untuk branch admin seperti sekarang.
