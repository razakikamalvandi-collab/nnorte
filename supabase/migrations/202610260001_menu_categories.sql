-- Master katalog: kategori menu yang bisa ditambahkan tanpa harus menunggu ada menu.
-- Kategori yang sudah dipakai menu lama di-backfill agar filter & form tetap lengkap.
begin;

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Nama kategori unik per restoran tanpa membedakan huruf besar/kecil.
create unique index menu_categories_restaurant_name_key
  on public.menu_categories (restaurant_id, lower(name));

alter table public.menu_categories enable row level security;

create policy "members read menu categories" on public.menu_categories
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "owners manage menu categories" on public.menu_categories
  for all to authenticated
  using (public.is_restaurant_owner(restaurant_id))
  with check (public.is_restaurant_owner(restaurant_id));

revoke all on public.menu_categories from anon, authenticated;
grant select, insert, update, delete on public.menu_categories to authenticated;

-- Backfill dari kategori menu yang sudah ada. distinct on memilih satu ejaan
-- untuk kategori yang hanya berbeda huruf besar/kecil.
insert into public.menu_categories (restaurant_id, name)
select distinct on (m.restaurant_id, lower(btrim(m.category)))
  m.restaurant_id,
  btrim(m.category)
from public.menu_items m
where btrim(m.category) <> ''
order by m.restaurant_id, lower(btrim(m.category)), btrim(m.category);

commit;
