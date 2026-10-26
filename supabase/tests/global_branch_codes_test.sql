-- Tes kode cabang global + soft delete + penomoran ulang.
-- Jalankan setelah 00_local_stub.sql dan semua migrasi:
--   psql -d nn -v ON_ERROR_STOP=1 -f supabase/tests/global_branch_codes_test.sql
\set ON_ERROR_STOP 1
begin;

-- ---------------------------------------------------------------------------
-- Fixture: restoran terpisah agar hitungan tidak terpengaruh seed.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner.global@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bukan.owner@test.local')
on conflict (id) do nothing;

insert into public.restaurants (id, name, slug)
values ('00000000-0000-0000-0000-0000000000c1', 'Restoran Uji Global', 'uji-global-codes')
on conflict (id) do nothing;

insert into public.memberships (restaurant_id, user_id, role, status)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'owner', 'active')
on conflict do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

do $$
declare
  rid constant uuid := '00000000-0000-0000-0000-0000000000c1';
  b_pdg uuid;
  b_jkt uuid;
  b_dki uuid;
  b_sby uuid;
  b_bdg uuid;
  b_mdn uuid;
  b_smg uuid;
  c text;
  s integer;
  m integer;
  v_status public.record_status;
  v_archived text;
  v_code text;
  v_sort integer;
  v_deleted boolean;
  v_order text;
  v_branch uuid;
