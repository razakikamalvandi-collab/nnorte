-- NNORTE enhancements (2026-10-22)
--
-- Isi migrasi ini:
--   1. Kolom cabang baru (provinsi, kode pos, koordinat, place_id, jam operasional terstruktur).
--   2. Kode cabang otomatis per kota (NN-PDG-01, NN-JKT-01, ...) - tahan race condition.
--   3. Tabel `expenses` (pengeluaran operasional) + RLS.
--   4. RPC laporan keuangan (harian, metode pembayaran, menu terlaris) - SECURITY INVOKER,
--      sehingga RLS tetap berlaku untuk setiap peran.
--   5. Bucket Storage `menu-images` + kebijakan upload khusus owner.
--   6. RPC portal pelanggan (anon) berbasis token QR.
--   7. RPC anggota tim (daftar anggota, status akses, email korporat otomatis).
--
-- Zona waktu bisnis: Asia/Jakarta. Semua pengelompokan tanggal laporan memakai zona ini.
--
-- Definisi metrik (dipakai dashboard, laporan, PDF, dan Excel):
--   * Transaksi sah   : orders.payment_status = 'paid' DAN orders.status <> 'cancelled'
--                       (tanggal transaksi = tanggal paid_at di Asia/Jakarta).
--   * Pendapatan      : total_amount - tax_amount (PB1 adalah titipan pajak, bukan pendapatan).
--                       Service charge tetap dihitung sebagai pendapatan.
--   * Pengeluaran     : jumlah baris `expenses` pada tanggal tersebut.
--   * Laba bersih     : Pendapatan - Pengeluaran (hanya dari pengeluaran yang tercatat).
begin;

-- ============================================================================
-- 1. Kolom cabang
-- ============================================================================
alter table public.branches
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists place_id text,
  add column if not exists is_24_hours boolean not null default false,
  add column if not exists opening_time time,
  add column if not exists closing_time time,
  add column if not exists chart_color text;

alter table public.branches
  add constraint branches_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint branches_longitude_range check (longitude is null or longitude between -180 and 180),
  add constraint branches_chart_color_hex check (chart_color is null or chart_color ~ '^#[0-9a-fA-F]{6}$');

-- Isi jam terstruktur dari teks lama ("11:00 - 23:00 WIB") bila bisa diparse.
update public.branches b
   set opening_time = (m.arr)[1]::time,
       closing_time = (m.arr)[2]::time
  from (
    select id, regexp_match(operating_hours, '(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})') as arr
      from public.branches
  ) m
 where m.id = b.id and m.arr is not null and b.opening_time is null;

-- NOT VALID: data lama yang tidak bisa diparse tidak memblokir migrasi, tetapi
-- setiap insert/update baru wajib konsisten. Jam tutup boleh lebih kecil dari
-- jam buka (operasional melewati tengah malam); hanya jam yang identik ditolak.
alter table public.branches
  add constraint branches_hours_consistent
  check (is_24_hours or (opening_time is not null and closing_time is not null and opening_time <> closing_time))
  not valid;

-- Teks operating_hours tetap dipertahankan agar tampilan lama tidak rusak.
create or replace function public.branches_sync_operating_hours()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_24_hours then
    new.operating_hours := 'Buka 24 Jam';
  elsif new.opening_time is not null and new.closing_time is not null then
    new.operating_hours := to_char(new.opening_time, 'HH24:MI') || ' - ' || to_char(new.closing_time, 'HH24:MI') || ' WIB';
  end if;
  return new;
end;
$$;

create trigger branches_sync_operating_hours_trg
  before insert or update on public.branches
  for each row execute function public.branches_sync_operating_hours();

