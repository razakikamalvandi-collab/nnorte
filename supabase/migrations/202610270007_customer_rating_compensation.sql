begin;

alter table public.orders
  add column if not exists discount_amount numeric(14,2) not null default 0
  check (discount_amount >= 0);

create table public.customer_compensation_vouchers (
  code text primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  source_order_id uuid not null unique references public.orders(id) on delete cascade,
  discount_percent smallint not null default 10 check (discount_percent between 1 and 100),
  max_discount numeric(14,2) not null default 25000 check (max_discount > 0),
  expires_at timestamptz not null,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customer_compensation_vouchers enable row level security;
revoke all on public.customer_compensation_vouchers from public, anon, authenticated;

create or replace function public.portal_issue_rating_compensation(p_order uuid, p_token uuid)
returns table (code text, discount_percent smallint, max_discount numeric, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  order_rec public.orders%rowtype;
  voucher_rec public.customer_compensation_vouchers%rowtype;
  low_rating boolean;
  attempt integer := 0;
  new_code text;
begin
  select * into order_rec from public.orders o where o.id = p_order;
  if not found or not public.portal_order_is_owned(p_order, p_token) then
    raise exception 'Pesanan ini bukan milik Anda.';
  end if;
  if order_rec.status <> 'completed' then raise exception 'Kompensasi hanya tersedia setelah pesanan selesai.'; end if;
  perform 1 from public.orders o where o.id = p_order for update;
  select exists (select 1 from public.order_ratings r where r.order_id = p_order and r.order_item_id is null and r.rating <= 2)
    into low_rating;
  if not low_rating then return; end if;

  select * into voucher_rec from public.customer_compensation_vouchers v where v.source_order_id = p_order;
  if not found then
    loop
      attempt := attempt + 1;
      new_code := 'SORRY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      insert into public.customer_compensation_vouchers (code, restaurant_id, branch_id, source_order_id, expires_at)
      values (new_code, order_rec.restaurant_id, order_rec.branch_id, p_order, now() + interval '90 days')
      on conflict (code) do nothing;
      exit when found;
      if attempt >= 5 then raise exception 'Kode kompensasi gagal dibuat. Coba lagi.'; end if;
    end loop;
    select * into voucher_rec from public.customer_compensation_vouchers v where v.source_order_id = p_order;
  end if;
  return query select voucher_rec.code, voucher_rec.discount_percent, voucher_rec.max_discount, voucher_rec.expires_at;
end;
$$;

create or replace function public.portal_get_rating_compensation(p_order uuid, p_token uuid)
returns table (code text, discount_percent smallint, max_discount numeric, expires_at timestamptz, redeemed boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.portal_order_is_owned(p_order, p_token) then raise exception 'Pesanan ini bukan milik Anda.'; end if;
  return query
    select v.code, v.discount_percent, v.max_discount, v.expires_at, v.redeemed_at is not null
      from public.customer_compensation_vouchers v where v.source_order_id = p_order;
end;
$$;

create or replace function public.portal_check_compensation_voucher(p_branch uuid, p_code text)
returns table (discount_percent smallint, max_discount numeric, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    select v.discount_percent, v.max_discount, v.expires_at
      from public.customer_compensation_vouchers v
      join public.branches b on b.id = v.branch_id and b.status = 'active'
     where v.branch_id = p_branch and upper(v.code) = upper(btrim(coalesce(p_code, '')))
       and v.redeemed_at is null and v.expires_at > now();
  if not found then raise exception 'Kode kompensasi tidak valid, sudah digunakan, atau kedaluwarsa.'; end if;
end;
$$;

create or replace function public.portal_create_order_with_voucher(
  p_branch uuid,
  p_qr_token text,
  p_order_type public.order_type,
  p_customer text,
  p_phone text,
  p_items jsonb,
  p_voucher text default null
)
returns table (order_id uuid, order_number text, tracking_token uuid, total_amount numeric, discount_amount numeric)
language plpgsql security definer set search_path = '' as $$
declare
  created_row record;
  voucher_rec public.customer_compensation_vouchers%rowtype;
  discount_v numeric(14,2) := 0;
  discounted_subtotal numeric(14,2);
  tax_v numeric(14,2);
  service_v numeric(14,2);
  restaurant_rec public.restaurants%rowtype;
  order_rec public.orders%rowtype;
begin
  if nullif(btrim(coalesce(p_voucher, '')), '') is not null then
    select * into voucher_rec from public.customer_compensation_vouchers v
     where upper(v.code) = upper(btrim(p_voucher)) for update;
    if not found or voucher_rec.branch_id <> p_branch or voucher_rec.redeemed_at is not null or voucher_rec.expires_at <= now() then
      raise exception 'Kode kompensasi tidak valid untuk cabang ini, sudah digunakan, atau kedaluwarsa.';
    end if;
  end if;

  select * into created_row from public.portal_create_order(p_branch, p_qr_token, p_order_type, p_customer, p_phone, p_items);
  if not found then raise exception 'Pesanan tidak dapat dibuat.'; end if;

  if voucher_rec.code is not null then
    select * into order_rec from public.orders o where o.id = created_row.order_id for update;
    select * into restaurant_rec from public.restaurants r where r.id = order_rec.restaurant_id;
    discount_v := least(round(order_rec.subtotal * voucher_rec.discount_percent / 100, 2), voucher_rec.max_discount, order_rec.subtotal);
    discounted_subtotal := order_rec.subtotal - discount_v;
    tax_v := round(discounted_subtotal * restaurant_rec.tax_percentage / 100, 2);
    service_v := round(discounted_subtotal * restaurant_rec.service_charge_percentage / 100, 2);
    update public.orders set discount_amount = discount_v, tax_amount = tax_v,
      service_charge_amount = service_v, total_amount = discounted_subtotal + tax_v + service_v
     where id = created_row.order_id;
    update public.customer_compensation_vouchers set redeemed_order_id = created_row.order_id, redeemed_at = now()
     where code = voucher_rec.code;
  end if;

  return query select created_row.order_id, created_row.order_number, created_row.tracking_token,
    (select o.total_amount from public.orders o where o.id = created_row.order_id), discount_v;
end;
$$;

revoke all on function public.portal_issue_rating_compensation(uuid, uuid) from public;
revoke all on function public.portal_get_rating_compensation(uuid, uuid) from public;
revoke all on function public.portal_check_compensation_voucher(uuid, text) from public;
revoke all on function public.portal_create_order_with_voucher(uuid, text, public.order_type, text, text, jsonb, text) from public;
grant execute on function public.portal_issue_rating_compensation(uuid, uuid) to anon, authenticated;
grant execute on function public.portal_get_rating_compensation(uuid, uuid) to anon, authenticated;
grant execute on function public.portal_check_compensation_voucher(uuid, text) to anon, authenticated;
grant execute on function public.portal_create_order_with_voucher(uuid, text, public.order_type, text, text, jsonb, text) to anon, authenticated;

commit;
