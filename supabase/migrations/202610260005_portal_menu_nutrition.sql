begin;

drop function public.portal_get_menu(uuid);

create function public.portal_get_menu(p_branch uuid)
returns table (
  menu_item_id uuid, sku text, name text, category text, description text, image_url text,
  price numeric, is_popular boolean, is_spicy boolean, preparation_time_minutes integer,
  variants jsonb, addons jsonb, ingredients jsonb, allergens text[], is_sold_out boolean
)
language sql stable security definer set search_path = '' as $$
  select mi.id, mi.sku, mi.name, mi.category, mi.description, mi.image_url, bmi.price,
         mi.is_popular, mi.is_spicy, mi.preparation_time_minutes, mi.variants, bmi.addons,
         coalesce((
           select jsonb_agg(
             jsonb_build_object('name', ingredient.name, 'quantity', ingredient.quantity, 'unit', ingredient.unit)
             order by ingredient.name
           )
             from public.menu_ingredients ingredient
            where ingredient.menu_item_id = mi.id
         ), '[]'::jsonb),
         mi.allergens,
         bmi.is_sold_out_today
    from public.branch_menu_items bmi
    join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
    join public.branches b on b.id = bmi.branch_id and b.status = 'active'
   where bmi.branch_id = p_branch
     and bmi.is_available
     and mi.status = 'active'
   order by mi.category, mi.name;
$$;

revoke all on function public.portal_get_menu(uuid) from public;
grant execute on function public.portal_get_menu(uuid) to anon, authenticated;

commit;