-- ============================================================================
-- 2. Kode cabang otomatis
-- ============================================================================
-- Pemetaan kota -> kode 3 huruf. Kota yang belum terdaftar memakai fallback
-- deterministik: 3 huruf alfabet pertama dari nama kota (huruf kapital),
-- dilengkapi 'X' bila kurang dari 3 huruf.
create or replace function public.city_code(p_city text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  k text;
  letters text;
begin
  k := lower(regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g'));
  k := regexp_replace(k, '^(kota administrasi|kota|kabupaten|kab\.?)\s+', '');
  if k = '' then
    raise exception 'Kota wajib diisi untuk membuat kode cabang.';
  end if;
  if k like 'jakarta%' then return 'JKT'; end if;
  case k
    when 'padang' then return 'PDG';
    when 'bandung' then return 'BDG';
    when 'surabaya' then return 'SBY';
    when 'medan' then return 'MDN';
    when 'semarang' then return 'SMG';
    when 'yogyakarta' then return 'YGY';
    when 'jogja' then return 'YGY';
    when 'denpasar' then return 'DPS';
    when 'makassar' then return 'MKS';
    when 'palembang' then return 'PLG';
    when 'tangerang' then return 'TGR';
    when 'tangerang selatan' then return 'TGS';
    when 'bekasi' then return 'BKS';
    when 'depok' then return 'DPK';
    when 'bogor' then return 'BGR';
    when 'malang' then return 'MLG';
    when 'batam' then return 'BTM';
    when 'pekanbaru' then return 'PKU';
    when 'balikpapan' then return 'BPN';
    when 'manado' then return 'MDO';
    when 'banjarmasin' then return 'BJM';
    when 'pontianak' then return 'PTK';
    when 'surakarta' then return 'SKT';
    when 'solo' then return 'SKT';
    when 'samarinda' then return 'SMD';
    when 'bukittinggi' then return 'BKT';
    when 'bandar lampung' then return 'BDL';
    when 'banda aceh' then return 'BNA';
    when 'jambi' then return 'JMB';
    when 'mataram' then return 'MTR';
    when 'kupang' then return 'KPG';
    when 'ambon' then return 'AMB';
    when 'jayapura' then return 'JYP';
    when 'cirebon' then return 'CRB';
    when 'tasikmalaya' then return 'TSM';
    else null;
  end case;
  letters := upper(regexp_replace(k, '[^a-z]', '', 'g'));
  return rpad(substr(letters, 1, 3), 3, 'X');
end;
$$;

-- Nomor urut berikutnya dalam satu kota. Kode lama bergaya "NN-JKT01" dan kode
-- baru "NN-JKT-01" sama-sama dihitung agar tidak ada nomor ganda.
create or replace function public.branch_next_code(p_restaurant uuid, p_city text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c text := public.city_code(p_city);
  n integer;
begin
  select coalesce(max((m.arr)[1]::integer), 0) + 1
    into n
    from public.branches b
   cross join lateral regexp_match(b.code, '^NN-' || c || '-?(\d+)$') as m(arr)
   where b.restaurant_id = p_restaurant
     and m.arr is not null;
  return 'NN-' || c || '-' || lpad(n::text, 2, '0');
end;
$$;

revoke all on function public.branch_next_code(uuid, text) from public, anon, authenticated;

-- Pratinjau kode untuk form (hanya owner). Nilai final selalu ditentukan trigger.
create or replace function public.preview_branch_code(p_city text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  r uuid;
begin
  select m.restaurant_id into r
    from public.memberships m
   where m.user_id = (select auth.uid()) and m.role = 'owner' and m.status = 'active'
   limit 1;
  if r is null then raise exception 'Hanya pemilik utama yang dapat membuat cabang.'; end if;
  return public.branch_next_code(r, p_city);
end;
$$;

revoke all on function public.preview_branch_code(text) from public, anon;
grant execute on function public.preview_branch_code(text) to authenticated;

create or replace function public.branches_assign_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      -- Kunci per restoran+kota: dua pembuatan cabang bersamaan diserialkan,
      -- sehingga nomor urut tidak pernah ganda. unique(restaurant_id, code)
      -- tetap menjadi pagar terakhir.
      perform pg_advisory_xact_lock(
        hashtextextended(new.restaurant_id::text || ':' || public.city_code(new.city), 0)
      );
      new.code := public.branch_next_code(new.restaurant_id, new.city);
    end if;
  elsif new.code is distinct from old.code then
    raise exception 'Kode cabang tidak dapat diubah setelah dibuat.';
  end if;
  return new;
end;
$$;

revoke all on function public.branches_assign_code() from public, anon, authenticated;

create trigger branches_assign_code_trg
  before insert or update on public.branches
  for each row execute function public.branches_assign_code();

-- ============================================================================
-- 3. Pengeluaran operasional
-- ============================================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid not null,
  expense_date date not null,
  category text not null check (category in ('bahan_baku', 'gaji', 'utilitas', 'sewa', 'pemasaran', 'perawatan', 'lainnya')),
  description text not null default '' check (char_length(description) <= 300),
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete cascade
);
create index expenses_branch_date_idx on public.expenses(branch_id, expense_date);

alter table public.expenses enable row level security;

create policy "branch members read expenses" on public.expenses for select to authenticated
  using (public.can_access_branch(branch_id));

create policy "owner or branch admin write expenses" on public.expenses for all to authenticated
  using (
    public.is_restaurant_owner(restaurant_id) or exists (
      select 1 from public.memberships m
       where m.restaurant_id = expenses.restaurant_id and m.branch_id = expenses.branch_id
         and m.user_id = (select auth.uid()) and m.role = 'branch_admin' and m.status = 'active'
    )
  )
  with check (
    public.is_restaurant_owner(restaurant_id) or exists (
      select 1 from public.memberships m
       where m.restaurant_id = expenses.restaurant_id and m.branch_id = expenses.branch_id
         and m.user_id = (select auth.uid()) and m.role = 'branch_admin' and m.status = 'active'
    )
  );

revoke all on public.expenses from anon, authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

-- Index pendukung laporan pendapatan.
create index if not exists orders_branch_paid_at_idx
  on public.orders(branch_id, paid_at) where payment_status = 'paid';

-- ============================================================================
-- 4. RPC laporan keuangan (SECURITY INVOKER -> RLS peran pemanggil berlaku)
-- ============================================================================
create or replace function public.report_daily(p_branch uuid, p_from date, p_to date)
returns table (
  report_date date,
  branch_id uuid,
  gross_amount numeric,
  tax_amount numeric,
  service_amount numeric,
  revenue numeric,
  tx_count bigint,
  expense_amount numeric
)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  ts_from timestamptz;
  ts_to timestamptz;
begin
  if p_from is null or p_to is null then raise exception 'Rentang tanggal wajib diisi.'; end if;
  if p_to < p_from then raise exception 'Tanggal akhir tidak boleh sebelum tanggal awal.'; end if;
  if p_to - p_from > 731 then raise exception 'Rentang laporan maksimal 2 tahun.'; end if;
  ts_from := p_from::timestamp at time zone 'Asia/Jakarta';
  ts_to := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';

  return query
  with sales as (
    select (o.paid_at at time zone 'Asia/Jakarta')::date as d,
           o.branch_id as b,
           sum(o.total_amount) as gross,
           sum(o.tax_amount) as tax,
           sum(o.service_charge_amount) as svc,
           count(*) as n
      from public.orders o
     where o.payment_status = 'paid'
       and o.status <> 'cancelled'
       and o.paid_at >= ts_from and o.paid_at < ts_to
       and (p_branch is null or o.branch_id = p_branch)
     group by 1, 2
  ), spend as (
    select e.expense_date as d, e.branch_id as b, sum(e.amount) as amt
      from public.expenses e
     where e.expense_date between p_from and p_to
       and (p_branch is null or e.branch_id = p_branch)
     group by 1, 2
  )
  select coalesce(s.d, x.d),
         coalesce(s.b, x.b),
         coalesce(s.gross, 0),
         coalesce(s.tax, 0),
         coalesce(s.svc, 0),
         coalesce(s.gross, 0) - coalesce(s.tax, 0),
         coalesce(s.n, 0),
         coalesce(x.amt, 0)
    from sales s
    full join spend x on x.d = s.d and x.b = s.b
   order by 1, 2;
end;
$$;

create or replace function public.report_payment_methods(p_branch uuid, p_from date, p_to date)
returns table (method public.payment_method, tx_count bigint, amount numeric)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  ts_from timestamptz;
  ts_to timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rentang tanggal tidak valid.'; end if;
  if p_to - p_from > 731 then raise exception 'Rentang laporan maksimal 2 tahun.'; end if;
  ts_from := p_from::timestamp at time zone 'Asia/Jakarta';
  ts_to := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';

  return query
  select p.method, count(*)::bigint, sum(p.amount)
    from public.payments p
    join public.orders o on o.id = p.order_id
   where p.status = 'paid'
     and o.payment_status = 'paid'
     and o.status <> 'cancelled'
     and p.paid_at >= ts_from and p.paid_at < ts_to
     and (p_branch is null or p.branch_id = p_branch)
   group by p.method
   order by 3 desc;
end;
$$;

create or replace function public.report_top_menus(p_branch uuid, p_from date, p_to date, p_limit integer default 5)
returns table (menu_item_id uuid, menu_name text, category text, image_url text, qty_sold bigint, sales_amount numeric)
language plpgsql stable security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  ts_from timestamptz;
  ts_to timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rentang tanggal tidak valid.'; end if;
  if p_to - p_from > 731 then raise exception 'Rentang laporan maksimal 2 tahun.'; end if;
  ts_from := p_from::timestamp at time zone 'Asia/Jakarta';
  ts_to := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';

  return query
  select oi.menu_item_id,
         max(oi.menu_name_snapshot),
         max(mi.category),
         max(mi.image_url),
         sum(oi.quantity)::bigint,
         sum(oi.unit_price * oi.quantity)
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.menu_items mi on mi.id = oi.menu_item_id
   where o.payment_status = 'paid'
     and o.status <> 'cancelled'
     and o.paid_at >= ts_from and o.paid_at < ts_to
     and (p_branch is null or o.branch_id = p_branch)
   group by oi.menu_item_id, oi.menu_name_snapshot
   order by 5 desc, 6 desc
   limit greatest(1, least(coalesce(p_limit, 5), 50));
end;
$$;

revoke all on function public.report_daily(uuid, date, date) from public, anon;
revoke all on function public.report_payment_methods(uuid, date, date) from public, anon;
revoke all on function public.report_top_menus(uuid, date, date, integer) from public, anon;
grant execute on function public.report_daily(uuid, date, date) to authenticated;
grant execute on function public.report_payment_methods(uuid, date, date) to authenticated;
grant execute on function public.report_top_menus(uuid, date, date, integer) to authenticated;

-- ============================================================================
-- 5. Storage: gambar menu
-- ============================================================================
-- Bucket publik karena gambar menu ditampilkan ke pelanggan anonim di portal.
-- Upload/ubah/hapus hanya untuk owner restoran terkait. Path wajib
-- "<restaurant_id>/<nama-file-acak>.<ext>". Batas 2 MB; hanya JPEG/PNG/WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "owners insert menu images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_restaurant_owner(((storage.foldername(name))[1])::uuid)
             else false end
  );
create policy "owners update menu images" on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_restaurant_owner(((storage.foldername(name))[1])::uuid)
             else false end
  );
create policy "owners delete menu images" on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_restaurant_owner(((storage.foldername(name))[1])::uuid)
             else false end
  );
