-- Land progression has two stages:
-- 1. Helper + the protected spiral core can shape new 4x4 parcels.
-- 2. Caretaker can return purchased parcels outside that core.
-- A parcel's recorded Care cost is used for purchase, refund, and reclaim.

-- The earlier ungated return control was available before it was earned.
-- Restore every parcel returned under that short-lived rule and reverse the
-- matching refund so affected gardens return to their exact prior value.
do $$
declare
  insufficient_balance boolean;
begin
  select exists (
    select 1
    from (
      select steward_id, sum(care_cost)::integer as refund
      from public.garden_returned_parcels
      group by steward_id
    ) returned
    join public.garden_member_progress progress
      on progress.steward_id = returned.steward_id
    where progress.care_balance < returned.refund
  ) into insufficient_balance;

  if insufficient_balance then
    raise exception 'A returned parcel refund has already been spent; restore it manually before applying this migration.';
  end if;

  with refunds as (
    select steward_id, sum(care_cost)::integer as refund
    from public.garden_returned_parcels
    group by steward_id
  )
  update public.garden_member_progress progress
  set
    care_balance = progress.care_balance - refunds.refund,
    updated_at = now()
  from refunds
  where progress.steward_id = refunds.steward_id;

  insert into public.garden_unlocked_parcels (
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source
  )
  select
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source
  from public.garden_returned_parcels
  on conflict (steward_id, parcel_x, parcel_y) do nothing;

  delete from public.garden_returned_parcels;
end;
$$;

create or replace function public.return_my_garden_clearing_v1(
  p_steward_id uuid,
  p_parcel_x integer,
  p_parcel_y integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  parcel public.garden_unlocked_parcels%rowtype;
  profile public.garden_stewardship_profiles%rowtype;
  progress public.garden_member_progress%rowtype;
  remaining_count integer;
  connected_count integer;
  refund integer := 0;
begin
  perform public.ensure_my_garden_parcels_v1(p_steward_id);

  select * into profile
  from public.garden_stewardship_profiles
  where steward_id = p_steward_id;
  if not found or profile.ordinary_footprint_capacity < 175 then
    raise exception 'Reach Caretaker to return shaped garden land.' using errcode = '42501';
  end if;

  select * into parcel
  from public.garden_unlocked_parcels
  where steward_id = p_steward_id
    and parcel_x = p_parcel_x
    and parcel_y = p_parcel_y
  for update;

  if not found then
    raise exception 'That clearing is not part of My Garden.' using errcode = 'P0002';
  end if;
  if parcel.source = 'starter' or coalesce(parcel.purchase_ordinal, 1) <= 5 then
    raise exception 'The spiral core around your house always stays.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.garden_personal_plants
    where steward_id = p_steward_id
      and grid_x between p_parcel_x * 4 and p_parcel_x * 4 + 3
      and grid_y between p_parcel_y * 4 and p_parcel_y * 4 + 3
  ) or exists (
    select 1 from public.garden_personal_paths
    where steward_id = p_steward_id
      and grid_x between p_parcel_x * 4 and p_parcel_x * 4 + 3
      and grid_y between p_parcel_y * 4 and p_parcel_y * 4 + 3
  ) or exists (
    select 1
    from public.garden_personal_elements element
    join public.garden_personal_element_catalog catalog
      on catalog.element_type = element.element_type
    where element.steward_id = p_steward_id
      and element.grid_x <= p_parcel_x * 4 + 3
      and element.grid_x + catalog.footprint_width - 1 >= p_parcel_x * 4
      and element.grid_y <= p_parcel_y * 4 + 3
      and element.grid_y + catalog.footprint_height - 1 >= p_parcel_y * 4
  ) then
    raise exception 'Clear every plant, path, and item before returning this land.' using errcode = 'P0001';
  end if;

  select count(*)::integer into remaining_count
  from public.garden_unlocked_parcels
  where steward_id = p_steward_id
    and (parcel_x <> p_parcel_x or parcel_y <> p_parcel_y);

  with recursive connected(parcel_x, parcel_y) as (
    (
      select candidate.parcel_x, candidate.parcel_y
      from public.garden_unlocked_parcels candidate
      where candidate.steward_id = p_steward_id
        and (
          candidate.parcel_x <> p_parcel_x
          or candidate.parcel_y <> p_parcel_y
        )
      order by candidate.parcel_y, candidate.parcel_x
      limit 1
    )
    union
    select candidate.parcel_x, candidate.parcel_y
    from public.garden_unlocked_parcels candidate
    join connected current_parcel on
      abs(candidate.parcel_x - current_parcel.parcel_x)
      + abs(candidate.parcel_y - current_parcel.parcel_y) = 1
    where candidate.steward_id = p_steward_id
      and (
        candidate.parcel_x <> p_parcel_x
        or candidate.parcel_y <> p_parcel_y
      )
  )
  select count(*)::integer into connected_count from connected;
  if connected_count <> remaining_count then
    raise exception 'That clearing connects two parts of My Garden and cannot be returned yet.' using errcode = 'P0001';
  end if;

  select * into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  refund := parcel.care_cost;
  insert into public.garden_returned_parcels (
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source,
    returned_at
  ) values (
    p_steward_id,
    p_parcel_x,
    p_parcel_y,
    parcel.purchase_ordinal,
    refund,
    parcel.source,
    now()
  )
  on conflict (steward_id, parcel_x, parcel_y) do update set
    purchase_ordinal = excluded.purchase_ordinal,
    care_cost = excluded.care_cost,
    source = excluded.source,
    returned_at = excluded.returned_at;

  delete from public.garden_unlocked_parcels
  where steward_id = p_steward_id
    and parcel_x = p_parcel_x
    and parcel_y = p_parcel_y;

  update public.garden_member_progress
  set care_balance = care_balance + refund, updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'parcelX', p_parcel_x,
    'parcelY', p_parcel_y,
    'careRefund', refund,
    'careBalance', progress.care_balance + refund
  );
