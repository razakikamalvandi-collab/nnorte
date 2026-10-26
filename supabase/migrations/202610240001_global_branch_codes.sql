-- NNORTE global branch codes (2026-10-24)
--
-- Tujuan:
--   * Kode cabang aktif memakai satu urutan global per restoran:
--       NN-{KODE_KOTA}-{NOMOR_URUT}
--     Nomor urut selalu 01..N berdasarkan sort_order cabang aktif, bukan per kota.
--   * Menghapus / menonaktifkan cabang menggeser nomor cabang aktif setelahnya
--     tanpa celah. Cabang yang dihapus memakai soft delete (deleted_at) agar
--     transaksi, pembayaran, stok, anggota, dan audit historis tetap utuh.
--   * Perubahan kota hanya mengganti bagian kode kota; nomor urut tetap.
--
-- Catatan implementasi:
--   * sort_order adalah urutan eksplisit (1..N) untuk cabang aktif.
--   * archived_code menyimpan kode terakhir cabang nonaktif/terhapus.
--   * Semua operasi yang mengubah urutan memakai advisory lock per restoran
--     dan berjalan dalam satu transaksi RPC.
--   * Trigger tetap menjadi pagar terakhir: kode tidak dapat diubah langsung,
--     dan status/urutan hanya dapat diubah lewat RPC internal.
begin;

-- ============================================================================
-- 1. Kolom urutan, arsip, dan soft delete
-- ============================================================================
alter table public.branches
  add column if not exists sort_order integer,
  add column if not exists archived_code text,
  add column if not exists deleted_at timestamptz;

alter table public.branches
  drop constraint if exists branches_sort_order_positive;
alter table public.branches
  add constraint branches_sort_order_positive check (sort_order is null or sort_order > 0);

-- ============================================================================
-- 2. Singkatan kota
-- ============================================================================
-- Pemetaan eksplisit untuk kota-kota yang umum. Fallback memakai 3 huruf
-- pertama + 2 karakter hash deterministik dari nama kota, sehingga dua kota
-- yang tiga huruf awalnya sama tidak otomatis mendapat prefiks yang sama.
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

  -- DKI Jakarta sengaja dibedakan dari "Jakarta Selatan/Pusat/..." yang JKT.
  if k in ('daerah khusus ibukota jakarta', 'dki jakarta', 'jakarta raya') then
    return 'DKI';
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
    when 'daerah istimewa yogyakarta' then return 'YGY';
    when 'di yogyakarta' then return 'YGY';
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
  return rpad(substr(letters, 1, 3), 3, 'X') || upper(substr(md5(k), 1, 2));
end;
$$;

-- Nomor urut global berikutnya = jumlah cabang aktif + 1.
create or replace function public.branch_next_code(p_restaurant uuid, p_city text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  select count(*)::integer + 1
    into n
    from public.branches b
   where b.restaurant_id = p_restaurant
     and b.status = 'active'
     and b.deleted_at is null;
  return 'NN-' || public.city_code(p_city) || '-' || lpad(n::text, 2, '0');
end;
$$;

revoke all on function public.branch_next_code(uuid, text) from public, anon, authenticated;

-- ============================================================================
-- 3. Penomoran ulang global
-- ============================================================================
-- Dua fase:
--   1) parkir kode dan sort_order ke nilai sementara yang unik;
--   2) tulis kode final berdasarkan urutan lama.
-- Ini menghindari benturan unique constraint saat kode saling bertukar.
create or replace function public.branch_renumber_active(p_restaurant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant::text, 0));
  perform set_config('nnorte.branch_renumber', 'on', true);

  with ordered as (
    select b.id,
           row_number() over (order by b.sort_order nulls last, b.created_at, b.code, b.id) as rn
      from public.branches b
     where b.restaurant_id = p_restaurant
       and b.status = 'active'
       and b.deleted_at is null
  )
  update public.branches b
     set code = '__RENUM__' || b.id::text,
         sort_order = (1000000 + o.rn)::integer
    from ordered o
   where b.id = o.id;

  with ordered as (
    select b.id,
           row_number() over (order by b.sort_order, b.created_at, b.id) as rn
      from public.branches b
     where b.restaurant_id = p_restaurant
       and b.status = 'active'
       and b.deleted_at is null
  )
  update public.branches b
     set code = 'NN-' || public.city_code(b.city) || '-' || lpad(o.rn::text, 2, '0'),
         sort_order = o.rn::integer,
         archived_code = null
    from ordered o
   where b.id = o.id;

  perform set_config('nnorte.branch_renumber', 'off', true);