create policy "owners select menu images" on storage.objects for select to authenticated
  using (
    bucket_id = 'menu-images'
    and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_restaurant_owner(((storage.foldername(name))[1])::uuid)
             else false end
  );

-- ============================================================================
-- 6. Portal pelanggan publik (anon)
-- ============================================================================
-- Pelanggan tidak punya akun. Semua akses lewat RPC SECURITY DEFINER yang:
--   * hanya membuka data publik (cabang aktif, menu tersedia),
--   * menghitung harga/pajak di server (klien tidak bisa menentukan harga),
--   * mensyaratkan token QR meja yang valid untuk dine-in,
--   * mensyaratkan restaurants.allow_online_takeaway untuk takeaway,
--   * memberi tracking_token acak agar pelanggan hanya bisa melihat pesanannya sendiri.
alter table public.orders
  add column if not exists tracking_token uuid not null default gen_random_uuid();

create or replace function public.portal_get_branches()
returns table (
  id uuid, name text, tagline text, address text, city text, phone text,
  operating_hours text, is_24_hours boolean, latitude numeric, longitude numeric,
  tax_percentage numeric, service_charge_percentage numeric, allow_online_takeaway boolean,
  restaurant_name text
)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.tagline, b.address, b.city, b.phone, b.operating_hours, b.is_24_hours,
         b.latitude, b.longitude, r.tax_percentage, r.service_charge_percentage,
         r.allow_online_takeaway, r.name
    from public.branches b
    join public.restaurants r on r.id = b.restaurant_id
   where b.status = 'active'
   order by b.name;
