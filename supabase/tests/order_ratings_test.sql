-- Tes migrasi 202610260002_order_ratings.
-- Jalankan setelah semua migrasi (dan 00_local_stub.sql untuk PostgreSQL lokal):
--   psql -d nn -v ON_ERROR_STOP=1 -f supabase/tests/order_ratings_test.sql
-- Semua fixture dibuat di dalam transaksi dan di-rollback.
begin;

-- ============================================================================
-- Fixture
-- ============================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'rating.a@test.local', '{"full_name":"Pelanggan A"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'rating.b@test.local', '{"full_name":"Pelanggan B"}'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'rating.staff@test.local', '{"full_name":"Staf"}');

insert into public.profiles (id, full_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Pelanggan A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Pelanggan B'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'Staf')
on conflict (id) do nothing;

insert into public.restaurants (id, name, slug, tagline) values
  ('11111111-1111-1111-1111-111111111111', 'Restoran Rating Test', 'rating-test-20261026', '');

insert into public.branches (id, restaurant_id, code, name, address, city, phone, email, is_24_hours) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'RAT-01', 'Cabang Rating Test', 'Jl. Tes No. 1', 'Jakarta', '021000000', 'rating@test.local', true);

insert into public.menu_items (id, restaurant_id, sku, name, category, base_price) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'RAT-KOPI', 'Kopi Rating', 'Kopi', 18000),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'RAT-TEH', 'Teh Rating', 'Teh', 12000);

insert into public.memberships (restaurant_id, user_id, branch_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccccc3',
   '22222222-2222-2222-2222-222222222222', 'cashier');

-- Pesanan pelanggan A: completed, pending, cancelled, dan owned (tanpa token).
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);
insert into public.orders
  (id, restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, total_amount, status, payment_status, tracking_token)
values
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-001', 'takeaway', 'Pelanggan A', 30000, 30000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666661'),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-002', 'takeaway', 'Pelanggan A', 18000, 18000,
   'pending', 'unpaid', '66666666-6666-6666-6666-666666666662'),
  ('44444444-4444-4444-4444-444444444445', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-003', 'takeaway', 'Pelanggan A', 18000, 18000,
   'cancelled', 'paid', '66666666-6666-6666-6666-666666666665'),
  ('44444444-4444-4444-4444-444444444447', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-004', 'takeaway', 'Pelanggan A', 18000, 18000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666668');

-- Pesanan pelanggan B.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', true);
insert into public.orders
  (id, restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, total_amount, status, payment_status, tracking_token)
values
  ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-005', 'takeaway', 'Pelanggan B', 12000, 12000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666663');

-- Pesanan tamu (tanpa akun).
select set_config('request.jwt.claim.sub', '', true);
insert into public.orders
  (id, restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, total_amount, status, payment_status, tracking_token)
values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-006', 'takeaway', 'Tamu', 12000, 12000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666664');

-- Pesanan staf: created_by terisi -> customer_id tidak boleh diisi trigger.
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', true);
insert into public.orders
  (id, restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, total_amount, status, payment_status, tracking_token, created_by)
values
  ('44444444-4444-4444-4444-444444444446', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-007', 'takeaway', 'Pelanggan Staf', 18000, 18000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666666', 'cccccccc-cccc-cccc-cccc-ccccccccccc3');

-- Pesanan staf tanpa created_by: guard membership harus mencegah customer_id.
insert into public.orders
  (id, restaurant_id, branch_id, order_number, order_type, customer_name, subtotal, total_amount, status, payment_status, tracking_token)
values
  ('44444444-4444-4444-4444-444444444449', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'RAT-008', 'takeaway', 'Pelanggan Staf 2', 18000, 18000,
   'completed', 'paid', '66666666-6666-6666-6666-666666666669');

-- Item pesanan.
insert into public.order_items
  (id, restaurant_id, branch_id, order_id, menu_item_id, menu_name_snapshot, unit_price, quantity, variant_choice, notes)
