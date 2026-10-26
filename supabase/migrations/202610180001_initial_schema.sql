-- Supabase/PostgreSQL schema for a multi-tenant, multi-branch restaurant app.
-- Apply with: npx supabase db push (after linking a Supabase project).
begin;

create type public.app_role as enum ('owner', 'branch_admin', 'cashier', 'kitchen');
create type public.record_status as enum ('active', 'inactive');
create type public.menu_status as enum ('active', 'archived');
create type public.order_type as enum ('dine_in', 'takeaway');
create type public.order_status as enum ('pending', 'kitchen_queue', 'cooking', 'ready_to_serve', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
create type public.payment_method as enum ('qris', 'cash', 'credit_card', 'debit_card', 'bank_transfer');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tagline text not null default '',
  contact_email text,
  contact_phone text,
  currency text not null default 'IDR',
  tax_percentage numeric(5,2) not null default 0 check (tax_percentage between 0 and 100),
  service_charge_percentage numeric(5,2) not null default 0 check (service_charge_percentage between 0 and 100),
  allow_online_takeaway boolean not null default false,
  sound_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  code text not null,
  name text not null,
  tagline text not null default '',
  address text not null,
  city text not null,
  phone text not null,
  email text not null,
  logo_url text,
  operating_hours text not null default '11:00 - 23:00 WIB',
  status public.record_status not null default 'active',
  total_tables integer not null default 0 check (total_tables >= 0),
  manager_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code),
  unique (restaurant_id, id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid,
  role public.app_role not null,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id, branch_id),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade,
  check ((role = 'owner' and branch_id is null) or (role <> 'owner' and branch_id is not null))
);
create unique index memberships_one_owner_per_restaurant_idx
  on public.memberships (restaurant_id, user_id) where role = 'owner';

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null,
  description text not null default '',
  base_price numeric(14,2) not null check (base_price >= 0),
  image_url text,
  status public.menu_status not null default 'active',
  is_popular boolean not null default false,
  is_spicy boolean not null default false,
  preparation_time_minutes integer not null default 0 check (preparation_time_minutes >= 0),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, sku),
  unique (restaurant_id, id)
);

create table public.branch_menu_items (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  menu_item_id uuid not null,
  price numeric(14,2) not null check (price >= 0),
  is_available boolean not null default true,
  is_sold_out_today boolean not null default false,
  custom_note text,
  addons jsonb not null default '[]'::jsonb check (jsonb_typeof(addons) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (branch_id, menu_item_id),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade,
  foreign key (restaurant_id, menu_item_id) references public.menu_items(restaurant_id, id) on delete cascade
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  table_number text not null,
  capacity integer not null default 2 check (capacity > 0),
  status text not null default 'available' check (status in ('available', 'occupied', 'reserved', 'billing')),
  qr_code_token text not null unique default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  unique (branch_id, table_number),
  unique (branch_id, id),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  name text not null,
  category text not null,
  current_stock numeric(14,3) not null default 0 check (current_stock >= 0),
  unit text not null,
  min_threshold numeric(14,3) not null default 0 check (min_threshold >= 0),
  cost_per_unit numeric(14,2) not null default 0 check (cost_per_unit >= 0),
  last_restocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  branch_id uuid not null,
  table_id uuid,
  order_number text not null,
  order_type public.order_type not null,
  customer_name text not null,
  customer_phone text,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  service_charge_amount numeric(14,2) not null default 0 check (service_charge_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  created_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  kitchen_start_at timestamptz,
  kitchen_finish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, order_number),
  unique (restaurant_id, branch_id, id),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete restrict,
  foreign key (branch_id, table_id) references public.dining_tables(branch_id, id) on delete set null (table_id),
  check (order_type = 'dine_in' or table_id is null)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  menu_name_snapshot text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  variant_choice text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, order_id) references public.orders(restaurant_id, branch_id, id) on delete cascade
);

