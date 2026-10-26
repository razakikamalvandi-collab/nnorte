-- Resep bahan per porsi + pemotongan stok otomatis saat item pesanan dibuat.
--
-- Sumber bahan adalah menu_ingredients (Master Katalog), bukan deskripsi bebas.
-- Stok hanya dipotong bila bahan sudah punya baris inventory di cabang.
-- Ledger order_ingredient_usage menyimpan pemakaian agar pembatalan dapat
-- mengembalikan jumlah yang tepat, bukan berdasarkan resep yang mungkin sudah berubah.
begin;

-- ============================================================================
-- 1. Kolom alergen yang selama ini hanya ada di form frontend
-- ============================================================================
alter table public.menu_items
  add column if not exists allergens text[] not null default '{}'::text[];

-- ============================================================================
-- 2. Nama bahan inventory unik per cabang (case-insensitive)
-- ============================================================================
create unique index if not exists inventory_items_branch_name_key
  on public.inventory_items (branch_id, lower(btrim(name)));

-- ============================================================================
-- 3. Resep bahan per menu
-- ============================================================================
create table public.menu_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (unit = btrim(unit) and char_length(unit) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, menu_item_id)
    references public.menu_items (restaurant_id, id) on delete cascade
);

create unique index menu_ingredients_menu_name_key
  on public.menu_ingredients (menu_item_id, lower(name));

create index menu_ingredients_menu_idx
  on public.menu_ingredients (menu_item_id);

create trigger menu_ingredients_set_updated_at
  before update on public.menu_ingredients
  for each row execute function public.set_updated_at();

alter table public.menu_ingredients enable row level security;

create policy "members read menu ingredients" on public.menu_ingredients
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "owners manage menu ingredients" on public.menu_ingredients
  for all to authenticated
  using (public.is_restaurant_owner(restaurant_id))
  with check (public.is_restaurant_owner(restaurant_id));

revoke all on public.menu_ingredients from anon;
grant select, insert, update, delete on public.menu_ingredients to authenticated;

-- ============================================================================
-- 4. Ledger pemakaian bahan per item pesanan
-- ============================================================================
create table public.order_ingredient_usage (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  ingredient_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz
);

create index order_ingredient_usage_order_idx
  on public.order_ingredient_usage (order_id);

create index order_ingredient_usage_inventory_idx
  on public.order_ingredient_usage (inventory_item_id);

alter table public.order_ingredient_usage enable row level security;
revoke all on public.order_ingredient_usage from anon, authenticated;

-- ============================================================================
-- 5. Potong stok saat order item dibuat
-- ============================================================================
-- Trigger AFTER INSERT pada order_items memastikan pemotongan terjadi di
-- transaksi yang sama dengan pembuatan pesanan. Jika satu bahan gagal, seluruh
-- pesanan (header, item, total) ikut rollback.
create or replace function public.consume_order_item_ingredients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_rec public.orders%rowtype;
  ingredient_rec record;
  inventory_rec public.inventory_items%rowtype;
  needed numeric(14,3);
begin
  select * into order_rec from public.orders where id = new.order_id;
  if not found then
    raise exception 'Pesanan tidak ditemukan saat memotong stok.';
  end if;

  for ingredient_rec in
    select mi.name as ingredient_name,
           mi.quantity as quantity_per_portion,
           mi.unit as ingredient_unit
      from public.menu_ingredients mi
     where mi.menu_item_id = new.menu_item_id
     order by mi.name
  loop
    needed := ingredient_rec.quantity_per_portion * new.quantity;

    select * into inventory_rec
      from public.inventory_items
     where branch_id = order_rec.branch_id
       and lower(btrim(name)) = lower(btrim(ingredient_rec.ingredient_name))
     for update;

    -- Bahan yang belum punya inventory dilewati; pesanan lama tetap bisa jalan.
    if found then
      if lower(btrim(inventory_rec.unit)) <> lower(btrim(ingredient_rec.ingredient_unit)) then
        raise exception 'Satuan bahan % tidak cocok. Resep: %, stok: %.',
          ingredient_rec.ingredient_name, ingredient_rec.ingredient_unit, inventory_rec.unit;
      end if;

      if inventory_rec.current_stock < needed then
        raise exception 'Stok bahan % tidak cukup. Butuh %, tersedia %.',
          ingredient_rec.ingredient_name, needed, inventory_rec.current_stock;
      end if;

      update public.inventory_items
         set current_stock = current_stock - needed
       where id = inventory_rec.id;

      insert into public.order_ingredient_usage (
        restaurant_id, branch_id, order_id, order_item_id, inventory_item_id,
        ingredient_name, quantity, unit
      ) values (
        order_rec.restaurant_id, order_rec.branch_id, order_rec.id, new.id, inventory_rec.id,
        ingredient_rec.ingredient_name, needed, inventory_rec.unit
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists order_items_consume_ingredients on public.order_items;
create trigger order_items_consume_ingredients
  after insert on public.order_items
  for each row execute function public.consume_order_item_ingredients();

-- ============================================================================
-- 6. Kembalikan stok saat pesanan dibatalkan
-- ============================================================================
create or replace function public.restore_order_ingredients(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage_rec record;
begin
  for usage_rec in
    select * from public.order_ingredient_usage
     where order_id = p_order_id and restored_at is null
     order by id
     for update
  loop
    update public.inventory_items
       set current_stock = current_stock + usage_rec.quantity
     where id = usage_rec.inventory_item_id;

    update public.order_ingredient_usage
       set restored_at = now()
     where id = usage_rec.id;
  end loop;
end;
$$;

create or replace function public.restore_ingredients_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.restore_order_ingredients(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_restore_ingredients_on_cancel on public.orders;
create trigger orders_restore_ingredients_on_cancel
  after update of status on public.orders
  for each row execute function public.restore_ingredients_on_order_cancel();

-- Fungsi internal tidak boleh dipanggil langsung oleh client.
revoke all on function public.consume_order_item_ingredients() from public, anon, authenticated;
revoke all on function public.restore_order_ingredients(uuid) from public, anon, authenticated;
revoke all on function public.restore_ingredients_on_order_cancel() from public, anon, authenticated;

commit;