$$;

create or replace function public.portal_get_menu(p_branch uuid)
returns table (
  menu_item_id uuid, sku text, name text, category text, description text, image_url text,
  price numeric, is_popular boolean, is_spicy boolean, preparation_time_minutes integer,
  variants jsonb, addons jsonb, is_sold_out boolean
)
language sql stable security definer set search_path = '' as $$
  select mi.id, mi.sku, mi.name, mi.category, mi.description, mi.image_url, bmi.price,
         mi.is_popular, mi.is_spicy, mi.preparation_time_minutes, mi.variants, bmi.addons,
         bmi.is_sold_out_today
    from public.branch_menu_items bmi
    join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
    join public.branches b on b.id = bmi.branch_id and b.status = 'active'
   where bmi.branch_id = p_branch
     and bmi.is_available
     and mi.status = 'active'
   order by mi.category, mi.name;
$$;

create or replace function public.portal_resolve_table(p_token text)
returns table (table_id uuid, table_number text, branch_id uuid)
language sql stable security definer set search_path = '' as $$
  select t.id, t.table_number, t.branch_id
    from public.dining_tables t
    join public.branches b on b.id = t.branch_id and b.status = 'active'
   where t.qr_code_token = p_token
   limit 1;
$$;

create or replace function public.portal_create_order(
  p_branch uuid,
  p_qr_token text,
  p_order_type public.order_type,
  p_customer text,
  p_phone text,
  p_items jsonb
)
returns table (order_id uuid, order_number text, tracking_token uuid, total_amount numeric)
language plpgsql security definer set search_path = '' as $$
declare
  branch_rec public.branches%rowtype;
  rest_rec public.restaurants%rowtype;
  tbl public.dining_tables%rowtype;
  new_id uuid := gen_random_uuid();
  new_token uuid := gen_random_uuid();
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
  svc_v numeric(14,2);
  recent_count integer;
