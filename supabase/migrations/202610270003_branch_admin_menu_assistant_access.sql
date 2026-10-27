begin;

-- Admin cabang can create catalog entries only through the validated RPC.
-- This insert policy is useful for the super-admin direct insert path only; branch admins stay RPC-only.
create policy "branch admins read menu catalog" on public.menu_items
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "branch admins manage menu recipes" on public.menu_ingredients
  for all to authenticated
  using (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m
    where m.restaurant_id = menu_ingredients.restaurant_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role = 'branch_admin' and m.branch_id is not null
  ))
  with check (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m
    where m.restaurant_id = menu_ingredients.restaurant_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role = 'branch_admin' and m.branch_id is not null
  ));

drop policy "owners insert menu images" on storage.objects;
create policy "staff insert menu images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_restaurant_member(((storage.foldername(name))[1])::uuid)
             else false end
  );

commit;
