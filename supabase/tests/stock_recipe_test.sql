-- Tes migrasi 202610260003_stock_recipe.
-- Jalankan setelah migrasi diterapkan:
--   npx supabase db query --linked --file supabase/tests/stock_recipe_test.sql
-- Semua fixture dibuat dalam transaksi dan di-rollback.
begin;

-- ============================================================================
-- Fixture
-- ============================================================================
insert into public.restaurants (id, name, slug, tagline, allow_online_takeaway)
values (
  'a0000000-0000-0000-0000-000000000001',
  'Restoran Stok Test',
  'stok-test-20261026',
  '',
  true
);

insert into public.branches (id, restaurant_id, code, name, address, city, phone, email, is_24_hours)
values (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'STK-01',
  'Cabang Stok Test',
  'Jl. Stok Test No. 1',
  'Jakarta',
  '021000000',
  'stok@test.local',
  true
);

insert into public.menu_items (id, restaurant_id, sku, name, category, base_price)
values (
  'c0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000001',
  'STK-TEST',
  'Nasi Stok Test',
  'Makanan',
  25000
);

insert into public.branch_menu_items (restaurant_id, branch_id, menu_item_id, price)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  25000
);

insert into public.inventory_items
  (restaurant_id, branch_id, name, category, current_stock, unit, min_threshold, cost_per_unit)
values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   'Kentang', 'Bahan Baku', 10, 'kg', 1, 15000),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   'Ayam', 'Bahan Baku', 5, 'pcs', 1, 20000);

insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   'Kentang', 0.2, 'kg'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
   'Ayam', 1, 'pcs');

select set_config('request.jwt.claim.sub', '', true);

-- ============================================================================
-- Pesanan 2 porsi: 0,2 kg x 2 = 0,4 kg; 1 pcs x 2 = 2 pcs
-- ============================================================================
do $$
declare
  v_order uuid;
begin
  select order_id into v_order
    from public.portal_create_order(
      'b0000000-0000-0000-0000-000000000002'::uuid,
      null::text,
      'takeaway'::public.order_type,
      'Tes Stok',
      null::text,
      '[{"menu_item_id":"c0000000-0000-0000-0000-000000000003","quantity":2}]'::jsonb
    );

  assert v_order is not null, 'order tidak dibuat';
  perform set_config('test.stock_order', v_order::text, true);

  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang') = 9.6,
    'stok Kentang harus 9,6 kg';
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Ayam') = 3,
    'stok Ayam harus 3 pcs';
  assert (select count(*) from public.order_ingredient_usage where order_id = v_order) = 2,
    'ledger harus berisi 2 baris';
end $$;

-- ============================================================================
-- Pembatalan mengembalikan stok tepat satu kali
-- ============================================================================
update public.orders set status = 'cancelled' where id = current_setting('test.stock_order')::uuid;

do $$
declare
  v_order uuid := current_setting('test.stock_order')::uuid;
begin
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang') = 10,
    'pembatalan harus mengembalikan Kentang ke 10 kg';
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Ayam') = 5,
    'pembatalan harus mengembalikan Ayam ke 5 pcs';
  assert (select count(*) from public.order_ingredient_usage
    where order_id = v_order and restored_at is not null) = 2,
    'semua ledger harus ditandai restored';
end $$;

-- Update kedua tidak boleh menambah stok lagi.
update public.orders set status = 'cancelled' where id = current_setting('test.stock_order')::uuid;

do $$
begin
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang') = 10,
    'pembatalan kedua tidak boleh mengembalikan stok lagi';
end $$;

-- ============================================================================
-- Stok kurang: pesanan ditolak dan tidak meninggalkan order
-- ============================================================================
update public.inventory_items
   set current_stock = 0.1
 where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang';

do $$
begin
  begin
    perform public.portal_create_order(
      'b0000000-0000-0000-0000-000000000002'::uuid,
      null::text,
      'takeaway'::public.order_type,
      'Tes Kurang',
      null::text,
      '[{"menu_item_id":"c0000000-0000-0000-0000-000000000003","quantity":1}]'::jsonb
    );
    raise exception 'STOK_KURANG_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'STOK_KURANG_DITERIMA' then raise; end if;
    assert sqlerrm like '%Stok bahan Kentang%', sqlerrm;
  end;

  assert (select count(*) from public.orders where customer_name = 'Tes Kurang') = 0,
    'order stok kurang tidak boleh tersimpan';
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang') = 0.1,
    'stok tidak boleh berubah saat order gagal';
end $$;

-- ============================================================================
-- Satuan tidak cocok: pesanan ditolak
-- ============================================================================
update public.inventory_items
   set current_stock = 10, unit = 'gram'
 where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang';

do $$
begin
  begin
    perform public.portal_create_order(
      'b0000000-0000-0000-0000-000000000002'::uuid,
      null::text,
      'takeaway'::public.order_type,
      'Tes Satuan',
      null::text,
      '[{"menu_item_id":"c0000000-0000-0000-0000-000000000003","quantity":1}]'::jsonb
    );
    raise exception 'SATUAN_TIDAK_COCOK_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'SATUAN_TIDAK_COCOK_DITERIMA' then raise; end if;
    assert sqlerrm like '%Satuan bahan Kentang%', sqlerrm;
  end;

  assert (select count(*) from public.orders where customer_name = 'Tes Satuan') = 0,
    'order satuan salah tidak boleh tersimpan';
end $$;

update public.inventory_items
   set unit = 'kg'
 where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang';

-- ============================================================================
-- Bahan tanpa inventory dilewati, bukan membuat order gagal
-- ============================================================================
insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
values (
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  'Garam', 0.01, 'kg'
);

do $$
declare
  v_order uuid;
begin
  select order_id into v_order
    from public.portal_create_order(
      'b0000000-0000-0000-0000-000000000002'::uuid,
      null::text,
      'takeaway'::public.order_type,
      'Tes Tanpa Inventory',
      null::text,
      '[{"menu_item_id":"c0000000-0000-0000-0000-000000000003","quantity":1}]'::jsonb
    );

  assert v_order is not null, 'order dengan bahan tanpa inventory harus dibuat';
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Kentang') = 9.8,
    'Kentang harus berkurang 0,2 kg';
  assert (select current_stock from public.inventory_items
    where branch_id = 'b0000000-0000-0000-0000-000000000002' and name = 'Ayam') = 4,
    'Ayam harus berkurang 1 pcs';
  assert (select count(*) from public.order_ingredient_usage where order_id = v_order) = 2,
    'Garam tanpa inventory tidak boleh membuat ledger';
end $$;

rollback;
