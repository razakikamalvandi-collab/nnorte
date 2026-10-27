begin;

create or replace function public.branch_admin_update_menu(
  p_restaurant uuid,
  p_branch uuid,
  p_menu uuid,
  p_sku text,
  p_name text,
  p_category text,
  p_description text,
  p_base_price numeric,
  p_preparation_minutes integer,
  p_is_popular boolean,
  p_is_spicy boolean,
  p_variants jsonb,
  p_allergens text[],
  p_ingredients jsonb
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  menu_row public.menu_items%rowtype;
  new_menu_id uuid;
  sku_value text := upper(btrim(coalesce(p_sku, '')));
  name_value text := btrim(coalesce(p_name, ''));
  category_value text := btrim(coalesce(p_category, ''));
  ingredient jsonb;
  variant jsonb;
begin
  if not exists (
    select 1 from public.memberships m
    join public.branches b on b.id = m.branch_id and b.restaurant_id = m.restaurant_id
    where m.user_id = (select auth.uid()) and m.restaurant_id = p_restaurant
      and m.branch_id = p_branch and m.role = 'branch_admin' and m.status = 'active'
      and b.status = 'active'
  ) then raise exception 'Admin cabang hanya dapat mengubah menu cabangnya sendiri.'; end if;

  select mi.* into menu_row
    from public.menu_items mi
    join public.branch_menu_items bmi on bmi.menu_item_id = mi.id and bmi.restaurant_id = mi.restaurant_id
   where mi.id = p_menu and mi.restaurant_id = p_restaurant and bmi.branch_id = p_branch
   for update of mi;
  if not found then raise exception 'Menu tidak tersedia di cabang ini.'; end if;

  if char_length(name_value) not between 2 and 100 then raise exception 'Nama menu harus 2-100 karakter.'; end if;
  if char_length(sku_value) not between 3 and 40 then raise exception 'SKU harus 3-40 karakter.'; end if;
  if char_length(category_value) not between 1 and 60 then raise exception 'Kategori harus 1-60 karakter.'; end if;
  if p_description is null or char_length(p_description) > 500 then raise exception 'Deskripsi maksimal 500 karakter.'; end if;
  if p_base_price is null or p_base_price < 0 then raise exception 'Harga dasar tidak valid.'; end if;
  if p_preparation_minutes is null or p_preparation_minutes < 1 or p_preparation_minutes > 240 then raise exception 'Waktu saji harus 1-240 menit.'; end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' then raise exception 'Data varian tidak valid.'; end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then raise exception 'Data bahan tidak valid.'; end if;
  for variant in select value from jsonb_array_elements(p_variants) loop
    if jsonb_typeof(variant -> 'options') is distinct from 'array' then raise exception 'Pilihan varian tidak valid.'; end if;
  end loop;

  -- If another branch uses the same catalog item, detach this branch to a local copy first.
  if exists (select 1 from public.branch_menu_items bmi where bmi.menu_item_id = p_menu and bmi.branch_id <> p_branch) then
    new_menu_id := gen_random_uuid();
    insert into public.menu_items (
      id, restaurant_id, sku, name, category, description, base_price, image_url, status,
      is_popular, is_spicy, preparation_time_minutes, variants, allergens
    ) values (
      new_menu_id, menu_row.restaurant_id, left(sku_value, 30) || '-C' || upper(substr(replace(new_menu_id::text, '-', ''), 1, 6)),
      menu_row.name, menu_row.category, menu_row.description, menu_row.base_price, menu_row.image_url, menu_row.status,
      menu_row.is_popular, menu_row.is_spicy, menu_row.preparation_time_minutes, menu_row.variants, menu_row.allergens
    );
    insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
      select restaurant_id, new_menu_id, name, quantity, unit from public.menu_ingredients where menu_item_id = p_menu;
    update public.branch_menu_items set menu_item_id = new_menu_id
     where branch_id = p_branch and menu_item_id = p_menu;
    p_menu := new_menu_id;
  end if;

  if exists (select 1 from public.menu_items mi where mi.restaurant_id = p_restaurant and mi.sku = sku_value and mi.id <> p_menu) then
    raise exception 'SKU sudah dipakai menu lain.';
  end if;

  update public.menu_items set
    sku = sku_value,
    name = name_value,
    category = category_value,
    description = btrim(p_description),
    base_price = p_base_price,
    preparation_time_minutes = p_preparation_minutes,
    is_popular = coalesce(p_is_popular, false),
    is_spicy = coalesce(p_is_spicy, false),
    variants = p_variants,
    allergens = coalesce(p_allergens, '{}'::text[])
  where id = p_menu and restaurant_id = p_restaurant;

  delete from public.menu_ingredients where menu_item_id = p_menu;
  for ingredient in select value from jsonb_array_elements(p_ingredients) loop
    if char_length(btrim(coalesce(ingredient ->> 'name', ''))) not between 1 and 100
      or char_length(btrim(coalesce(ingredient ->> 'unit', ''))) not between 1 and 30
      or coalesce((ingredient ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Data bahan tidak valid.';
    end if;
    insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
    values (p_restaurant, p_menu, btrim(ingredient ->> 'name'), (ingredient ->> 'quantity')::numeric, btrim(ingredient ->> 'unit'));
  end loop;

  return p_menu;
end;
$$;

create or replace function public.branch_admin_remove_menu(p_branch uuid, p_menu uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  rest_id uuid;
  other_branch_uses boolean;
  has_orders boolean;
begin
  select b.restaurant_id into rest_id
    from public.branches b
    join public.memberships m on m.restaurant_id = b.restaurant_id and m.branch_id = b.id
   where b.id = p_branch and m.user_id = (select auth.uid())
     and m.role = 'branch_admin' and m.status = 'active' and b.status = 'active';
  if rest_id is null then raise exception 'Admin cabang hanya dapat menghapus menu dari cabangnya sendiri.'; end if;
  if not exists (select 1 from public.branch_menu_items where branch_id = p_branch and menu_item_id = p_menu) then
    raise exception 'Menu tidak tersedia di cabang ini.';
  end if;

  select exists (select 1 from public.branch_menu_items where menu_item_id = p_menu and branch_id <> p_branch)
    into other_branch_uses;
  select exists (select 1 from public.order_items where menu_item_id = p_menu)
    into has_orders;
  delete from public.branch_menu_items where branch_id = p_branch and menu_item_id = p_menu;

  -- Remove the catalog row only when it is private to this branch and has no sales history.
  if not other_branch_uses and not has_orders then
    delete from public.menu_items where id = p_menu and restaurant_id = rest_id;
  elsif not other_branch_uses then
    update public.menu_items set status = 'archived' where id = p_menu and restaurant_id = rest_id;
  end if;
end;
$$;

revoke all on function public.branch_admin_update_menu(uuid, uuid, uuid, text, text, text, text, numeric, integer, boolean, boolean, jsonb, text[], jsonb) from public, anon;
revoke all on function public.branch_admin_remove_menu(uuid, uuid) from public, anon;
grant execute on function public.branch_admin_update_menu(uuid, uuid, uuid, text, text, text, text, numeric, integer, boolean, boolean, jsonb, text[], jsonb) to authenticated;
grant execute on function public.branch_admin_remove_menu(uuid, uuid) to authenticated;

commit;
