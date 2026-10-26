-- Tes perilaku migrasi 202610220001. Jalankan setelah 00_local_stub.sql + semua migrasi:
--   psql -d nn -v ON_ERROR_STOP=1 -f supabase/tests/enhancements_test.sql
-- Setiap pemeriksaan memakai `assert`; skrip berhenti pada kegagalan pertama.
\set ON_ERROR_STOP 1
begin;

-- --- fixture ---------------------------------------------------------------
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin.sen@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'kasir.sen@test.local'),
  ('cfe745f1-4902-4a06-a758-a3fd4cc6c6f8', 'owner@test.local');
insert into public.memberships (restaurant_id, user_id, branch_id, role)
select r.id, '00000000-0000-0000-0000-0000000000a1', b.id, 'branch_admin'
  from public.restaurants r join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT-01' where r.slug = 'nnorte';
insert into public.memberships (restaurant_id, user_id, branch_id, role)
select r.id, '00000000-0000-0000-0000-0000000000a2', b.id, 'cashier'
  from public.restaurants r join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT-01' where r.slug = 'nnorte';

-- Catatan: seed 202610180002 hanya benar-benar memasukkan restoran + 3 cabang di PostgreSQL
-- (CTE data-modifying tidak melihat baris yang dibuat CTE lain pada statement yang sama),
-- jadi fixture berikut dibuat eksplisit.
insert into public.memberships (restaurant_id, user_id, role)
select id, 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8', 'owner' from public.restaurants where slug = 'nnorte';
insert into public.menu_items (restaurant_id, sku, name, category, base_price)
select id, 'T-1', 'Menu Uji A', 'Beverages', 50000 from public.restaurants where slug = 'nnorte';
insert into public.branch_menu_items (restaurant_id, branch_id, menu_item_id, price)
select b.restaurant_id, b.id, mi.id, 60000 from public.branches b join public.menu_items mi on mi.restaurant_id = b.restaurant_id where b.code = 'NN-JKT-01';
insert into public.dining_tables (restaurant_id, branch_id, table_number, capacity, qr_code_token)
select restaurant_id, id, 'T01', 4, 'tok-uji-senopati' from public.branches where code = 'NN-JKT-01';

-- --- 1. kode cabang --------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8';

do $$
declare c text; rid uuid;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  assert public.preview_branch_code('Padang') = 'NN-PDG-04', 'preview Padang setelah 3 cabang aktif';
  assert public.preview_branch_code('Jakarta Selatan') = 'NN-JKT-04', 'nomor global tidak direset per kota';
  assert public.preview_branch_code('Kota Bandung') = 'NN-BDG-04', 'awalan Kota dibuang, nomor tetap global';
  assert public.preview_branch_code('Sijunjung') = 'NN-SIJ93-04', 'fallback 3 huruf + hash';

  insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
    values (rid, 'NNORTE Padang A', 'Jl. A', 'Padang', '1', 'a@x.com', '10:00', '22:00') returning code into c;
  assert c = 'NN-PDG-04', 'kode Padang A: ' || c;
  insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
    values (rid, 'NNORTE Padang B', 'Jl. B', 'padang', '1', 'b@x.com', '10:00', '22:00') returning code into c;
  assert c = 'NN-PDG-05', 'kode Padang B (huruf kecil): ' || c;
  insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
    values (rid, 'NNORTE Jakarta Baru', 'Jl. C', 'Jakarta Pusat', '1', 'c@x.com', '10:00', '22:00') returning code into c;
  assert c = 'NN-JKT-06', 'jakarta lanjut global: ' || c;

  begin
    update public.branches set code = 'NN-XXX-99' where name = 'NNORTE Padang A';
    assert false, 'seharusnya gagal mengubah kode';
  exception when raise_exception then
    assert sqlerrm like 'Kode cabang tidak dapat diubah%', 'pesan: ' || sqlerrm;
  end;
end $$;