begin
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
  select * into rest_rec from public.restaurants r where r.id = branch_rec.restaurant_id;

  if p_order_type = 'dine_in' then
    select * into tbl from public.dining_tables t
     where t.qr_code_token = p_qr_token and t.branch_id = p_branch
     for update;
    if not found then raise exception 'Kode QR meja tidak valid untuk cabang ini.'; end if;
    select count(*) into recent_count from public.orders o
     where o.table_id = tbl.id and o.payment_status = 'unpaid' and o.created_at > now() - interval '10 minutes';
    if recent_count >= 5 then raise exception 'Terlalu banyak pesanan belum dibayar di meja ini. Hubungi kasir.'; end if;
  else
    if not rest_rec.allow_online_takeaway then raise exception 'Pesanan takeaway online belum dibuka.'; end if;
    select count(*) into recent_count from public.orders o
     where o.branch_id = p_branch and o.order_type = 'takeaway' and o.payment_status = 'unpaid'
       and o.created_at > now() - interval '10 minutes';
    if recent_count >= 60 then raise exception 'Cabang sedang menerima terlalu banyak pesanan. Coba lagi sebentar.'; end if;
  end if;

  code := branch_rec.code || '-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
          || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Header pesanan dibuat dulu (total diperbarui di akhir) agar FK order_items terpenuhi.
  insert into public.orders (
    id, restaurant_id, branch_id, table_id, order_number, order_type, customer_name, customer_phone,
    subtotal, tax_amount, service_charge_amount, total_amount, tracking_token
  ) values (
    new_id, branch_rec.restaurant_id, p_branch, case when p_order_type = 'dine_in' then tbl.id else null end,
    code, p_order_type, btrim(p_customer), nullif(btrim(coalesce(p_phone, '')), ''),
    0, 0, 0, 0, new_token
  );

  for item in select value from jsonb_array_elements(p_items) loop
    qty := (item ->> 'quantity')::integer;
    if qty is null or qty < 1 or qty > 50 then raise exception 'Jumlah menu tidak valid.'; end if;

    select mi.id as mid, mi.name as mname, bmi.price as mprice, bmi.addons as maddons
      into menu_rec
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
     where bmi.branch_id = p_branch
       and bmi.menu_item_id = (item ->> 'menu_item_id')::uuid
       and bmi.is_available and not bmi.is_sold_out_today and mi.status = 'active';
    if not found then raise exception 'Salah satu menu tidak tersedia di cabang ini.'; end if;

    insert into public.order_items (
      restaurant_id, branch_id, order_id, menu_item_id, menu_name_snapshot, unit_price, quantity, variant_choice, notes
    ) values (
      branch_rec.restaurant_id, p_branch, new_id, menu_rec.mid, menu_rec.mname, menu_rec.mprice, qty,
      nullif(left(coalesce(item ->> 'variant_choice', ''), 60), ''),
      nullif(left(coalesce(item ->> 'notes', ''), 200), '')
    ) returning id into item_row;

    addon_total := 0;
    for addon_req in select value from jsonb_array_elements(coalesce(item -> 'addons', '[]'::jsonb)) loop
      select c.value into addon_rec
        from jsonb_array_elements(menu_rec.maddons) as c(value)
       where c.value ->> 'id' = addon_req ->> 'id';
      if addon_rec is null then raise exception 'Tambahan menu tidak valid.'; end if;
      insert into public.order_item_addons (order_item_id, addon_name_snapshot, unit_price)
      values (item_row, addon_rec ->> 'name', (addon_rec ->> 'price')::numeric);
      addon_total := addon_total + (addon_rec ->> 'price')::numeric;
      addon_rec := null;
    end loop;

    subtotal_v := subtotal_v + (menu_rec.mprice + addon_total) * qty;
  end loop;

  tax_v := round(subtotal_v * rest_rec.tax_percentage / 100, 2);
  svc_v := round(subtotal_v * rest_rec.service_charge_percentage / 100, 2);
  update public.orders o
     set subtotal = subtotal_v, tax_amount = tax_v, service_charge_amount = svc_v,
         total_amount = subtotal_v + tax_v + svc_v
   where o.id = new_id;

  if p_order_type = 'dine_in' and tbl.status = 'available' then
    update public.dining_tables set status = 'occupied' where id = tbl.id;
  end if;

  return query select new_id, code, new_token, subtotal_v + tax_v + svc_v;
