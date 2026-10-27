begin;

create or replace function public.branch_admin_delete_menu_category(p_branch uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  rest_id uuid;
  category_name text := btrim(coalesce(p_name, ''));
  menu_row public.menu_items%rowtype;
  local_menu_id uuid;
begin
  select b.restaurant_id into rest_id
    from public.branches b
    join public.memberships m on m.restaurant_id = b.restaurant_id and m.branch_id = b.id
   where b.id = p_branch and m.user_id = (select auth.uid())
     and m.role = 'branch_admin' and m.status = 'active' and b.status = 'active';
  if rest_id is null then raise exception 'Admin cabang hanya dapat mengelola kategori cabangnya sendiri.'; end if;
  if char_length(category_name) not between 1 and 60 then raise exception 'Kategori tidak valid.'; end if;

  for menu_row in
    select mi.* from public.menu_items mi
    join public.branch_menu_items bmi on bmi.menu_item_id = mi.id and bmi.branch_id = p_branch
    where mi.restaurant_id = rest_id and lower(btrim(mi.category)) = lower(category_name)
    for update of mi
  loop
    local_menu_id := menu_row.id;
    if exists (select 1 from public.branch_menu_items where menu_item_id = menu_row.id and branch_id <> p_branch) then
      local_menu_id := gen_random_uuid();
      insert into public.menu_items (
        id, restaurant_id, sku, name, category, description, base_price, image_url, status,
        is_popular, is_spicy, preparation_time_minutes, variants, allergens
      ) values (
        local_menu_id, menu_row.restaurant_id,
        left(menu_row.sku, 30) || '-C' || upper(substr(replace(local_menu_id::text, '-', ''), 1, 6)),
        menu_row.name, menu_row.category, menu_row.description, menu_row.base_price, menu_row.image_url, menu_row.status,
        menu_row.is_popular, menu_row.is_spicy, menu_row.preparation_time_minutes, menu_row.variants, menu_row.allergens
      );
      insert into public.menu_ingredients (restaurant_id, menu_item_id, name, quantity, unit)
        select restaurant_id, local_menu_id, name, quantity, unit
          from public.menu_ingredients where menu_item_id = menu_row.id;
      update public.branch_menu_items set menu_item_id = local_menu_id
       where branch_id = p_branch and menu_item_id = menu_row.id;
    end if;
    update public.menu_items set category = 'Lainnya' where id = local_menu_id;
  end loop;

  delete from public.branch_menu_categories
   where branch_id = p_branch and lower(name) = lower(category_name);
end;
$$;

revoke all on function public.branch_admin_delete_menu_category(uuid, text) from public, anon;
grant execute on function public.branch_admin_delete_menu_category(uuid, text) to authenticated;

commit;