create table public.order_item_addons (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_name_snapshot text not null,
  unit_price numeric(14,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  method public.payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  cash_tendered numeric(14,2) check (cash_tendered is null or cash_tendered >= 0),
  change_due numeric(14,2) check (change_due is null or change_due >= 0),
  provider_reference text,
  status public.payment_status not null default 'paid',
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  foreign key (restaurant_id, branch_id, order_id) references public.orders(restaurant_id, branch_id, id) on delete restrict
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  outcome text not null default 'success' check (outcome in ('success', 'warning', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade
);

create index branches_restaurant_status_idx on public.branches(restaurant_id, status);
create index memberships_user_status_idx on public.memberships(user_id, status);
create index menu_items_restaurant_status_idx on public.menu_items(restaurant_id, status);
create index inventory_branch_name_idx on public.inventory_items(branch_id, name);
create index orders_branch_created_idx on public.orders(branch_id, created_at desc);
create index orders_branch_status_idx on public.orders(branch_id, status, created_at desc);
create index payments_order_idx on public.payments(order_id, paid_at desc);
create index audit_logs_restaurant_created_idx on public.audit_logs(restaurant_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();
create trigger menu_items_set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger branch_menu_items_set_updated_at before update on public.branch_menu_items
  for each row execute function public.set_updated_at();
create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Pengguna'), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.register_payment(
  target_order uuid,
  payment_method public.payment_method,
  paid_amount numeric,
  tendered_amount numeric default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_record public.orders%rowtype;
  payment_id uuid;
begin
  select * into target_record from public.orders where id = target_order for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if not public.can_access_branch(target_record.branch_id) then raise exception 'Akses cabang ditolak'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.restaurant_id = target_record.restaurant_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'branch_admin', 'cashier')
      and (m.role = 'owner' or m.branch_id = target_record.branch_id)
  ) then raise exception 'Peran tidak diizinkan memproses pembayaran'; end if;
  if target_record.payment_status <> 'unpaid' then raise exception 'Pesanan sudah dibayar atau dikembalikan'; end if;
  if paid_amount <> target_record.total_amount then raise exception 'Nominal pembayaran harus sama dengan total pesanan'; end if;
  if payment_method = 'cash' and (tendered_amount is null or tendered_amount < paid_amount) then
    raise exception 'Uang tunai yang diterima kurang dari total pesanan';
  end if;

  insert into public.payments (restaurant_id, branch_id, order_id, method, amount, cash_tendered, change_due, created_by)
  values (
    target_record.restaurant_id, target_record.branch_id, target_record.id, payment_method,
    paid_amount, tendered_amount,
    case when payment_method = 'cash' then tendered_amount - paid_amount else null end,
    (select auth.uid())
  ) returning id into payment_id;

  update public.orders set payment_status = 'paid', paid_at = now() where id = target_record.id;
  return payment_id;
end;
$$;

create or replace function public.create_branch_order(
  target_restaurant uuid,
  target_branch uuid,
  requested_order_type public.order_type,
  requested_table uuid,
  customer text,
  customer_contact text,
  requested_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  order_id uuid := gen_random_uuid();
  order_code text;
  branch_record public.branches%rowtype;
  restaurant_record public.restaurants%rowtype;
  item jsonb;
  addon_request jsonb;
  addon_record jsonb;
  menu_record record;
  item_id uuid;
  quantity_value integer;
  addon_total numeric(14,2);
  subtotal_value numeric(14,2) := 0;
  table_status text;
begin
  if not public.is_restaurant_member(target_restaurant) or not public.can_access_branch(target_branch) then
    raise exception 'Akses restoran atau cabang ditolak';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.restaurant_id = target_restaurant and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'branch_admin', 'cashier')
      and (m.role = 'owner' or m.branch_id = target_branch)
  ) then raise exception 'Peran tidak diizinkan membuat pesanan'; end if;
  if customer is null or length(trim(customer)) = 0 then raise exception 'Nama pelanggan wajib diisi'; end if;
  if requested_items is null or jsonb_typeof(requested_items) is distinct from 'array'
    or jsonb_array_length(requested_items) = 0 then
    raise exception 'Pesanan harus memiliki minimal satu menu';
  end if;
  if jsonb_array_length(requested_items) > 50 then raise exception 'Pesanan terlalu besar'; end if;

  select * into branch_record from public.branches b
    where b.id = target_branch and b.restaurant_id = target_restaurant and b.status = 'active';
  if not found then raise exception 'Cabang tidak aktif atau tidak ditemukan'; end if;
  select * into restaurant_record from public.restaurants r where r.id = target_restaurant;
  if requested_order_type = 'dine_in' then
    select t.status into table_status from public.dining_tables t
      where t.id = requested_table and t.branch_id = target_branch for update;
    if not found or table_status not in ('available', 'occupied', 'reserved') then
      raise exception 'Meja tidak tersedia untuk cabang ini';
    end if;
  end if;
  if requested_order_type = 'takeaway' and requested_table is not null then
    raise exception 'Pesanan takeaway tidak boleh memakai meja';
  end if;

  order_code := branch_record.code || '-' || to_char(now() at time zone 'UTC', 'YYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  for item in select value from jsonb_array_elements(requested_items) loop
    item_id := (item ->> 'menu_item_id')::uuid;
    quantity_value := (item ->> 'quantity')::integer;
    if quantity_value < 1 or quantity_value > 99 then raise exception 'Jumlah menu tidak valid'; end if;

    select mi.id, mi.name, bmi.price, bmi.addons into menu_record
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
      where bmi.restaurant_id = target_restaurant and bmi.branch_id = target_branch
        and bmi.menu_item_id = item_id and bmi.is_available and not bmi.is_sold_out_today
        and mi.status = 'active';
    if not found then raise exception 'Menu tidak tersedia di cabang ini'; end if;

    addon_total := 0;
    for addon_request in select value from jsonb_array_elements(coalesce(item -> 'addons', '[]'::jsonb)) loop
      select candidate.value into addon_record
        from jsonb_array_elements(menu_record.addons) as candidate(value)
        where candidate.value ->> 'id' = addon_request ->> 'id';
      if addon_record is null then raise exception 'Tambahan menu tidak valid'; end if;
      addon_total := addon_total + (addon_record ->> 'price')::numeric;
    end loop;

    insert into public.order_items (
      restaurant_id, branch_id, order_id, menu_item_id, menu_name_snapshot,
      unit_price, quantity, variant_choice, notes
    ) values (
      target_restaurant, target_branch, order_id, item_id, menu_record.name,
      menu_record.price, quantity_value, nullif(item ->> 'variant_choice', ''), nullif(item ->> 'notes', '')
    ) returning id into item_id;

    for addon_request in select value from jsonb_array_elements(coalesce(item -> 'addons', '[]'::jsonb)) loop
      select candidate.value into addon_record
        from jsonb_array_elements(menu_record.addons) as candidate(value)
        where candidate.value ->> 'id' = addon_request ->> 'id';
      insert into public.order_item_addons (order_item_id, addon_name_snapshot, unit_price)
      values (item_id, addon_record ->> 'name', (addon_record ->> 'price')::numeric);
    end loop;

    subtotal_value := subtotal_value + (menu_record.price + addon_total) * quantity_value;
  end loop;

  insert into public.orders (
    id, restaurant_id, branch_id, table_id, order_number, order_type,
    customer_name, customer_phone, subtotal, tax_amount, service_charge_amount,
    total_amount, created_by
  ) values (
    order_id, target_restaurant, target_branch, requested_table, order_code, requested_order_type,
    trim(customer), nullif(trim(customer_contact), ''), subtotal_value,
    round(subtotal_value * restaurant_record.tax_percentage / 100, 2),
    round(subtotal_value * restaurant_record.service_charge_percentage / 100, 2),
    subtotal_value + round(subtotal_value * restaurant_record.tax_percentage / 100, 2)
      + round(subtotal_value * restaurant_record.service_charge_percentage / 100, 2),
    (select auth.uid())
  );

  if requested_order_type = 'dine_in' then
    update public.dining_tables set status = 'occupied' where id = requested_table;
  end if;
  return order_id;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.register_payment(uuid, public.payment_method, numeric, numeric) from public, anon;
revoke all on function public.create_branch_order(uuid, uuid, public.order_type, uuid, text, text, jsonb) from public, anon;
grant execute on function public.register_payment(uuid, public.payment_method, numeric, numeric) to authenticated;
grant execute on function public.create_branch_order(uuid, uuid, public.order_type, uuid, text, text, jsonb) to authenticated;

create or replace function public.is_restaurant_member(target_restaurant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = target_restaurant
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.can_access_branch(target_branch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.branches b on b.restaurant_id = m.restaurant_id
    where b.id = target_branch
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (m.role = 'owner' or m.branch_id = target_branch)
  );
$$;

create or replace function public.is_restaurant_owner(target_restaurant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = target_restaurant
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

revoke all on function public.is_restaurant_member(uuid) from public;
revoke all on function public.can_access_branch(uuid) from public;
revoke all on function public.is_restaurant_owner(uuid) from public;
grant execute on function public.is_restaurant_member(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;
grant execute on function public.is_restaurant_owner(uuid) to authenticated;

alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.memberships enable row level security;
alter table public.menu_items enable row level security;
alter table public.branch_menu_items enable row level security;
alter table public.dining_tables enable row level security;
alter table public.inventory_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

create policy "restaurant members read restaurant" on public.restaurants for select to authenticated
  using (public.is_restaurant_member(id));
create policy "owner updates restaurant" on public.restaurants for update to authenticated
  using (public.is_restaurant_owner(id)) with check (public.is_restaurant_owner(id));

create policy "users read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "users update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read branches" on public.branches for select to authenticated
  using (public.is_restaurant_member(restaurant_id));
create policy "owners manage branches" on public.branches for all to authenticated
  using (public.is_restaurant_owner(restaurant_id)) with check (public.is_restaurant_owner(restaurant_id));

create policy "members read memberships" on public.memberships for select to authenticated
  using (public.is_restaurant_member(restaurant_id));
create policy "owners manage memberships" on public.memberships for all to authenticated
  using (public.is_restaurant_owner(restaurant_id)) with check (public.is_restaurant_owner(restaurant_id));

create policy "members read menu catalog" on public.menu_items for select to authenticated
  using (public.is_restaurant_member(restaurant_id));
create policy "owners manage menu catalog" on public.menu_items for all to authenticated
  using (public.is_restaurant_owner(restaurant_id)) with check (public.is_restaurant_owner(restaurant_id));

create policy "branch members read branch menu" on public.branch_menu_items for select to authenticated
  using (public.can_access_branch(branch_id));
create policy "branch admins manage branch menu" on public.branch_menu_items for all to authenticated
  using (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = branch_menu_items.restaurant_id
      and m.branch_id = branch_menu_items.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  )) with check (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = branch_menu_items.restaurant_id
      and m.branch_id = branch_menu_items.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  ));

create policy "branch members read tables" on public.dining_tables for select to authenticated
  using (public.can_access_branch(branch_id));
create policy "branch admins manage tables" on public.dining_tables for all to authenticated
  using (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = dining_tables.restaurant_id
      and m.branch_id = dining_tables.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  )) with check (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = dining_tables.restaurant_id
      and m.branch_id = dining_tables.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  ));

create policy "branch members read inventory" on public.inventory_items for select to authenticated
  using (public.can_access_branch(branch_id));
create policy "branch admins manage inventory" on public.inventory_items for all to authenticated
  using (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = inventory_items.restaurant_id
      and m.branch_id = inventory_items.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  )) with check (public.is_restaurant_owner(restaurant_id) or exists (
    select 1 from public.memberships m where m.restaurant_id = inventory_items.restaurant_id
      and m.branch_id = inventory_items.branch_id and m.user_id = (select auth.uid())
      and m.role = 'branch_admin' and m.status = 'active'
  ));