end;
$$;

create or replace function public.portal_get_order_status(p_order uuid, p_token uuid)
returns table (
  order_number text, status public.order_status, payment_status public.payment_status,
  total_amount numeric, created_at timestamptz, items jsonb
)
language sql stable security definer set search_path = '' as $$
  select o.order_number, o.status, o.payment_status, o.total_amount, o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('name', oi.menu_name_snapshot, 'quantity', oi.quantity, 'unit_price', oi.unit_price)
                            order by oi.created_at)
             from public.order_items oi where oi.order_id = o.id
         ), '[]'::jsonb)
    from public.orders o
   where o.id = p_order and o.tracking_token = p_token;
$$;

revoke all on function public.portal_get_branches() from public;
revoke all on function public.portal_get_menu(uuid) from public;
revoke all on function public.portal_resolve_table(text) from public;
revoke all on function public.portal_create_order(uuid, text, public.order_type, text, text, jsonb) from public;
revoke all on function public.portal_get_order_status(uuid, uuid) from public;
grant execute on function public.portal_get_branches() to anon, authenticated;
grant execute on function public.portal_get_menu(uuid) to anon, authenticated;
grant execute on function public.portal_resolve_table(text) to anon, authenticated;
grant execute on function public.portal_create_order(uuid, text, public.order_type, text, text, jsonb) to anon, authenticated;
grant execute on function public.portal_get_order_status(uuid, uuid) to anon, authenticated;

