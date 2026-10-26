begin;

create or replace function public.owner_update_member_access(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_role public.app_role,
  p_branch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid;
begin
  if p_role = 'owner' then
    raise exception 'Role pemilik utama tidak dapat diberikan atau diubah melalui form ini.';
  end if;

  select m.restaurant_id
    into target_restaurant_id
    from public.memberships m
   where m.user_id = p_user_id
     and m.role <> 'owner'
     and public.is_restaurant_owner(m.restaurant_id)
   order by m.created_at desc
   limit 1;

  if target_restaurant_id is null then
    raise exception 'Pengguna bukan anggota yang dapat dikelola oleh pemilik ini.';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Nama pengguna wajib diisi.';
  end if;

  if not exists (
    select 1 from public.branches b
     where b.id = p_branch_id
       and b.restaurant_id = target_restaurant_id
  ) then
    raise exception 'Cabang tidak valid untuk restoran ini.';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         phone = nullif(trim(p_phone), '')
   where id = p_user_id;

  if not found then
    raise exception 'Profil pengguna tidak ditemukan.';
  end if;

  update public.memberships
     set role = p_role,
         branch_id = p_branch_id
   where user_id = p_user_id
     and restaurant_id = target_restaurant_id
     and role <> 'owner';
end;
$$;

revoke all on function public.owner_update_member_access(uuid, text, text, public.app_role, uuid) from public;
grant execute on function public.owner_update_member_access(uuid, text, text, public.app_role, uuid) to authenticated;

commit;
