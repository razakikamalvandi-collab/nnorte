begin;

create table public.branch_menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade
);

create unique index branch_menu_categories_branch_name_key
  on public.branch_menu_categories (branch_id, lower(name));

alter table public.branch_menu_categories enable row level security;
create policy "members read own branch menu categories" on public.branch_menu_categories
  for select to authenticated using (public.can_access_branch(branch_id));
revoke all on public.branch_menu_categories from public, anon, authenticated;
grant select on public.branch_menu_categories to authenticated;

create or replace function public.branch_admin_add_menu_category(p_branch uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  rest_id uuid;
  category_id uuid;
  category_name text := btrim(coalesce(p_name, ''));
begin
  select b.restaurant_id into rest_id
    from public.branches b
    join public.memberships m on m.restaurant_id = b.restaurant_id and m.branch_id = b.id
   where b.id = p_branch and b.status = 'active' and m.user_id = (select auth.uid())
     and m.role = 'branch_admin' and m.status = 'active';
  if rest_id is null then raise exception 'Admin cabang hanya dapat mengelola kategori cabangnya sendiri.'; end if;
  if char_length(category_name) not between 1 and 60 then raise exception 'Nama kategori harus 1-60 karakter.'; end if;
  insert into public.branch_menu_categories (restaurant_id, branch_id, name)
  values (rest_id, p_branch, category_name) returning id into category_id;
  return category_id;
end;
$$;

create or replace function public.branch_admin_delete_menu_category(p_branch uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  rest_id uuid;
  category_name text := btrim(coalesce(p_name, ''));
begin
  select b.restaurant_id into rest_id
    from public.branches b
    join public.memberships m on m.restaurant_id = b.restaurant_id and m.branch_id = b.id
   where b.id = p_branch and m.user_id = (select auth.uid())
     and m.role = 'branch_admin' and m.status = 'active';
  if rest_id is null then raise exception 'Admin cabang hanya dapat mengelola kategori cabangnya sendiri.'; end if;
  if exists (
    select 1 from public.menu_items mi
    join public.branch_menu_items bmi on bmi.menu_item_id = mi.id and bmi.branch_id = p_branch
    where mi.restaurant_id = rest_id and lower(btrim(mi.category)) = lower(category_name)
  ) then raise exception 'Kategori masih digunakan menu cabang. Ubah kategori menu terlebih dahulu.'; end if;
  delete from public.branch_menu_categories
   where branch_id = p_branch and lower(name) = lower(category_name);
  if not found then raise exception 'Kategori cabang tidak ditemukan.'; end if;
end;
$$;

revoke all on function public.branch_admin_add_menu_category(uuid, text) from public, anon;
revoke all on function public.branch_admin_delete_menu_category(uuid, text) from public, anon;
grant execute on function public.branch_admin_add_menu_category(uuid, text) to authenticated;
grant execute on function public.branch_admin_delete_menu_category(uuid, text) to authenticated;

commit;