begin
  -- 1. Tambah lintas kota: nomor global 01..05, bukan per kota.
  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Padang', 'Jl. A', 'Padang', '1', 'a@x.com', true)
    returning id, code, sort_order into b_pdg, c, s;
  assert c = 'NN-PDG-01' and s = 1, 'Padang harus 01: ' || c || '/' || s;

  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Jakarta', 'Jl. B', 'Jakarta Selatan', '1', 'b@x.com', true)
    returning id, code, sort_order into b_jkt, c, s;
  assert c = 'NN-JKT-02' and s = 2, 'Jakarta harus 02: ' || c || '/' || s;

  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji DKI', 'Jl. C', 'Daerah Khusus Ibukota Jakarta', '1', 'c@x.com', true)
    returning id, code, sort_order into b_dki, c, s;
  assert c = 'NN-DKI-03' and s = 3, 'DKI harus 03: ' || c || '/' || s;

  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Surabaya', 'Jl. D', 'Surabaya', '1', 'd@x.com', true)
    returning id, code, sort_order into b_sby, c, s;
  assert c = 'NN-SBY-04' and s = 4, 'Surabaya harus 04: ' || c || '/' || s;

  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Bandung', 'Jl. E', 'Bandung', '1', 'e@x.com', true)
    returning id, code, sort_order into b_bdg, c, s;
  assert c = 'NN-BDG-05' and s = 5, 'Bandung harus 05: ' || c || '/' || s;
  assert public.preview_branch_code('Padang') = 'NN-PDG-06',
    'preview kode berikutnya harus global 06';

  -- 2. Histori transaksi pada cabang yang akan dihapus.
  insert into public.orders (
    restaurant_id, branch_id, order_number, order_type, customer_name,
    subtotal, total_amount, status, payment_status, paid_at
  ) values (
    rid, b_dki, 'HIST-GLOBAL-001', 'takeaway', 'Pelanggan Uji',
    100000, 100000, 'completed', 'paid', now()
  );

  -- 3. Hapus nomor 03: DKI hilang, SBY 04->03, BDG 05->04.
  perform public.delete_branch(b_dki);
  select count(*)::integer, coalesce(max(sort_order), 0)
    into s, m
    from public.branches
   where restaurant_id = rid and status = 'active' and deleted_at is null;
  assert s = 4 and m = 4, 'setelah hapus 03 harus 4 cabang aktif';

  select string_agg(code, ',' order by sort_order) into c
    from public.branches
   where restaurant_id = rid and status = 'active' and deleted_at is null;
  assert c = 'NN-PDG-01,NN-JKT-02,NN-SBY-03,NN-BDG-04', 'renumber hapus 03: ' || c;

  select status, archived_code, code, sort_order, (deleted_at is not null)
    into v_status, v_archived, v_code, v_sort, v_deleted
    from public.branches where id = b_dki;
  assert v_status = 'inactive'
     and v_archived = 'NN-DKI-03'
     and v_code like 'ARSIP-%'
     and v_sort is null
     and v_deleted,
    'cabang terhapus harus soft delete + arsip kode';

  begin
    update public.branches set address = 'Jl. Diubah' where id = b_dki;
    assert false, 'cabang terhapus tidak boleh diedit langsung';
  exception when raise_exception then
    assert sqlerrm like 'Cabang yang sudah dihapus%', 'pesan cabang terhapus: ' || sqlerrm;
  end;

  -- 4. Histori pesanan tidak rusak.
  select order_number, branch_id into v_order, v_branch
    from public.orders where order_number = 'HIST-GLOBAL-001';
  assert v_order = 'HIST-GLOBAL-001' and v_branch = b_dki,
    'order historis harus tetap ada dan tetap menunjuk branch id lama';

  -- 5. Hapus nomor 01: semua setelahnya bergeser.
  perform public.delete_branch(b_pdg);
  select string_agg(code, ',' order by sort_order) into c
    from public.branches
   where restaurant_id = rid and status = 'active' and deleted_at is null;
  assert c = 'NN-JKT-01,NN-SBY-02,NN-BDG-03', 'renumber hapus 01: ' || c;

  -- 6. Tambah setelah penghapusan: nomor setelah cabang aktif terakhir.
  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Medan', 'Jl. F', 'Medan', '1', 'f@x.com', true)
    returning id, code, sort_order into b_mdn, c, s;
  assert c = 'NN-MDN-04' and s = 4, 'tambah setelah hapus harus 04: ' || c;

  -- 7. Ubah kota: hanya prefiks yang berubah, nomor urut tetap.
  update public.branches set city = 'Pekanbaru' where id = b_jkt;
  select code, sort_order into c, s from public.branches where id = b_jkt;
  assert c = 'NN-PKU-01' and s = 1, 'ubah kota harus PKU-01: ' || c || '/' || s;
  assert public.preview_branch_code_for(b_jkt, 'Bandung') = 'NN-BDG-01',
    'preview edit kota harus mempertahankan nomor 01';

  -- 8. Nonaktifkan: keluar dari urutan; aktifkan lagi: masuk di akhir.
  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'Uji Semarang', 'Jl. G', 'Semarang', '1', 'g@x.com', true)
    returning id, code, sort_order into b_smg, c, s;
  assert c = 'NN-SMG-05' and s = 5, 'Semarang harus 05: ' || c;

  perform public.set_branch_status(b_smg, 'inactive');
  select status, archived_code, code, sort_order into v_status, v_archived, v_code, v_sort
    from public.branches where id = b_smg;
  assert v_status = 'inactive'
     and v_archived = 'NN-SMG-05'
     and v_code like 'ARSIP-%'
     and v_sort is null,
    'nonaktif harus diarsipkan dan keluar dari urutan';

  select string_agg(code, ',' order by sort_order) into c
    from public.branches
   where restaurant_id = rid and status = 'active' and deleted_at is null;
  assert c = 'NN-PKU-01,NN-SBY-02,NN-BDG-03,NN-MDN-04', 'renumber setelah nonaktif: ' || c;

  perform public.set_branch_status(b_smg, 'active');
  select code, sort_order into c, s from public.branches where id = b_smg;
  assert c = 'NN-SMG-05' and s = 5, 'aktif lagi harus masuk di akhir: ' || c;

  -- 9. Kode dan status tidak boleh diubah langsung.
  begin
    update public.branches set code = 'NN-XXX-99' where id = b_smg;
    assert false, 'ubah kode langsung harus ditolak';
  exception when raise_exception then
    assert sqlerrm like 'Kode cabang tidak dapat diubah%', 'pesan kode: ' || sqlerrm;
  end;

  begin
    update public.branches set status = 'inactive' where id = b_smg;
    assert false, 'ubah status langsung harus ditolak';
  exception when raise_exception then
    assert sqlerrm like 'Status atau penghapusan cabang%', 'pesan status: ' || sqlerrm;
  end;

  -- 10. Invariant akhir: 1..N tanpa celah/duplikat.
  select count(*)::integer, coalesce(max(sort_order), 0)
    into s, m
    from public.branches
   where restaurant_id = rid and status = 'active' and deleted_at is null;
  assert s = 5 and m = 5, 'harus 5 cabang aktif bernomor 1..5';

  select count(*) into s
    from (
      select code from public.branches
       where restaurant_id = rid
       group by code having count(*) > 1
    ) d;
  assert s = 0, 'tidak boleh ada kode duplikat';

  select count(*) into s
    from public.branches b
   where b.restaurant_id = rid
     and b.status = 'active'
     and b.deleted_at is null
     and split_part(b.code, '-', 3)::integer <> b.sort_order;
  assert s = 0, 'suffix kode harus sama dengan sort_order';

  -- Simpan id untuk tes akses setelah role/auth berubah.
  perform set_config('test.branch_id', b_smg::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- 11. Hak akses: hard delete dicabut, RPC hanya untuk owner.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

do $$
declare
  rid constant uuid := '00000000-0000-0000-0000-0000000000c1';
  bid uuid;
begin
  select id into bid from public.branches where restaurant_id = rid and code = 'NN-SMG-05';
  begin
    delete from public.branches where id = bid;
    assert false, 'hard delete harus ditolak oleh privilege';
  exception when insufficient_privilege then
    null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
do $$
declare
  bid uuid;
begin
  bid := current_setting('test.branch_id')::uuid;
  begin
    perform public.delete_branch(bid);
    assert false, 'bukan owner tidak boleh menghapus cabang';
  exception when raise_exception then
    assert sqlerrm like 'Hanya pemilik%', 'pesan akses: ' || sqlerrm;
  end;

  begin
    perform public.set_branch_status(bid, 'inactive');
    assert false, 'bukan owner tidak boleh mengubah status';
  exception when raise_exception then
    assert sqlerrm like 'Hanya pemilik%', 'pesan akses status: ' || sqlerrm;
  end;
end $$;

reset role;

rollback;
\echo SEMUA TES KODE CABANG GLOBAL LULUS
