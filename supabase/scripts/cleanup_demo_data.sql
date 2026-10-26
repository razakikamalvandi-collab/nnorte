-- ============================================================================
-- Pembersihan data DEMO (manual, TIDAK dijalankan otomatis oleh migrasi).
--
-- Cara pakai:
--   1. BACKUP dulu:  npx supabase db dump --data-only -f backup_sebelum_cleanup.sql
--      (atau pakai fitur Backups di Dashboard Supabase).
--   2. Jalankan seluruh file ini di SQL Editor. Bagian PRATINJAU hanya membaca data.
--   3. Periksa hasil pratinjau. Skrip berakhir dengan ROLLBACK, jadi tidak ada yang berubah.
--   4. Jika sudah yakin, ganti baris `rollback;` paling bawah menjadi `commit;` lalu jalankan ulang.
--
-- Yang dianggap demo (dari seed 202610180002): tiga cabang dengan nama seed di
-- bawah (kode bisa berubah karena penomoran global) dan menu SKU NN-APP/STK/BGR/DES/BEV-0x.
-- Entri hanya dihapus jika TIDAK memiliki pesanan/pembayaran (data transaksi nyata tidak pernah disentuh).
-- Cabang/menu yang sudah punya transaksi dilewati dan dilaporkan.
-- ============================================================================
begin;

-- ---- PRATINJAU --------------------------------------------------------------
create temp table demo_branches on commit drop as
select b.id, b.code, b.name,
       (select count(*) from public.orders o where o.branch_id = b.id) as orders_count
  from public.branches b
 where b.name in (
   'NNORTE Senopati - Flagship Cafe',
   'NNORTE Sudirman - Central Lounge',
   'NNORTE Dharmawangsa - Wood-Fired'
 );

create temp table demo_menus on commit drop as
select m.id, m.sku, m.name,
       (select count(*) from public.order_items oi where oi.menu_item_id = m.id) as used_count
  from public.menu_items m
 where m.sku in ('NN-APP-01','NN-APP-02','NN-BEV-01','NN-BEV-02','NN-BGR-01','NN-DES-01','NN-DES-02','NN-STK-01','NN-STK-02','NN-STK-03');

select 'cabang demo' as jenis, code as kode, name as nama, orders_count as jumlah_transaksi,
       case when orders_count = 0 then 'AKAN DIHAPUS' else 'DILEWATI (punya transaksi)' end as tindakan
  from demo_branches
union all
select 'menu demo', sku, name, used_count,
       case when used_count = 0 then 'AKAN DIHAPUS' else 'DILEWATI (dipakai transaksi)' end
  from demo_menus
order by 1, 2;

-- ---- PENGHAPUSAN (hanya berlaku jika di-commit) -----------------------------
-- Data turunan (meja, stok, harga cabang, pengeluaran) ikut terhapus lewat ON DELETE CASCADE.
delete from public.branch_menu_items
 where menu_item_id in (select id from demo_menus where used_count = 0);
delete from public.menu_items
 where id in (select id from demo_menus where used_count = 0);
delete from public.branches
 where id in (select id from demo_branches where orders_count = 0);

-- Setelah cabang demo dihapus, rapatkan nomor global cabang aktif yang tersisa
-- (fungsi hanya ada setelah migrasi 202610240001).
do $$
declare r record;
begin
  if to_regprocedure('public.branch_renumber_active(uuid)') is not null then
    for r in
      select distinct restaurant_id
        from public.branches
       where status = 'active' and deleted_at is null
    loop
      perform public.branch_renumber_active(r.restaurant_id);
    end loop;
  end if;
end $$;

select 'sisa cabang' as info, count(*) from public.branches
union all select 'sisa menu', count(*) from public.menu_items;

-- Ganti menjadi `commit;` HANYA setelah pratinjau diperiksa dan backup dibuat.
rollback;