values
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444441',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, 'Iced', 'Tanpa gula'),
  ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444441',
   '33333333-3333-3333-3333-333333333332', 'Teh Rating', 12000, 1, null, null),
  ('55555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444442',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, null, null),
  ('55555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444443',
   '33333333-3333-3333-3333-333333333332', 'Teh Rating', 12000, 1, null, null),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444',
   '33333333-3333-3333-3333-333333333332', 'Teh Rating', 12000, 1, null, null),
  ('55555555-5555-5555-5555-555555555556', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444445',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, null, null),
  ('55555555-5555-5555-5555-555555555557', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444446',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, null, null),
  ('55555555-5555-5555-5555-555555555558', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444447',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, null, null),
  ('55555555-5555-5555-5555-555555555559', '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444449',
   '33333333-3333-3333-3333-333333333331', 'Kopi Rating', 18000, 1, null, null);

select set_config('request.jwt.claim.sub', '', true);

-- ============================================================================
-- Trigger customer_id
-- ============================================================================
do $$
begin
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444441')
    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'customer_id pesanan A tidak terisi';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444442')
    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'customer_id pesanan pending tidak terisi';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444443')
    = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid, 'customer_id pesanan B salah';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444444') is null,
    'pesanan tamu tidak boleh punya customer_id';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444446') is null,
    'pesanan staf tidak boleh dianggap pesanan pelanggan';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444449') is null,
    'guard membership staf gagal';
  assert (select customer_id from public.orders where id = '44444444-4444-4444-4444-444444444447')
    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'customer_id pesanan owned tidak terisi';
end $$;

-- ============================================================================
-- Status pesanan: item ID, menu ID, catatan, dan varian ikut dikembalikan
-- ============================================================================
do $$
declare
  v_items jsonb;
  v_item jsonb;
begin
  select items into v_items
    from public.portal_get_order_status(
      '44444444-4444-4444-4444-444444444441'::uuid,
      '66666666-6666-6666-6666-666666666661'::uuid
    );
  assert v_items is not null, 'items status null';
  select value into v_item
    from jsonb_array_elements(v_items)
   where value ->> 'order_item_id' = '55555555-5555-5555-5555-555555555551';
  assert v_item is not null, 'order_item_id tidak ada di respons status';
  assert v_item ->> 'menu_item_id' = '33333333-3333-3333-3333-333333333331', 'menu_item_id tidak ada';
  assert v_item ->> 'notes' = 'Tanpa gula', 'notes tidak ada';
  assert v_item ->> 'variant_choice' = 'Iced', 'variant_choice tidak ada';
  assert (select count(*) from public.portal_get_order_status(
    '44444444-4444-4444-4444-444444444441'::uuid,
    '66666666-6666-6666-6666-666666666667'::uuid)) = 0, 'token salah mengembalikan status';
end $$;

-- ============================================================================
-- Sebelum rating
-- ============================================================================
do $$
declare v jsonb;
begin
  v := public.portal_get_order_ratings(
    '44444444-4444-4444-4444-444444444441'::uuid,
    '66666666-6666-6666-6666-666666666661'::uuid
  );
  assert v ->> 'orderRating' is null, 'rating keseluruhan awal harus kosong';
  assert jsonb_array_length(v -> 'items') = 0, 'rating item awal harus kosong';
end $$;

-- ============================================================================
-- Rating valid sebagai pelanggan A (token + auth.uid)
-- ============================================================================
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);

do $$
declare r jsonb;
begin
  r := public.portal_submit_order_rating(
    '44444444-4444-4444-4444-444444444441'::uuid,
    '66666666-6666-6666-6666-666666666661'::uuid,
    5::smallint,
    'Enak sekali',
    jsonb_build_array(
      jsonb_build_object('orderItemId', '55555555-5555-5555-5555-555555555551', 'rating', 4),
      jsonb_build_object('orderItemId', '55555555-5555-5555-5555-555555555552', 'rating', 5)
    )
  );
  assert (r ->> 'saved')::int = 3, 'jumlah rating tersimpan salah';
end $$;

do $$
declare v jsonb;
begin
  v := public.portal_get_order_ratings(
    '44444444-4444-4444-4444-444444444441'::uuid,
    '66666666-6666-6666-6666-666666666661'::uuid
  );
  assert (v ->> 'orderRating')::int = 5, 'rating keseluruhan tidak tersimpan';
  assert v ->> 'orderReview' = 'Enak sekali', 'ulasan tidak tersimpan';
  assert jsonb_array_length(v -> 'items') = 2, 'jumlah rating item salah';
  assert (select count(*) from jsonb_array_elements(v -> 'items')
    where value ->> 'orderItemId' = '55555555-5555-5555-5555-555555555551'
      and (value ->> 'rating')::int = 4) = 1, 'rating item 1 salah';
  assert (select count(*) from public.order_ratings
    where order_id = '44444444-4444-4444-4444-444444444441') = 3, 'baris rating tidak lengkap';
  assert (select customer_id from public.order_ratings
    where order_id = '44444444-4444-4444-4444-444444444441' and order_item_id is null)
    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid, 'customer_id rating bukan auth.uid()';
end $$;

-- ============================================================================
-- Duplikat, status belum selesai, token salah, dan bintang tidak valid
-- ============================================================================
do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444441'::uuid,
      '66666666-6666-6666-6666-666666666661'::uuid,
      4::smallint, null, '[]'::jsonb
    );
    raise exception 'RATING_KESELURUHAN_GANDA_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'RATING_KESELURUHAN_GANDA_DITERIMA' then raise; end if;
    assert sqlerrm like '%sudah dikirim%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444441'::uuid,
      '66666666-6666-6666-6666-666666666661'::uuid,
      null,
      null,
      jsonb_build_array(jsonb_build_object(
        'orderItemId', '55555555-5555-5555-5555-555555555551', 'rating', 5
      ))
    );
    raise exception 'RATING_ITEM_GANDA_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'RATING_ITEM_GANDA_DITERIMA' then raise; end if;
    assert sqlerrm like '%sudah pernah dinilai%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444442'::uuid,
      '66666666-6666-6666-6666-666666666662'::uuid,
      5::smallint, null, '[]'::jsonb
    );
    raise exception 'RATING_PESANAN_BELUM_SELESAI_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'RATING_PESANAN_BELUM_SELESAI_DITERIMA' then raise; end if;
    assert sqlerrm like '%setelah pesanan selesai%', sqlerrm;
  end;