create policy "branch members read orders" on public.orders for select to authenticated
  using (public.can_access_branch(branch_id));
create policy "branch order takers create orders" on public.orders for insert to authenticated
  with check (exists (
    select 1 from public.memberships m where m.restaurant_id = orders.restaurant_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'branch_admin', 'cashier')
      and (m.role = 'owner' or m.branch_id = orders.branch_id)
  ));
create policy "branch staff update order status" on public.orders for update to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));

create policy "branch members read order items" on public.order_items for select to authenticated
  using (public.can_access_branch(branch_id));
create policy "branch staff manage order items" on public.order_items for all to authenticated
  using (public.can_access_branch(branch_id)) with check (public.can_access_branch(branch_id));
create policy "branch members read addons" on public.order_item_addons for select to authenticated
  using (exists (select 1 from public.order_items oi where oi.id = order_item_id and public.can_access_branch(oi.branch_id)));
create policy "branch staff manage addons" on public.order_item_addons for all to authenticated
  using (exists (select 1 from public.order_items oi where oi.id = order_item_id and public.can_access_branch(oi.branch_id)))
  with check (exists (select 1 from public.order_items oi where oi.id = order_item_id and public.can_access_branch(oi.branch_id)));

create policy "branch members read payments" on public.payments for select to authenticated
  using (public.can_access_branch(branch_id));
-- Payments are inserted only by register_payment() so clients cannot forge receipts.

create policy "members read audit logs" on public.audit_logs for select to authenticated
  using (public.is_restaurant_member(restaurant_id) and (branch_id is null or public.can_access_branch(branch_id)));
create policy "members create audit logs" on public.audit_logs for insert to authenticated
  with check (public.is_restaurant_member(restaurant_id) and (branch_id is null or public.can_access_branch(branch_id)));

revoke all on public.restaurants, public.profiles, public.branches, public.memberships,
  public.menu_items, public.branch_menu_items, public.dining_tables, public.inventory_items,
  public.orders, public.order_items, public.order_item_addons, public.payments, public.audit_logs
  from anon, authenticated;
grant select on public.restaurants, public.profiles, public.branches, public.memberships,
  public.menu_items, public.branch_menu_items, public.dining_tables, public.inventory_items,
  public.orders, public.order_items, public.order_item_addons, public.payments, public.audit_logs
  to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update on public.restaurants to authenticated;
grant insert, update, delete on public.branches, public.memberships, public.menu_items,
  public.branch_menu_items, public.dining_tables, public.inventory_items to authenticated;
grant update (status, kitchen_start_at, kitchen_finish_at) on public.orders to authenticated;

commit;