end;
$$;

create or replace function public.expand_my_garden_freeform_v1(
  p_steward_id uuid,
  p_parcel_x integer,
  p_parcel_y integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.garden_stewardship_profiles%rowtype;
  progress public.garden_member_progress%rowtype;
  returned public.garden_returned_parcels%rowtype;
  expansion_cost integer;
  parcel_source text := 'freeform';
  parcel_purchase_ordinal integer := null;
begin
  perform public.ensure_my_garden_parcels_v1(p_steward_id);
  select * into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  select * into returned
  from public.garden_returned_parcels
  where steward_id = p_steward_id
    and parcel_x = p_parcel_x
    and parcel_y = p_parcel_y
  for update;

  if not found then
    select * into profile
    from public.garden_stewardship_profiles
    where steward_id = p_steward_id;
    if not found or profile.ordinary_footprint_capacity < 125 then
      raise exception 'Reach Helper to shape individual garden clearings.' using errcode = '42501';
    end if;
    if progress.plot_level < 5 then
      raise exception 'Grow the protected spiral core around your house first.' using errcode = '42501';
    end if;
    expansion_cost := public.get_my_garden_freeform_parcel_cost_v1(
      progress.plot_level
    );
    select greatest(coalesce(max(purchase_ordinal), 5) + 1, 6)
    into parcel_purchase_ordinal
    from public.garden_unlocked_parcels
    where steward_id = p_steward_id;
  else
    expansion_cost := returned.care_cost;
    parcel_source := returned.source;
    parcel_purchase_ordinal := returned.purchase_ordinal;
  end if;

  if exists (
    select 1 from public.garden_unlocked_parcels
    where steward_id = p_steward_id
      and parcel_x = p_parcel_x
      and parcel_y = p_parcel_y
  ) then
    raise exception 'That clearing is already part of My Garden.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.garden_unlocked_parcels
    where steward_id = p_steward_id
      and (
        (parcel_x = p_parcel_x - 1 and parcel_y = p_parcel_y)
        or (parcel_x = p_parcel_x + 1 and parcel_y = p_parcel_y)
        or (parcel_x = p_parcel_x and parcel_y = p_parcel_y - 1)
        or (parcel_x = p_parcel_x and parcel_y = p_parcel_y + 1)
      )
  ) then
    raise exception 'Choose a forest clearing touching your garden.' using errcode = '22023';
  end if;
  if progress.care_balance < expansion_cost then
    raise exception 'Earn more Care in the Community Garden before expanding.' using errcode = '22000';
  end if;

  insert into public.garden_unlocked_parcels (
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source
  ) values (
    p_steward_id,
    p_parcel_x,
    p_parcel_y,
    parcel_purchase_ordinal,
    expansion_cost,
    parcel_source
  );

  delete from public.garden_returned_parcels
  where steward_id = p_steward_id
    and parcel_x = p_parcel_x
    and parcel_y = p_parcel_y;

  update public.garden_member_progress
  set care_balance = care_balance - expansion_cost, updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'careBalance', progress.care_balance - expansion_cost,
    'plotLevel', progress.plot_level,
    'parcelX', p_parcel_x,
    'parcelY', p_parcel_y,
    'careCost', expansion_cost
  );
end;
$$;

revoke all on function public.return_my_garden_clearing_v1(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.expand_my_garden_freeform_v1(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.return_my_garden_clearing_v1(uuid, integer, integer)
  to service_role;
grant execute on function public.expand_my_garden_freeform_v1(uuid, integer, integer)
  to service_role;