end $$;

-- Token salah diuji sebagai tamu (tanpa auth.uid) agar kepemilikan hanya
-- bergantung pada tracking_token, bukan pada akun pemilik pesanan.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444441'::uuid,
      '66666666-6666-6666-6666-666666666667'::uuid,
      5::smallint, null, '[]'::jsonb
    );
    raise exception 'TOKEN_SALAH_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'TOKEN_SALAH_DITERIMA' then raise; end if;
    assert sqlerrm like '%bukan milik Anda%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444444'::uuid,
      '66666666-6666-6666-6666-666666666664'::uuid,
      6::smallint, null, '[]'::jsonb
    );
    raise exception 'BINTANG_DI_LUAR_RENTANG_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'BINTANG_DI_LUAR_RENTANG_DITERIMA' then raise; end if;
    assert sqlerrm like '%1 dan 5%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444444'::uuid,
      '66666666-6666-6666-6666-666666666664'::uuid,
      null, repeat('a', 1001), '[]'::jsonb
    );
    raise exception 'ULASAN_TERLALU_PANJANG_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'ULASAN_TERLALU_PANJANG_DITERIMA' then raise; end if;
    assert sqlerrm like '%maksimal 1000%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444444'::uuid,
      '66666666-6666-6666-6666-666666666664'::uuid,
      null, 'Ulasan tanpa bintang', '[]'::jsonb
    );
    raise exception 'ULASAN_TANPA_RATING_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'ULASAN_TANPA_RATING_DITERIMA' then raise; end if;
    assert sqlerrm like '%keseluruhan%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444444'::uuid,
      '66666666-6666-6666-6666-666666666664'::uuid,
      null,
      null,
      jsonb_build_array(jsonb_build_object(
        'orderItemId', '55555555-5555-5555-5555-555555555551', 'rating', 5
      ))
    );
    raise exception 'ITEM_PESANAN_LAIN_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'ITEM_PESANAN_LAIN_DITERIMA' then raise; end if;
    assert sqlerrm like '%tidak termasuk%', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444444'::uuid,
      '66666666-6666-6666-6666-666666666664'::uuid,
      null,
      null,
      jsonb_build_array(
        jsonb_build_object('orderItemId', '55555555-5555-5555-5555-555555555555', 'rating', 4),
        jsonb_build_object('orderItemId', '55555555-5555-5555-5555-555555555555', 'rating', 5)
      )
    );
    raise exception 'ITEM_GANDA_DALAM_PAYLOAD_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'ITEM_GANDA_DALAM_PAYLOAD_DITERIMA' then raise; end if;
    assert sqlerrm like '%duplikat%', sqlerrm;
  end;
end $$;