end;
$$;

revoke all on function public.branch_renumber_active(uuid) from public, anon, authenticated;

-- Pratinjau kode cabang baru (hanya owner). Nilai final tetap ditentukan trigger.
create or replace function public.preview_branch_code(p_city text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  r uuid;
begin
  select m.restaurant_id into r
    from public.memberships m
   where m.user_id = (select auth.uid())
     and m.role = 'owner'
     and m.status = 'active'
   limit 1;
  if r is null then raise exception 'Hanya pemilik utama yang dapat membuat cabang.'; end if;
  return public.branch_next_code(r, p_city);
end;
$$;

revoke all on function public.preview_branch_code(text) from public, anon;
grant execute on function public.preview_branch_code(text) to authenticated;

-- Pratinjau kode saat mengedit kota cabang: nomor urut tidak berubah.
create or replace function public.preview_branch_code_for(p_branch uuid, p_city text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  r uuid;
  s integer;
  st public.record_status;
  dl timestamptz;
begin
  select b.restaurant_id, b.sort_order, b.status, b.deleted_at
    into r, s, st, dl
    from public.branches b
   where b.id = p_branch;
  if r is null then raise exception 'Cabang tidak ditemukan.'; end if;
  if not public.is_restaurant_owner(r) then
    raise exception 'Hanya pemilik utama yang dapat mengubah cabang.';
  end if;
  if st <> 'active' or dl is not null or s is null then
    raise exception 'Cabang nonaktif tidak memiliki nomor urut aktif.';
  end if;
  return 'NN-' || public.city_code(p_city) || '-' || lpad(s::text, 2, '0');
end;
$$;

revoke all on function public.preview_branch_code_for(uuid, text) from public, anon;
grant execute on function public.preview_branch_code_for(uuid, text) to authenticated;

-- ============================================================================
-- 4. Trigger pembuat / penjaga kode
-- ============================================================================
-- Hapus trigger lama dulu agar migrasi data di bawah tidak diblokir aturan
-- "kode tidak dapat diubah". Trigger baru dibuat setelah data dirapikan.
drop trigger if exists branches_assign_code_trg on public.branches;

create or replace function public.branches_assign_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_max integer;
  v_next integer;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'active' then
      raise exception 'Cabang baru harus berstatus aktif.';
    end if;

    -- Serialkan pembuatan/penomoran cabang untuk restoran ini.
    perform pg_advisory_xact_lock(hashtextextended(new.restaurant_id::text, 0));

    select count(*)::integer, coalesce(max(b.sort_order), 0)
      into v_count, v_max
      from public.branches b
     where b.restaurant_id = new.restaurant_id
       and b.status = 'active'
       and b.deleted_at is null;

    -- Jika data lama memiliki celah, rapikan dulu supaya nomor baru = N + 1.
    if v_count <> v_max then
      perform public.branch_renumber_active(new.restaurant_id);
    end if;

    v_next := v_count + 1;
    new.sort_order := v_next;
    new.deleted_at := null;
    new.archived_code := null;
    new.code := 'NN-' || public.city_code(new.city) || '-' || lpad(v_next::text, 2, '0');
    return new;
  end if;

  -- Operasi internal RPC (hapus/nonaktifkan/aktifkan/penomoran ulang).
  if current_setting('nnorte.branch_renumber', true) = 'on'
     or current_setting('nnorte.branch_status', true) = 'on' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'ID cabang tidak dapat diubah.';
  end if;

  if old.deleted_at is not null then
    raise exception 'Cabang yang sudah dihapus tidak dapat diubah.';
  end if;

  if new.restaurant_id is distinct from old.restaurant_id then
    raise exception 'Restoran cabang tidak dapat diubah.';
  end if;

  if new.deleted_at is distinct from old.deleted_at
     or new.status is distinct from old.status then
    raise exception 'Status atau penghapusan cabang harus melalui fungsi khusus.';
  end if;

  if new.sort_order is distinct from old.sort_order then
    raise exception 'Urutan cabang tidak dapat diubah langsung.';
  end if;

  -- Perubahan kode langsung ditolak. Perubahan kota diperbolehkan: prefiks
  -- kode dihitung ulang dari kota baru, nomor urut tetap sama.
  if new.city is not distinct from old.city
     and new.code is distinct from old.code then
    raise exception 'Kode cabang tidak dapat diubah langsung.';
  end if;

  if new.status = 'active' then
    if new.sort_order is null then
      raise exception 'Urutan cabang aktif tidak valid.';
    end if;
    new.code := 'NN-' || public.city_code(new.city) || '-' || lpad(new.sort_order::text, 2, '0');
    new.archived_code := null;
    new.deleted_at := null;
  else
    new.sort_order := null;
    new.code := old.code;
    new.archived_code := coalesce(old.archived_code, old.code);
  end if;

  return new;
end;
$$;

revoke all on function public.branches_assign_code() from public, anon, authenticated;

-- Trigger baru dipasang setelah data lama dirapikan (bagian 6), agar migrasi
-- tidak diblokir oleh aturan "kode tidak dapat diubah".

-- ============================================================================
-- 5. RPC hapus dan ubah status
-- ============================================================================
create or replace function public.delete_branch(p_branch uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant uuid;
  v_deleted timestamptz;
begin
  select b.restaurant_id
    into v_restaurant
    from public.branches b
   where b.id = p_branch;

  if v_restaurant is null then raise exception 'Cabang tidak ditemukan.'; end if;
  if not public.is_restaurant_owner(v_restaurant) then
    raise exception 'Hanya pemilik utama yang dapat menghapus cabang.';
  end if;

  -- Kunci advisory diambil sebelum row lock agar dua admin yang menghapus
  -- cabang berbeda tidak saling menunggu row lock saat penomoran ulang.
  perform pg_advisory_xact_lock(hashtextextended(v_restaurant::text, 0));

  select b.deleted_at
    into v_deleted
    from public.branches b
   where b.id = p_branch
   for update;

  if v_deleted is not null then raise exception 'Cabang sudah dihapus.'; end if;

  perform set_config('nnorte.branch_status', 'on', true);

  update public.branches b
     set status = 'inactive',
         deleted_at = now(),
         sort_order = null,
         archived_code = coalesce(b.archived_code, b.code),
         code = 'ARSIP-' || b.id::text
   where b.id = p_branch;

  perform set_config('nnorte.branch_status', 'off', true);
  perform public.branch_renumber_active(v_restaurant);
end;
$$;

revoke all on function public.delete_branch(uuid) from public, anon;
grant execute on function public.delete_branch(uuid) to authenticated;

create or replace function public.set_branch_status(p_branch uuid, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_restaurant uuid;
  v_status public.record_status;
  v_deleted timestamptz;
  v_city text;
  v_next integer;
  v_code text;
begin
  if p_status not in ('active', 'inactive') then
    raise exception 'Status cabang tidak valid.';
  end if;

  select b.restaurant_id
    into v_restaurant
    from public.branches b
   where b.id = p_branch;

  if v_restaurant is null then raise exception 'Cabang tidak ditemukan.'; end if;
  if not public.is_restaurant_owner(v_restaurant) then
    raise exception 'Hanya pemilik utama yang dapat mengubah status cabang.';
  end if;

  -- Urutan lock sama dengan delete_branch: advisory dulu, baru row lock.
  perform pg_advisory_xact_lock(hashtextextended(v_restaurant::text, 0));

  select b.status, b.deleted_at, b.city
    into v_status, v_deleted, v_city
    from public.branches b
   where b.id = p_branch
   for update;

  if v_deleted is not null then raise exception 'Cabang yang sudah dihapus tidak dapat diaktifkan kembali.'; end if;

  if p_status = v_status::text then
    return case when v_status = 'active' then (select b.code from public.branches b where b.id = p_branch) else null end;
  end if;

  perform set_config('nnorte.branch_status', 'on', true);

  if p_status = 'inactive' then
    update public.branches b
       set status = 'inactive',
           sort_order = null,
           archived_code = coalesce(b.archived_code, b.code),
           code = 'ARSIP-' || b.id::text
     where b.id = p_branch;
    perform set_config('nnorte.branch_status', 'off', true);
    perform public.branch_renumber_active(v_restaurant);
    return null;
  end if;

  -- Rapikan celah data lama sebelum menambahkan cabang yang diaktifkan lagi;
  -- tanpa ini v_next bisa bentrok dengan sort_order/kode yang masih ada.
  perform public.branch_renumber_active(v_restaurant);

  select count(*)::integer + 1
    into v_next
    from public.branches b
   where b.restaurant_id = v_restaurant
     and b.status = 'active'
     and b.deleted_at is null;

  v_code := 'NN-' || public.city_code(v_city) || '-' || lpad(v_next::text, 2, '0');

  update public.branches b
     set status = 'active',
         deleted_at = null,
         sort_order = v_next,
         archived_code = null,
         code = v_code
   where b.id = p_branch;

  perform set_config('nnorte.branch_status', 'off', true);
  perform public.branch_renumber_active(v_restaurant);

  select b.code into v_code from public.branches b where b.id = p_branch;
  return v_code;
end;
$$;

revoke all on function public.set_branch_status(uuid, text) from public, anon;
grant execute on function public.set_branch_status(uuid, text) to authenticated;

-- ============================================================================
-- 6. Rapikan data lama
-- ============================================================================
-- Data dari versi sebelum kolom jam terstruktur dapat menyimpan "24 Jam"
-- hanya di operating_hours, sementara is_24_hours masih false dan jam kosong.
-- Sinkronkan dulu agar update kode/urutan tidak melanggar
-- branches_hours_consistent.
update public.branches b
   set is_24_hours = true,
       opening_time = null,
       closing_time = null
 where not b.is_24_hours
   and b.operating_hours ~* '(^|[^0-9])24\s*jam';

-- Lengkapi jam terstruktur yang masih kosong dari teks lama.
update public.branches b
   set opening_time = (m.arr)[1]::time,
       closing_time = (m.arr)[2]::time
  from (
    select id, regexp_match(operating_hours, '(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})') as arr
      from public.branches
     where not is_24_hours
  ) m
 where m.id = b.id
   and m.arr is not null
   and (b.opening_time is null or b.closing_time is null);

-- Hentikan migrasi dengan pesan jelas bila masih ada jam yang tidak lengkap.
do $$
declare
  v_ids text;
begin
  select string_agg(b.id::text, ', ' order by b.created_at, b.id)
    into v_ids
    from public.branches b
   where not b.is_24_hours
     and (b.opening_time is null or b.closing_time is null or b.opening_time = b.closing_time);
  if v_ids is not null then
    raise exception 'Jam operasional cabang belum konsisten untuk id: %. Lengkapi is_24_hours atau opening_time/closing_time sebelum migrasi.', v_ids;
  end if;
end $$;

-- Nonaktif/terhapus: simpan kode lama di archived_code, lalu pakai kode arsip
-- unik agar tidak bentrok dengan kode aktif yang dinomori ulang.
update public.branches b
   set archived_code = coalesce(b.archived_code, b.code),
       code = 'ARSIP-' || b.id::text,
       sort_order = null
 where (b.status <> 'active' or b.deleted_at is not null)
   and b.code not like 'ARSIP-%';

update public.branches b
   set archived_code = null
 where b.status = 'active'
   and b.deleted_at is null;

-- Nomor urut awal: pertahankan urutan kode lama (urutan yang selama ini
-- ditampilkan) lalu tulis ulang semua kode aktif secara global.
do $$
declare
  r record;
begin
  for r in
    select distinct b.restaurant_id
      from public.branches b
     where b.status = 'active'
       and b.deleted_at is null
  loop
    perform public.branch_renumber_active(r.restaurant_id);
  end loop;
end $$;

create trigger branches_assign_code_trg
  before insert or update on public.branches
  for each row execute function public.branches_assign_code();

-- ============================================================================
-- 7. Constraint, index, dan hak akses
-- ============================================================================
create unique index if not exists branches_restaurant_active_order_key
  on public.branches (restaurant_id, sort_order)
  where status = 'active' and deleted_at is null;

create index if not exists branches_restaurant_deleted_idx
  on public.branches (restaurant_id, deleted_at);

-- Hard delete tidak lagi dipakai. Penghapusan wajib lewat delete_branch()
-- agar data historis dan penomoran ulang tetap konsisten.
revoke delete on public.branches from authenticated;

commit;