-- ============================================================================
-- 7. Anggota tim & email korporat
-- ============================================================================
-- Tabel profiles hanya terbaca oleh pemiliknya sendiri (RLS). Daftar anggota
-- untuk owner/admin cabang disediakan lewat RPC ini, termasuk email dan login terakhir.
create or replace function public.list_team_members()
returns table (
  user_id uuid, full_name text, phone text, email text, role public.app_role,
  branch_id uuid, branch_name text, status public.record_status,
  last_sign_in_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.full_name, p.phone, u.email::text, m.role, m.branch_id, b.name, m.status,
         u.last_sign_in_at, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    left join public.branches b on b.id = m.branch_id
   where m.restaurant_id in (
           select o.restaurant_id from public.memberships o
            where o.user_id = (select auth.uid()) and o.role = 'owner' and o.status = 'active'
         )
      or (
           m.role <> 'owner'
           and m.branch_id in (
             select a.branch_id from public.memberships a
              where a.user_id = (select auth.uid()) and a.role = 'branch_admin' and a.status = 'active'
           )
         )
   order by m.role, p.full_name;
$$;

revoke all on function public.list_team_members() from public, anon;
grant execute on function public.list_team_members() to authenticated;

-- Email korporat otomatis: <prefix-peran><identitas-cabang>@nnorte.com
--   admin  -> "admin" ; kasir -> "kasir" ; dapur -> "dapur" ; owner -> "owner"
--   identitas cabang = nama cabang tanpa awalan "NNORTE" dan tanpa bagian setelah " - ",
--                      huruf kecil, hanya a-z0-9 (mis. "NNORTE Senopati - Flagship" -> "senopati").
--   Bentrok dengan akun yang sudah ada -> suffix angka 2, 3, ... (adminsenopati2@nnorte.com).
create or replace function public.corporate_email_for(p_role public.app_role, p_branch uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  prefix text;
  ident text;
  b public.branches%rowtype;
  n integer := 1;
  candidate text;
begin
  prefix := case p_role
    when 'branch_admin' then 'admin'
    when 'cashier' then 'kasir'
    when 'kitchen' then 'dapur'
    else 'owner'
  end;
  if p_role <> 'owner' then
    select * into b from public.branches where id = p_branch;
    if not found then raise exception 'Cabang tidak ditemukan.'; end if;
    ident := lower(b.name);
    ident := regexp_replace(ident, '^\s*nnorte\s*', '');
    ident := split_part(split_part(ident, ' - ', 1), ' – ', 1);
    ident := regexp_replace(ident, '[^a-z0-9]', '', 'g');
    if ident = '' then ident := lower(regexp_replace(b.code, '[^a-zA-Z0-9]', '', 'g')); end if;
  else
    ident := '';
  end if;
  loop
    candidate := prefix || ident || case when n = 1 then '' else n::text end || '@nnorte.com';
    exit when not exists (select 1 from auth.users u where lower(u.email) = candidate);
    n := n + 1;
    if n > 500 then raise exception 'Tidak dapat membuat email unik.'; end if;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.corporate_email_for(public.app_role, uuid) from public, anon, authenticated;

-- Pratinjau untuk form (hanya owner restoran pemilik cabang).
create or replace function public.preview_corporate_email(p_role public.app_role, p_branch uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if p_role = 'owner' then raise exception 'Role pemilik utama tidak dapat dibuat melalui form ini.'; end if;
  if not exists (
    select 1 from public.branches b
     where b.id = p_branch and public.is_restaurant_owner(b.restaurant_id)
  ) then
    raise exception 'Hanya pemilik utama yang dapat membuat akun internal.';
  end if;
  return public.corporate_email_for(p_role, p_branch);
end;
$$;

revoke all on function public.preview_corporate_email(public.app_role, uuid) from public, anon;
grant execute on function public.preview_corporate_email(public.app_role, uuid) to authenticated;

-- Aktif/nonaktifkan akses anggota (owner saja; owner tidak bisa dinonaktifkan).
create or replace function public.owner_set_member_status(p_user_id uuid, p_status public.record_status)
returns void language plpgsql security definer set search_path = '' as $$
declare
  affected integer;
begin
  if p_user_id = (select auth.uid()) then raise exception 'Anda tidak dapat mengubah status akses akun sendiri.'; end if;
  update public.memberships m
     set status = p_status
   where m.user_id = p_user_id
     and m.role <> 'owner'
     and public.is_restaurant_owner(m.restaurant_id);
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Pengguna bukan anggota yang dapat dikelola oleh pemilik ini.'; end if;
end;
$$;

revoke all on function public.owner_set_member_status(uuid, public.record_status) from public, anon;
grant execute on function public.owner_set_member_status(uuid, public.record_status) to authenticated;

commit;
