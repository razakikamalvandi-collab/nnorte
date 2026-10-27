-- Allow authenticated branch cashiers to create takeaway orders using server prices.
create or replace function public.staff_create_takeaway_order(
  p_branch uuid,
  p_customer text,
  p_phone text,
  p_items jsonb
)
returns table (order_id uuid, order_number text, total_amount numeric)
language plpgsql security definer set search_path = '' as $$
declare
  branch_rec public.branches%rowtype;
  restaurant_rec public.restaurants%rowtype;
  new_id uuid := gen_random_uuid();
  code text;
  item jsonb;
  addon_req jsonb;
  addon_rec jsonb;
  menu_rec record;
  qty integer;
  item_row uuid;
  addon_total numeric(14,2);
  subtotal_v numeric(14,2) := 0;
  tax_v numeric(14,2);
  service_v numeric(14,2);
begin
  if not exists (
    select 1 from public.memberships m
     where m.user_id = (select auth.uid()) and m.branch_id = p_branch
       and m.role = 'cashier' and m.status = 'active'
  ) then
    raise exception 'Hanya kasir aktif cabang ini yang dapat membuat pesanan.';
  end if;
  if p_customer is null or char_length(btrim(p_customer)) < 1 or char_length(p_customer) > 80 then
    raise exception 'Nama pelanggan wajib diisi (maksimal 80 karakter).';
  end if;
  if p_phone is not null and char_length(p_phone) > 30 then raise exception 'Nomor telepon terlalu panjang.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pesanan harus memiliki minimal satu menu.';
  end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Pesanan terlalu besar.'; end if;

  select * into branch_rec from public.branches b where b.id = p_branch and b.status = 'active';
  if not found then raise exception 'Cabang tidak aktif atau tidak ditemukan.'; end if;
  select * into restaurant_rec from public.restaurants r where r.id = branch_rec.restaurant_id;
  code := branch_rec.code || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
          || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    id, restaurant_id, branch_id, table_id, order_number, order_type, customer_name, customer_phone,
    subtotal, tax_amount, service_charge_amount, total_amount, created_by
  ) values (
    new_id, branch_rec.restaurant_id, p_branch, null, code, 'takeaway', btrim(p_customer), nullif(btrim(coalesce(p_phone, '')), ''),
    0, 0, 0, 0, (select auth.uid())
  );

  for item in select value from jsonb_array_elements(p_items) loop
    qty := (item ->> 'quantity')::integer;
    if qty is null or qty < 1 or qty > 50 then raise exception 'Jumlah menu tidak valid.'; end if;
    select mi.id as mid, mi.name as mname, mi.variants as mvariants, bmi.price as mprice, bmi.addons as maddons
      into menu_rec
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
     where bmi.branch_id = p_branch and bmi.menu_item_id = (item ->> 'menu_item_id')::uuid
       and bmi.is_available and not bmi.is_sold_out_today and mi.status = 'active';
    if not found then raise exception 'Salah satu menu tidak tersedia di cabang ini.'; end if;
    if nullif(item ->> 'variant_choice', '') is not null and not exists (
      select 1 from jsonb_array_elements(menu_rec.mvariants) v
       cross join lateral jsonb_array_elements_text(v -> 'options') opt
       where opt = item ->> 'variant_choice'
    ) then raise exception 'Pilihan varian menu tidak valid.'; end if;

    insert into public.order_items (
      restaurant_id, branch_id, order_id, menu_item_id, menu_name_snapshot, unit_price, quantity, variant_choice, notes
    ) values (
      branch_rec.restaurant_id, p_branch, new_id, menu_rec.mid, menu_rec.mname, menu_rec.mprice, qty,
      nullif(left(coalesce(item ->> 'variant_choice', ''), 60), ''), nullif(left(coalesce(item ->> 'notes', ''), 200), '')
    ) returning id into item_row;

    addon_total := 0;
    for addon_req in select value from jsonb_array_elements(coalesce(item -> 'addons', '[]'::jsonb)) loop
      select c.value into addon_rec from jsonb_array_elements(menu_rec.maddons) c(value)
       where c.value ->> 'id' = addon_req ->> 'id';
      if addon_rec is null then raise exception 'Tambahan menu tidak valid.'; end if;
      insert into public.order_item_addons (order_item_id, addon_name_snapshot, unit_price)
      values (item_row, addon_rec ->> 'name', (addon_rec ->> 'price')::numeric);
      addon_total := addon_total + (addon_rec ->> 'price')::numeric;
      addon_rec := null;
    end loop;
    subtotal_v := subtotal_v + (menu_rec.mprice + addon_total) * qty;
  end loop;

  tax_v := round(subtotal_v * restaurant_rec.tax_percentage / 100, 2);
  service_v := round(subtotal_v * restaurant_rec.service_charge_percentage / 100, 2);
  update public.orders o set subtotal = subtotal_v, tax_amount = tax_v,
    service_charge_amount = service_v, total_amount = subtotal_v + tax_v + service_v
   where o.id = new_id;

  return query select new_id, code, subtotal_v + tax_v + service_v;
end;
$$;

revoke all on function public.staff_create_takeaway_order(uuid, text, text, jsonb) from public, anon;
grant execute on function public.staff_create_takeaway_order(uuid, text, text, jsonb) to authenticated;
