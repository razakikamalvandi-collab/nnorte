-- Rating pelanggan untuk pesanan yang sudah selesai.
--
-- Satu baris dengan order_item_id NULL = rating keseluruhan pesanan.
-- Satu baris dengan order_item_id terisi = rating item pesanan.
-- Rating bersifat final: unique index mencegah pengiriman ulang.
begin;

-- ============================================================================
-- 1. Hubungkan pesanan portal dengan akun pelanggan yang membuatnya
-- ============================================================================
-- Pesanan tamu tetap memiliki customer_id NULL dan diverifikasi lewat
-- tracking_token. Pesanan staf tidak diubah karena created_by terisi.
alter table public.orders
  add column if not exists customer_id uuid references public.profiles(id) on delete set null;

create index if not exists orders_customer_created_idx
  on public.orders (customer_id, created_at desc)
  where customer_id is not null;

create or replace function public.set_order_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
begin
  actor := (select auth.uid());

  -- Hanya pesanan portal (created_by NULL) oleh akun non-staf restoran ini.
  -- Akun tanpa profil tetap boleh memesan sebagai tamu.
  if new.customer_id is null
     and new.created_by is null
     and actor is not null
     and exists (select 1 from public.profiles p where p.id = actor)
     and not exists (
       select 1 from public.memberships m
       where m.user_id = actor
         and m.restaurant_id = new.restaurant_id
         and m.status = 'active'
     )
  then
    new.customer_id := actor;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_set_customer on public.orders;
create trigger orders_set_customer before insert on public.orders
  for each row execute function public.set_order_customer();

-- ============================================================================
-- 2. Tabel rating
-- ============================================================================
-- Target foreign key komposit agar rating item wajib berasal dari pesanan
-- yang sama. Dibuat sebelum tabel yang mereferensikannya.
create unique index if not exists order_items_order_id_id_key
  on public.order_items (order_id, id);

create table public.order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid,
  customer_id uuid references public.profiles(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  review text check (
    review is null
    or (review = btrim(review) and char_length(review) between 1 and 1000)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, order_item_id)
    references public.order_items(order_id, id) on delete cascade
);

-- Satu rating keseluruhan dan satu rating per item untuk setiap pesanan.
create unique index order_ratings_overall_key
  on public.order_ratings (order_id)
  where order_item_id is null;

create unique index order_ratings_item_key
  on public.order_ratings (order_id, order_item_id)
  where order_item_id is not null;

create index order_ratings_order_created_idx
  on public.order_ratings (order_id, created_at desc);

create index order_ratings_customer_created_idx
  on public.order_ratings (customer_id, created_at desc)
  where customer_id is not null;

create trigger order_ratings_set_updated_at before update on public.order_ratings
  for each row execute function public.set_updated_at();

alter table public.order_ratings enable row level security;

-- Pelanggan hanya dapat membaca rating yang tersimpan atas namanya.
-- Rating tamu (customer_id NULL) dibaca lewat RPC dengan tracking_token.
create policy "customers read own order ratings" on public.order_ratings
  for select to authenticated
  using (customer_id = (select auth.uid()));

-- Tidak ada policy insert/update/delete: semua penulisan lewat RPC security
-- definer di bawah setelah validasi kepemilikan dan status pesanan.
revoke all on public.order_ratings from anon, authenticated;
grant select on public.order_ratings to authenticated;

-- ============================================================================
-- 3. Kepemilikan pesanan
-- ============================================================================
create or replace function public.portal_order_is_owned(p_order uuid, p_token uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.orders o
     where o.id = p_order
       and (
         (p_token is not null and o.tracking_token = p_token)
         or (o.customer_id is not null and o.customer_id = (select auth.uid()))
       )
  );
$$;

revoke all on function public.portal_order_is_owned(uuid, uuid) from public;