-- ============================================================================
-- Pelanggan B tidak boleh menilai pesanan A
-- ============================================================================
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', true);
do $$
begin
  begin
    perform public.portal_submit_order_rating(
      '44444444-4444-4444-4444-444444444441'::uuid,
      null::uuid,
      1::smallint, null, '[]'::jsonb
    );
    raise exception 'PESANAN_PELANGGAN_LAIN_DITERIMA';
  exception when raise_exception then
    if sqlerrm = 'PESANAN_PELANGGAN_LAIN_DITERIMA' then raise; end if;
    assert sqlerrm like '%bukan milik Anda%',
      'B: ' || sqlerrm
      || ' | uid=' || coalesce((select auth.uid())::text, 'null')
      || ' | owner=' || coalesce((select customer_id::text from public.orders
        where id = '44444444-4444-4444-4444-444444444441'), 'null')
      || ' | owned=' || coalesce(public.portal_order_is_owned(
        '44444444-4444-4444-4444-444444444441'::uuid, null::uuid)::text, 'null');
  end;
end $$;

-- ============================================================================
-- Pelanggan A boleh menilai pesanannya tanpa token (auth.uid)
-- ============================================================================
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);
do $$
declare r jsonb;
begin
  r := public.portal_submit_order_rating(
    '44444444-4444-4444-4444-444444444447'::uuid,
    null::uuid,
    5::smallint, null, '[]'::jsonb
  );
  assert (r ->> 'saved')::int = 1, 'rating via auth.uid gagal';
end $$;

-- ============================================================================
-- Tamu boleh menilai dengan token; customer_id tetap NULL
-- ============================================================================
select set_config('request.jwt.claim.sub', '', true);
do $$
declare r jsonb;
begin
  r := public.portal_submit_order_rating(
    '44444444-4444-4444-4444-444444444444'::uuid,
    '66666666-6666-6666-6666-666666666664'::uuid,
    5::smallint,
    'Mantap',
    jsonb_build_array(jsonb_build_object(
      'orderItemId', '55555555-5555-5555-5555-555555555555', 'rating', 4
    ))
  );
  assert (r ->> 'saved')::int = 2, 'rating tamu gagal';
  assert (select customer_id from public.order_ratings
    where order_id = '44444444-4444-4444-4444-444444444444' and order_item_id is null) is null,
    'rating tamu tidak boleh punya customer_id';
end $$;

-- ============================================================================
-- RLS: A melihat rating miliknya, B tidak
-- ============================================================================
do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);
  select count(*) into n from public.order_ratings
   where order_id = '44444444-4444-4444-4444-444444444441';
  assert n = 3, 'A harus melihat 3 rating, dapat ' || n;
  reset role;
end $$;

do $$
declare n int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', true);
  select count(*) into n from public.order_ratings
   where order_id = '44444444-4444-4444-4444-444444444441';
  assert n = 0, 'B tidak boleh melihat rating A, dapat ' || n;
  reset role;
end $$;

-- ============================================================================
-- RPC dapat dipanggil role anon (tamu) dan authenticated (pelanggan)
-- ============================================================================
do $$
declare v jsonb;
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  v := public.portal_get_order_ratings(
    '44444444-4444-4444-4444-444444444444'::uuid,
    '66666666-6666-6666-6666-666666666664'::uuid
  );
  assert (v ->> 'orderRating')::int = 5, 'RPC anon gagal membaca rating tamu';
  reset role;
end $$;

do $$
declare v jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);
  v := public.portal_get_order_ratings(
    '44444444-4444-4444-4444-444444444441'::uuid,
    '66666666-6666-6666-6666-666666666661'::uuid
  );
  assert (v ->> 'orderRating')::int = 5, 'RPC authenticated gagal membaca rating';
  reset role;
end $$;

-- ============================================================================
-- Direct insert/update ditolak; unique + FK komposit tetap bekerja
-- ============================================================================
do $$
declare denied boolean := false;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', true);
    insert into public.order_ratings (order_id, order_item_id, customer_id, rating)
    values (
      '44444444-4444-4444-4444-444444444445'::uuid,
      '55555555-5555-5555-5555-555555555556'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
      5
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  reset role;
  assert denied, 'insert langsung ke order_ratings harus ditolak';
end $$;

do $$
begin
  begin
    insert into public.order_ratings (order_id, order_item_id, customer_id, rating)
    values (
      '44444444-4444-4444-4444-444444444441'::uuid,
      null,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
      4
    );
    raise exception 'UNIQUE_OVERALL_TIDAK_BEKERJA';
  exception when unique_violation then
    null;
  end;
end $$;

do $$
begin
  begin
    insert into public.order_ratings (order_id, order_item_id, customer_id, rating)
    values (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '55555555-5555-5555-5555-555555555551'::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
      5
    );
    raise exception 'FK_KOMPOSIT_TIDAK_BEKERJA';
  exception when foreign_key_violation then
    null;
  end;
end $$;

reset role;
rollback;
