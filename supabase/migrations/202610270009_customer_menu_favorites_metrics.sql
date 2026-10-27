begin;

create table if not exists public.customer_menu_favorites (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, menu_item_id)
);

create index if not exists customer_menu_favorites_menu_idx
  on public.customer_menu_favorites (menu_item_id);

alter table public.customer_menu_favorites enable row level security;
revoke all on public.customer_menu_favorites from public, anon, authenticated;

create or replace function public.portal_get_menu_metrics(p_branch uuid)
returns table (
  menu_item_id uuid,
  average_rating numeric,
  review_count bigint,
  order_count bigint,
  is_favorite boolean
)
language sql stable security definer set search_path = '' as $$
  with eligible_menu as (
    select bmi.menu_item_id
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
      join public.branches b on b.id = bmi.branch_id and b.status = 'active'
     where bmi.branch_id = p_branch
       and bmi.is_available
       and mi.status = 'active'
  )
  select em.menu_item_id,
         coalesce(r.average_rating, 0)::numeric,
         coalesce(r.review_count, 0)::bigint,
         coalesce(o.order_count, 0)::bigint,
         case when auth.uid() is null then false else exists (
           select 1 from public.customer_menu_favorites f
            where f.customer_id = auth.uid() and f.menu_item_id = em.menu_item_id
         ) end
    from eligible_menu em
    left join lateral (
      with item_ratings as (
        select rating.id, rating.rating, rating.created_at
          from public.order_items oi
          join public.orders ord on ord.id = oi.order_id
          join public.order_ratings rating on rating.order_item_id = oi.id
         where oi.menu_item_id = em.menu_item_id
           and ord.branch_id = p_branch
           and ord.status = 'completed'
      ), order_ratings as (
        -- Rating keseluruhan pesanan dipakai untuk item yang belum memiliki
        -- rating khusus, agar ulasan lama ikut tercermin di katalog.
        select rating.id, rating.rating, rating.created_at
          from public.order_ratings rating
          join public.orders ord on ord.id = rating.order_id
         where rating.order_item_id is null
           and ord.branch_id = p_branch
           and ord.status = 'completed'
           and exists (
             select 1 from public.order_items oi
              where oi.order_id = ord.id and oi.menu_item_id = em.menu_item_id
           )
           and not exists (
             select 1
               from public.order_items oi
               join public.order_ratings item_rating on item_rating.order_item_id = oi.id
              where oi.order_id = ord.id and oi.menu_item_id = em.menu_item_id
           )
      ), all_ratings as (
        select * from item_ratings
        union all
        select * from order_ratings
      )
      select round(avg(all_ratings.rating)::numeric, 1) as average_rating,
             count(all_ratings.id) as review_count
        from all_ratings
    ) r on true
    left join lateral (
      -- Satu pesanan dihitung satu kali per menu, berapa pun jumlah porsinya.
      select count(distinct ord.id) as order_count
        from public.order_items oi
        join public.orders ord on ord.id = oi.order_id
       where oi.menu_item_id = em.menu_item_id
         and ord.branch_id = p_branch
         and ord.status <> 'cancelled'
         and ord.payment_status <> 'refunded'
    ) o on true;
$$;

create or replace function public.portal_set_menu_favorite(
  p_branch uuid,
  p_menu_item uuid,
  p_favorite boolean
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not exists (select 1 from public.profiles p where p.id = actor) then
    raise exception 'Silakan masuk dengan akun pelanggan untuk menyimpan menu.';
  end if;

  if exists (
    select 1
      from public.memberships m
      join public.branches b on b.restaurant_id = m.restaurant_id
     where m.user_id = actor
       and m.status = 'active'
       and b.id = p_branch
  ) then
    raise exception 'Fitur favorit hanya tersedia untuk akun pelanggan.';
  end if;

  if not exists (
    select 1
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
      join public.branches b on b.id = bmi.branch_id and b.status = 'active'
     where bmi.branch_id = p_branch
       and bmi.menu_item_id = p_menu_item
       and bmi.is_available
       and mi.status = 'active'
  ) then
    raise exception 'Menu tidak tersedia di cabang ini.';
  end if;

  if p_favorite then
    insert into public.customer_menu_favorites (customer_id, menu_item_id)
    values (actor, p_menu_item)
    on conflict (customer_id, menu_item_id) do nothing;
  else
    delete from public.customer_menu_favorites
     where customer_id = actor and menu_item_id = p_menu_item;
  end if;

  return p_favorite;
end;
$$;

revoke all on function public.portal_get_menu_metrics(uuid) from public;
revoke all on function public.portal_set_menu_favorite(uuid, uuid, boolean) from public, anon;
grant execute on function public.portal_get_menu_metrics(uuid) to anon, authenticated;
grant execute on function public.portal_set_menu_favorite(uuid, uuid, boolean) to authenticated;

commit;
