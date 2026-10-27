begin;

create or replace function public.portal_get_menu_reviews(p_branch uuid, p_menu_item uuid)
returns table (average_rating numeric, review_count bigint, reviews jsonb)
language sql stable security definer set search_path = '' as $$
  with eligible_menu as (
    select bmi.menu_item_id
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id and mi.restaurant_id = bmi.restaurant_id
      join public.branches b on b.id = bmi.branch_id and b.status = 'active'
     where bmi.branch_id = p_branch and bmi.menu_item_id = p_menu_item
       and bmi.is_available and mi.status = 'active'
  ), matching_ratings as (
    select r.rating, r.review, r.created_at
      from public.order_ratings r
      join public.orders o on o.id = r.order_id and o.status = 'completed'
     where r.order_item_id is null
       and exists (
         select 1 from public.order_items oi
         join eligible_menu em on em.menu_item_id = oi.menu_item_id
         where oi.order_id = r.order_id
       )
  )
  select coalesce(round(avg(m.rating)::numeric, 1), 0), count(m.rating),
         coalesce((
           select jsonb_agg(jsonb_build_object('rating', recent.rating, 'review', recent.review, 'created_at', recent.created_at)
                            order by recent.created_at desc)
             from (
               select mr.rating, mr.review, mr.created_at
                 from matching_ratings mr
                where mr.review is not null
                order by mr.created_at desc
                limit 8
             ) recent
         ), '[]'::jsonb)
    from matching_ratings m;
$$;

revoke all on function public.portal_get_menu_reviews(uuid, uuid) from public;
grant execute on function public.portal_get_menu_reviews(uuid, uuid) to anon, authenticated;

commit;