-- ============================================================================
-- 4. Baca rating
-- ============================================================================
create or replace function public.portal_get_order_ratings(p_order uuid, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.portal_order_is_owned(p_order, p_token) then
    raise exception 'Pesanan tidak ditemukan atau bukan milik Anda.';
  end if;

  select jsonb_build_object(
    'orderRating', (
      select r.rating
        from public.order_ratings r
       where r.order_id = p_order and r.order_item_id is null
    ),
    'orderReview', (
      select r.review
        from public.order_ratings r
       where r.order_id = p_order and r.order_item_id is null
    ),
    'items', coalesce((
      select jsonb_agg(
               jsonb_build_object('orderItemId', r.order_item_id, 'rating', r.rating)
               order by r.created_at
             )
        from public.order_ratings r
       where r.order_id = p_order and r.order_item_id is not null
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.portal_get_order_ratings(uuid, uuid) from public;
grant execute on function public.portal_get_order_ratings(uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 5. Kirim rating
-- ============================================================================
create or replace function public.portal_submit_order_rating(
  p_order uuid,
  p_token uuid,
  p_order_rating smallint default null,
  p_order_review text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  order_rec public.orders%rowtype;
  actor uuid;
  customer uuid;
  item jsonb;
  item_id uuid;
  item_rating smallint;
  review_text text;
  saved integer := 0;
  seen uuid[] := '{}';
begin
  select * into order_rec from public.orders o where o.id = p_order for update;
  if not found then
    raise exception 'Pesanan tidak ditemukan.';
  end if;

  if not public.portal_order_is_owned(p_order, p_token) then
    raise exception 'Pesanan ini bukan milik Anda.';
  end if;

  if order_rec.status <> 'completed' then
    raise exception 'Rating hanya dapat diberikan setelah pesanan selesai.';
  end if;

  if p_order_rating is not null and (p_order_rating < 1 or p_order_rating > 5) then
    raise exception 'Rating harus antara 1 dan 5 bintang.';
  end if;

  review_text := nullif(btrim(coalesce(p_order_review, '')), '');
  if review_text is not null and char_length(review_text) > 1000 then
    raise exception 'Ulasan maksimal 1000 karakter.';
  end if;
  if review_text is not null and p_order_rating is null then
    raise exception 'Pilih rating keseluruhan sebelum menulis ulasan.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Data rating item tidak valid.';
  end if;

  if p_order_rating is null and jsonb_array_length(p_items) = 0 then
    raise exception 'Pilih minimal satu rating.';
  end if;

  if p_order_rating is not null and exists (
    select 1 from public.order_ratings r
     where r.order_id = p_order and r.order_item_id is null
  ) then
    raise exception 'Rating keseluruhan untuk pesanan ini sudah dikirim.';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    begin
      item_id := (item ->> 'orderItemId')::uuid;
      item_rating := (item ->> 'rating')::smallint;
    exception when invalid_text_representation then
      raise exception 'Data rating item tidak valid.';
    end;

    if item_id is null then
      raise exception 'Item rating tidak valid.';
    end if;
    if item_rating is null or item_rating < 1 or item_rating > 5 then
      raise exception 'Rating item harus antara 1 dan 5 bintang.';
    end if;
    if item_id = any(seen) then
      raise exception 'Item rating duplikat.';
    end if;
    seen := array_append(seen, item_id);

    if not exists (
      select 1 from public.order_items oi
       where oi.id = item_id and oi.order_id = p_order
    ) then
      raise exception 'Item tidak termasuk dalam pesanan ini.';
    end if;

    if exists (
      select 1 from public.order_ratings r
       where r.order_id = p_order and r.order_item_id = item_id
    ) then
      raise exception 'Salah satu item sudah pernah dinilai.';
    end if;
  end loop;

  actor := (select auth.uid());
  select p.id into customer from public.profiles p where p.id = actor;

  begin
    if p_order_rating is not null then
      insert into public.order_ratings (order_id, order_item_id, customer_id, rating, review)
      values (p_order, null, customer, p_order_rating, review_text);
      saved := saved + 1;
    end if;

    for item in select value from jsonb_array_elements(p_items) loop
      insert into public.order_ratings (order_id, order_item_id, customer_id, rating)
      values (
        p_order,
        (item ->> 'orderItemId')::uuid,
        customer,
        (item ->> 'rating')::smallint
      );
      saved := saved + 1;
    end loop;
  exception when unique_violation then
    raise exception 'Rating untuk pesanan ini sudah pernah dikirim.';
  end;

  return jsonb_build_object('saved', saved);
end;
$$;

revoke all on function public.portal_submit_order_rating(uuid, uuid, smallint, text, jsonb) from public;
grant execute on function public.portal_submit_order_rating(uuid, uuid, smallint, text, jsonb) to anon, authenticated;

-- ============================================================================
-- 6. Perluas item pada status pesanan (kontrak return tetap sama)
-- ============================================================================
create or replace function public.portal_get_order_status(p_order uuid, p_token uuid)
returns table (
  order_number text, status public.order_status, payment_status public.payment_status,
  total_amount numeric, created_at timestamptz, items jsonb
)
language sql stable security definer set search_path = '' as $$
  select o.order_number, o.status, o.payment_status, o.total_amount, o.created_at,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object(
                      'order_item_id', oi.id,
                      'menu_item_id', oi.menu_item_id,
                      'name', oi.menu_name_snapshot,
                      'quantity', oi.quantity,
                      'unit_price', oi.unit_price,
                      'variant_choice', oi.variant_choice,
                      'notes', oi.notes
                    ) order by oi.created_at
                  )
             from public.order_items oi where oi.order_id = o.id
         ), '[]'::jsonb)
    from public.orders o
   where o.id = p_order and o.tracking_token = p_token;
$$;

revoke all on function public.portal_get_order_status(uuid, uuid) from public;
grant execute on function public.portal_get_order_status(uuid, uuid) to anon, authenticated;

commit;