-- --- 2. jam operasional ----------------------------------------------------
do $$
declare rid uuid; h text;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  insert into public.branches (restaurant_id, name, address, city, phone, email, is_24_hours)
    values (rid, 'NNORTE 24', 'Jl. D', 'Medan', '1', 'd@x.com', true) returning operating_hours into h;
  assert h = 'Buka 24 Jam', '24 jam: ' || h;
  insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
    values (rid, 'NNORTE Malam', 'Jl. E', 'Medan', '1', 'e@x.com', '18:00', '02:00') returning operating_hours into h;
  assert h = '18:00 - 02:00 WIB', 'lewat tengah malam: ' || h;
  begin
    insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
      values (rid, 'NNORTE Sama', 'Jl. F', 'Medan', '1', 'f@x.com', '10:00', '10:00');
    assert false, 'jam identik harus ditolak';
  exception when check_violation then null; end;
  begin
    insert into public.branches (restaurant_id, name, address, city, phone, email)
      values (rid, 'NNORTE Kosong', 'Jl. G', 'Medan', '1', 'g@x.com');
    assert false, 'tanpa jam dan bukan 24 jam harus ditolak';
  exception when check_violation then null; end;
end $$;

-- --- 3. email korporat -----------------------------------------------------
do $$
declare bid uuid; e text;
begin
  select id into bid from public.branches where code = 'NN-JKT-02';
  e := public.preview_corporate_email('branch_admin', bid);
  assert e = 'adminsudirman@nnorte.com', 'admin sudirman: ' || e;
  assert public.preview_corporate_email('cashier', bid) = 'kasirsudirman@nnorte.com', 'kasir';
  assert public.preview_corporate_email('kitchen', bid) = 'dapursudirman@nnorte.com', 'dapur';
end $$;
reset role;
insert into auth.users(email) values ('adminsudirman@nnorte.com'), ('adminsudirman2@nnorte.com');
set local role authenticated;
set local request.jwt.claim.sub = 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8';
do $$
declare bid uuid; e text;
begin
  select id into bid from public.branches where code = 'NN-JKT-02';
  e := public.preview_corporate_email('branch_admin', bid);
  assert e = 'adminsudirman3@nnorte.com', 'suffix saat bentrok: ' || e;
  begin
    perform public.preview_corporate_email('owner', bid);
    assert false, 'owner tidak boleh';
  exception when raise_exception then null; end;
end $$;

-- non-owner tidak boleh pratinjau / buat cabang
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare bid uuid;
begin
  select id into bid from public.branches where code = 'NN-JKT-01';
  begin perform public.preview_corporate_email('cashier', bid); assert false;
  exception when raise_exception then null; end;
  begin perform public.preview_branch_code('Padang'); assert false;
  exception when raise_exception then null; end;
  begin
    insert into public.branches (restaurant_id, name, address, city, phone, email, opening_time, closing_time)
      select restaurant_id, 'Hack', 'x', 'Padang', '1', 'h@x.com', '10:00', '11:00' from public.branches limit 1;
    assert false, 'admin cabang tidak boleh membuat cabang';
  exception when insufficient_privilege then null; end;
end $$;

-- --- 4. daftar anggota -----------------------------------------------------
do $$
declare n integer;
begin
  select count(*) into n from public.list_team_members();
  assert n = 2, 'admin cabang melihat anggota cabangnya saja (kasir + dirinya): ' || n;
  assert not exists (select 1 from public.list_team_members() where role = 'owner'), 'owner tidak terlihat admin cabang';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8';
