begin;

-- A branch admin may add a catalog item, but it is only distributed to their own branch.
create or replace function public.branch_admin_create_menu(
  p_restaurant uuid,
  p_branch uuid,
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
  new_menu_id uuid := gen_random_uuid();
  item_name text := btrim(coalesce(p_name, ''));
  sku_value text := upper(btrim(coalesce(p_sku, '')));
  category_value text := btrim(coalesce(p_category, ''));
  ingredient jsonb;
begin
  if not exists (
    select 1 from public.memberships m
    join public.branches b on b.id = m.branch_id and b.restaurant_id = m.restaurant_id
    where m.user_id = (select auth.uid()) and m.restaurant_id = p_restaurant
      and m.branch_id = p_branch and m.role = 'branch_admin' and m.status = 'active'
      and b.status = 'active'
  ) then raise exception 'Admin cabang hanya dapat menambah menu di cabangnya sendiri.'; end if;
  if char_length(item_name) < 2 or char_length(item_name) > 100 then raise exception 'Nama menu harus 2-100 karakter.'; end if;
  if char_length(sku_value) < 3 or char_length(sku_value) > 40 then raise exception 'SKU tidak valid.'; end if;
  if char_length(category_value) < 1 or char_length(category_value) > 60 then raise exception 'Kategori harus 1-60 karakter.'; end if;
  if p_description is null or char_length(p_description) > 500 then raise exception 'Deskripsi maksimal 500 karakter.'; end if;
  if p_base_price is null or p_base_price < 0 then raise exception 'Harga menu tidak valid.'; end if;
  if p_preparation_minutes is null or p_preparation_minutes < 1 or p_preparation_minutes > 240 then raise exception 'Waktu saji harus 1-240 menit.'; end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' then raise exception 'Data varian tidak valid.'; end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then raise exception 'Data bahan tidak valid.'; end if;

  insert into public.menu_items (
    id, restaurant_id, sku, name, category, description, base_price, status,
    is_popular, is_spicy, preparation_time_minutes, variants, allergens
  ) values (
    new_menu_id, p_restaurant, sku_value, item_name, category_value, btrim(p_description), p_base_price, 'active',
    coalesce(p_is_popular, false), coalesce(p_is_spicy, false), p_preparation_minutes, p_variants, coalesce(p_allergens, '{}'::text[])
  );

  if jsonb_array_length(p_ingredients) > 0 then
    for ingredient in select value from jsonb_array_elements(p_ingredients) loop
      if char_length(btrim(coalesce(ingredient ->> 'name', ''))) not between 1 and 100
        or char_length(btrim(coalesce(ingredient ->> 'unit', ''))) not between 1 and 30
        or coalesce((ingredient ->> 'quantity')::numeric, 0) <= 0 then
        raise exception 'Data bahan tidak valid.';
      end if;
      insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
      values (p_restaurant, new_menu_id, btrim(ingredient ->> 'name'), (ingredient ->> 'quantity')::numeric, btrim(ingredient ->> 'unit'));
    end loop;
  end if;

  insert into public.branch_menu_items (
    restaurant_id, branch_id, menu_item_id, price, is_available, is_sold_out_today, addons
  ) values (p_restaurant, p_branch, new_menu_id, p_base_price, true, false, '[]'::jsonb);
  return new_menu_id;
end;
$$;

revoke all on function public.branch_admin_create_menu(uuid, uuid, text, text, text, text, numeric, integer, boolean, boolean, jsonb, text[], jsonb) from public, anon;
grant execute on function public.branch_admin_create_menu(uuid, uuid, text, text, text, text, numeric, integer, boolean, boolean, jsonb, text[], jsonb) to authenticated;

commit;