do $$
declare n integer;
begin
  select count(*) into n from public.list_team_members();
  assert n = 3, 'owner melihat semua: ' || n;
  perform public.owner_set_member_status('00000000-0000-0000-0000-0000000000a2', 'inactive');
  assert (select status from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a2') = 'inactive';
  begin perform public.owner_set_member_status('cfe745f1-4902-4a06-a758-a3fd4cc6c6f8', 'inactive'); assert false;
  exception when raise_exception then null; end;
end $$;

-- --- 5. pengeluaran & RLS --------------------------------------------------
do $$
declare rid uuid; b1 uuid; b2 uuid;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  select id into b1 from public.branches where code = 'NN-JKT-01';
  select id into b2 from public.branches where code = 'NN-JKT-02';
  insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values
    (rid, b1, '2026-10-22', 'bahan_baku', 100000),
    (rid, b2, '2026-10-22', 'gaji', 50000);
  begin insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values (rid, b1, '2026-10-22', 'x', 1);
    assert false; exception when check_violation then null; end;
  begin insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values (rid, b1, '2026-10-22', 'lainnya', 0);
    assert false; exception when check_violation then null; end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare rid uuid; b1 uuid; b2 uuid;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  select id into b1 from public.branches where code = 'NN-JKT-01';
  select id into b2 from public.branches where code = 'NN-JKT-02';
  assert (select count(*) from public.expenses) = 1, 'admin cabang hanya melihat pengeluaran cabangnya';
  insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values (rid, b1, '2026-10-22', 'utilitas', 10);
  begin insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values (rid, b2, '2026-10-22', 'utilitas', 10);
    assert false, 'tidak boleh menulis cabang lain';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';  -- kasir
do $$
declare rid uuid; b1 uuid;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  select id into b1 from public.branches where code = 'NN-JKT-01';
  begin insert into public.expenses (restaurant_id, branch_id, expense_date, category, amount) values (rid, b1, '2026-10-22', 'utilitas', 10);
    assert false, 'kasir tidak boleh mencatat pengeluaran';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- --- 6. laporan: zona waktu, status, isolasi cabang ------------------------
do $$
declare rid uuid; b1 uuid; b2 uuid;
begin
  select id into rid from public.restaurants where slug = 'nnorte';
  select id into b1 from public.branches where code = 'NN-JKT-01';
  select id into b2 from public.branches where code = 'NN-JKT-02';
  -- 21 Okt 17:30 UTC = 22 Okt 00:30 WIB (harus masuk tanggal 22)
  insert into public.orders (restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, tax_amount, service_charge_amount, total_amount, status, payment_status, paid_at)
    values (rid, b1, 'T-1', 'takeaway', 'A', 100000, 10000, 5000, 115000, 'completed', 'paid', '2026-10-21 17:30:00+00');
  -- 22 Okt 16:59 UTC = 22 Okt 23:59 WIB (tanggal 22)
  insert into public.orders (restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, tax_amount, service_charge_amount, total_amount, status, payment_status, paid_at)
    values (rid, b1, 'T-2', 'takeaway', 'B', 200000, 20000, 10000, 230000, 'completed', 'paid', '2026-10-22 16:59:00+00');
  -- 22 Okt 17:00 UTC = 23 Okt 00:00 WIB (tanggal 23)
  insert into public.orders (restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, tax_amount, service_charge_amount, total_amount, status, payment_status, paid_at)
    values (rid, b1, 'T-3', 'takeaway', 'C', 100000, 10000, 5000, 115000, 'completed', 'paid', '2026-10-22 17:00:00+00');
  -- dibatalkan / belum dibayar / refund: tidak dihitung
  insert into public.orders (restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, tax_amount, service_charge_amount, total_amount, status, payment_status, paid_at)
    values (rid, b1, 'T-4', 'takeaway', 'D', 100000, 10000, 5000, 115000, 'cancelled', 'paid', '2026-10-22 05:00:00+00'),
           (rid, b1, 'T-5', 'takeaway', 'E', 100000, 10000, 5000, 115000, 'pending', 'unpaid', null),
           (rid, b1, 'T-6', 'takeaway', 'F', 100000, 10000, 5000, 115000, 'completed', 'refunded', '2026-10-22 05:00:00+00');
  -- cabang lain
  insert into public.orders (restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, tax_amount, service_charge_amount, total_amount, status, payment_status, paid_at)
    values (rid, b2, 'T-7', 'takeaway', 'G', 300000, 30000, 15000, 345000, 'completed', 'paid', '2026-10-22 05:00:00+00');
end $$;

set local role authenticated;
set local request.jwt.claim.sub = 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8';
do $$
declare r record; n integer;
begin
  -- semua cabang, 22 Okt saja
  select sum(revenue) rev, sum(tx_count) tx, sum(expense_amount) ex into r from public.report_daily(null, '2026-10-22', '2026-10-22');
  -- T-1 (115000-10000=105000) + T-2 (210000) + T-7 (315000) = 630000
  assert r.rev = 630000, 'pendapatan 22 Okt semua cabang: ' || r.rev;
  assert r.tx = 3, 'transaksi: ' || r.tx;
  assert r.ex = 150010, 'pengeluaran (100000+50000+10): ' || r.ex;
  -- cabang tunggal
  select sum(revenue) rev into r from public.report_daily((select id from public.branches where code='NN-JKT-01'), '2026-10-22', '2026-10-22');
  assert r.rev = 315000, 'cabang 1: ' || r.rev;
  -- 23 Okt hanya T-3
  select sum(revenue) rev, sum(tx_count) tx into r from public.report_daily(null, '2026-10-23', '2026-10-23');
  assert r.rev = 105000 and r.tx = 1, 'batas tengah malam WIB';
  -- rentang tidak valid
  begin perform * from public.report_daily(null, '2026-10-23', '2026-10-22'); assert false;
  exception when raise_exception then null; end;
  begin perform * from public.report_daily(null, '2020-01-01', '2026-10-22'); assert false;
  exception when raise_exception then null; end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';  -- admin cabang 1
do $$
declare r record;
begin
  select sum(revenue) rev, count(distinct branch_id) nb into r from public.report_daily(null, '2026-10-21', '2026-10-24');
  assert r.nb = 1, 'admin cabang hanya melihat satu cabang';
  assert r.rev = 105000 + 210000 + 105000, 'pendapatan hanya cabang 1: ' || r.rev;
  select sum(revenue) rev into r from public.report_daily((select id from public.branches where code='NN-JKT-02'), '2026-10-21', '2026-10-24');
  assert r.rev is null, 'cabang lain tidak bocor lewat parameter';
end $$;
reset role;

-- --- 7. portal pelanggan (anon) --------------------------------------------
set local role anon;
do $$
declare br uuid; tok text; res record; menu record; st record; before_total numeric;
begin
  assert (select count(*) from public.portal_get_branches()) >= 3, 'cabang aktif terlihat publik';
  select id into br from public.portal_get_branches() where name like '%Senopati%';
  select * into menu from public.portal_get_menu(br) limit 1;
  assert menu.menu_item_id is not null, 'menu terlihat publik';
  begin perform * from public.orders; assert false, 'anon tidak boleh baca orders';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('t.tok', t.qr_code_token, false), set_config('t.br', t.branch_id::text, false) from public.dining_tables t order by created_at limit 1;
set local role anon;
do $$
declare res record; menu record; st record;
begin
  select * into menu from public.portal_get_menu(current_setting('t.br')::uuid) where price > 0 limit 1;
  -- token tidak valid
  begin perform * from public.portal_create_order(current_setting('t.br')::uuid, 'salah', 'dine_in', 'Budi', '', jsonb_build_array(jsonb_build_object('menu_item_id', menu.menu_item_id, 'quantity', 2)));
    assert false; exception when raise_exception then assert sqlerrm like 'Kode QR%'; end;
  -- harga dari klien diabaikan; total dihitung server (10% + 5%)
  select * into res from public.portal_create_order(current_setting('t.br')::uuid, current_setting('t.tok'), 'dine_in', 'Budi', '0812',
    jsonb_build_array(jsonb_build_object('menu_item_id', menu.menu_item_id, 'quantity', 2, 'price', 1)));
  assert res.total_amount = menu.price * 2 * 1.15, 'total server: ' || res.total_amount;
  select * into st from public.portal_get_order_status(res.order_id, res.tracking_token);
  assert st.status = 'pending' and st.payment_status = 'unpaid', 'status awal';
  assert jsonb_array_length(st.items) = 1;
  select * into st from public.portal_get_order_status(res.order_id, gen_random_uuid());
  assert st.order_number is null, 'token pelacakan salah tidak membuka pesanan';
  begin perform * from public.portal_create_order(current_setting('t.br')::uuid, current_setting('t.tok'), 'dine_in', '', '', '[]'::jsonb); assert false;
  exception when raise_exception then null; end;
  begin perform * from public.portal_create_order(current_setting('t.br')::uuid, current_setting('t.tok'), 'dine_in', 'X', '', jsonb_build_array(jsonb_build_object('menu_item_id', menu.menu_item_id, 'quantity', 0))); assert false;
  exception when raise_exception then null; end;
end $$;
reset role;
-- meja jadi terisi; takeaway mengikuti pengaturan
do $$
begin
  assert (select status from public.dining_tables order by created_at limit 1) = 'occupied', 'meja terisi';
  update public.restaurants set allow_online_takeaway = false;
end $$;
set local role anon;
do $$
declare menu record; br uuid;
begin
  select id into br from public.portal_get_branches() limit 1;
  select * into menu from public.portal_get_menu(br) limit 1;
  begin perform * from public.portal_create_order(br, null, 'takeaway', 'Ani', '', jsonb_build_array(jsonb_build_object('menu_item_id', menu.menu_item_id, 'quantity', 1))); assert false;
  exception when raise_exception then assert sqlerrm like 'Pesanan takeaway online belum%', sqlerrm; end;
end $$;
reset role;

rollback;
\echo SEMUA TES LULUS
