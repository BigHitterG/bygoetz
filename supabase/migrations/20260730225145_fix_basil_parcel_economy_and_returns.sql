-- Make each 4x4 My Garden clearing carry its fair share of the Care paid for
-- the classic expansion that opened it. Returned clearings become reclaimable
-- at the same price, while new Caretaker-shaped clearings use a per-parcel
-- price instead of the price of an entire classic strip.

alter table public.garden_unlocked_parcels
  drop constraint if exists garden_unlocked_parcel_source_check;

alter table public.garden_unlocked_parcels
  add constraint garden_unlocked_parcel_source_check
  check (source in ('starter','legacy','classic','freeform'));

create table if not exists public.garden_returned_parcels (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  parcel_x integer not null,
  parcel_y integer not null,
  purchase_ordinal integer,
  care_cost integer not null,
  source text not null,
  returned_at timestamptz not null default now(),
  primary key (steward_id, parcel_x, parcel_y),
  constraint garden_returned_parcel_coordinate_check check (
    parcel_x between -25000 and 25000 and parcel_y between -25000 and 25000
  ),
  constraint garden_returned_parcel_cost_check check (care_cost >= 0),
  constraint garden_returned_parcel_source_check check (
    source in ('legacy','classic','freeform')
  )
);

alter table public.garden_returned_parcels enable row level security;
revoke all on table public.garden_returned_parcels from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_returned_parcels to service_role;

comment on table public.garden_returned_parcels is
  'Private My Garden clearing receipts. Returning a 4x4 clearing records the exact refundable Care so the same land can be reclaimed at the same price.';

create or replace function public.get_my_garden_classic_expansion_cost_v1(
  p_plot_level integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select case p_plot_level
    when 1 then 30
    when 2 then 50
    when 3 then 75
    when 4 then 100
    else least(
      2000000000::bigint,
      100::bigint
        + 25 * greatest(p_plot_level - 4, 0)::bigint
        + (
          5
          * greatest(p_plot_level - 4, 0)::bigint
          * (greatest(p_plot_level - 4, 0)::bigint + 1)
        ) / 2
    )::integer
  end
$$;

create or replace function public.get_my_garden_parcel_purchase_ordinal_v1(
  p_parcel_x integer,
  p_parcel_y integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select greatest(
    case
      when p_parcel_x between 0 and 2 then 1
      when p_parcel_x > 2 then 4 * (p_parcel_x - 2) - 2
      else 4 * (-p_parcel_x)
    end,
    case
      when p_parcel_y between 0 and 3 then 1
      when p_parcel_y > 3 then 4 * (p_parcel_y - 3) - 1
      else 4 * (-p_parcel_y) + 1
    end
  )
$$;

create or replace function public.get_my_garden_classic_strip_size_v1(
  p_new_plot_level integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  with levels as (
    select
      greatest(p_new_plot_level - 2, 0) as old_expansions,
      greatest(p_new_plot_level - 1, 0) as new_expansions
  )
  select greatest(
    1,
    (
      3 + (new_expansions + 1) / 4 + (new_expansions + 3) / 4
    ) * (
      4 + new_expansions / 4 + (new_expansions + 2) / 4
    ) - (
      3 + (old_expansions + 1) / 4 + (old_expansions + 3) / 4
    ) * (
      4 + old_expansions / 4 + (old_expansions + 2) / 4
    )
  )::integer
  from levels
$$;

create or replace function public.get_my_garden_classic_parcel_cost_v1(
  p_parcel_x integer,
  p_parcel_y integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  with parcel as (
    select public.get_my_garden_parcel_purchase_ordinal_v1(
      p_parcel_x,
      p_parcel_y
    ) as purchase_ordinal
  ), ranked as (
    select
      x,
      y,
      parcel.purchase_ordinal,
      public.get_my_garden_classic_expansion_cost_v1(
        parcel.purchase_ordinal - 1
      ) as expansion_cost,
      public.get_my_garden_classic_strip_size_v1(
        parcel.purchase_ordinal
      ) as strip_size,
      row_number() over (order by y, x)::integer as parcel_index
    from parcel
    cross join lateral generate_series(
      -((greatest(parcel.purchase_ordinal - 1, 0) + 1) / 4),
      2 + ((greatest(parcel.purchase_ordinal - 1, 0) + 3) / 4)
    ) x
    cross join lateral generate_series(
      -(greatest(parcel.purchase_ordinal - 1, 0) / 4),
      3 + ((greatest(parcel.purchase_ordinal - 1, 0) + 2) / 4)
    ) y
    where public.get_my_garden_parcel_purchase_ordinal_v1(x, y)
      = parcel.purchase_ordinal
  )
  select case
    when purchase_ordinal = 1 then 0
    else expansion_cost / strip_size
      + case when parcel_index <= expansion_cost % strip_size then 1 else 0 end
  end
  from ranked
  where x = p_parcel_x and y = p_parcel_y
$$;

create or replace function public.get_my_garden_freeform_parcel_cost_v1(
  p_plot_level integer
)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select greatest(
    1,
    ceil(
      public.get_my_garden_classic_expansion_cost_v1(p_plot_level)::numeric
      / public.get_my_garden_classic_strip_size_v1(p_plot_level + 1)
    )::integer
  )
$$;

-- Give every previously opened classic parcel its deterministic share of the
-- original strip price. The twelve starter parcels remain free and permanent.
update public.garden_unlocked_parcels
set
  purchase_ordinal = public.get_my_garden_parcel_purchase_ordinal_v1(
    parcel_x,
    parcel_y
  ),
  care_cost = public.get_my_garden_classic_parcel_cost_v1(parcel_x, parcel_y)
where source = 'legacy';

-- Preserve intentional holes that predate the most recent classic expansion.
-- These are returned clearings, so credit the refund that the old function
-- omitted and retain a receipt for same-price reclamation.
with progress as (
  select
    member.steward_id,
    member.plot_level,
    greatest(member.plot_level - 1, 0) as expansions
  from public.garden_member_progress member
), expected as (
  select
    progress.steward_id,
    progress.plot_level,
    x as parcel_x,
    y as parcel_y,
    public.get_my_garden_parcel_purchase_ordinal_v1(x, y) as purchase_ordinal
  from progress
  cross join lateral generate_series(
    -((progress.expansions + 1) / 4),
    2 + ((progress.expansions + 3) / 4)
  ) x
  cross join lateral generate_series(
    -(progress.expansions / 4),
    3 + ((progress.expansions + 2) / 4)
  ) y
), inserted as (
  insert into public.garden_returned_parcels (
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source
  )
  select
    expected.steward_id,
    expected.parcel_x,
    expected.parcel_y,
    expected.purchase_ordinal,
    public.get_my_garden_classic_parcel_cost_v1(
      expected.parcel_x,
      expected.parcel_y
    ),
    'classic'
  from expected
  left join public.garden_unlocked_parcels unlocked
    on unlocked.steward_id = expected.steward_id
    and unlocked.parcel_x = expected.parcel_x
    and unlocked.parcel_y = expected.parcel_y
  where unlocked.steward_id is null
    and expected.purchase_ordinal < expected.plot_level
  on conflict (steward_id, parcel_x, parcel_y) do nothing
  returning steward_id, care_cost
), refunds as (
  select steward_id, sum(care_cost)::integer as care_refund
  from inserted
  group by steward_id
)
update public.garden_member_progress member
set
  care_balance = member.care_balance + refunds.care_refund,
  updated_at = now()
from refunds
where member.steward_id = refunds.steward_id;

-- Repair the latest classic purchase if it advanced plot_level before the old
-- parcel synchronizer no-op'd. The inserted parcel costs sum to the exact Care
-- already deducted for that classic strip.
with progress as (
  select
    member.steward_id,
    member.plot_level,
    greatest(member.plot_level - 1, 0) as expansions
  from public.garden_member_progress member
), expected as (
  select
    progress.steward_id,
    progress.plot_level,
    x as parcel_x,
    y as parcel_y
  from progress
  cross join lateral generate_series(
    -((progress.expansions + 1) / 4),
    2 + ((progress.expansions + 3) / 4)
  ) x
  cross join lateral generate_series(
    -(progress.expansions / 4),
    3 + ((progress.expansions + 2) / 4)
  ) y
)
insert into public.garden_unlocked_parcels (
  steward_id,
  parcel_x,
  parcel_y,
  purchase_ordinal,
  care_cost,
  source
)
select
  expected.steward_id,
  expected.parcel_x,
  expected.parcel_y,
  expected.plot_level,
  public.get_my_garden_classic_parcel_cost_v1(
    expected.parcel_x,
    expected.parcel_y
  ),
  'classic'
from expected
left join public.garden_unlocked_parcels unlocked
  on unlocked.steward_id = expected.steward_id
  and unlocked.parcel_x = expected.parcel_x
  and unlocked.parcel_y = expected.parcel_y
where unlocked.steward_id is null
  and public.get_my_garden_parcel_purchase_ordinal_v1(
    expected.parcel_x,
    expected.parcel_y
  ) = expected.plot_level
on conflict (steward_id, parcel_x, parcel_y) do nothing;

create or replace function public.sync_my_garden_classic_expansion_v1(
  p_steward_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  expansions integer;
begin
  select * into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  if not found or progress.plot_level <= 1 then return; end if;
  expansions := progress.plot_level - 1;

  insert into public.garden_unlocked_parcels (
    steward_id,
    parcel_x,
    parcel_y,
    purchase_ordinal,
    care_cost,
    source
  )
  select
    p_steward_id,
    x,
    y,
    progress.plot_level,
    public.get_my_garden_classic_parcel_cost_v1(x, y),
    'classic'
  from generate_series(
    -((expansions + 1) / 4),
    2 + ((expansions + 3) / 4)
  ) x
  cross join generate_series(
    -(expansions / 4),
    3 + ((expansions + 2) / 4)
  ) y
  where public.get_my_garden_parcel_purchase_ordinal_v1(x, y)
    = progress.plot_level
  on conflict (steward_id, parcel_x, parcel_y) do nothing;
end;
$$;

-- Keep the Care charge and parcel creation in the same transaction. Calling
-- these as two separate RPCs is what allowed a successful purchase to leave
-- the parcel ledger incomplete.
create or replace function public.expand_my_garden_with_parcels_v1(
  p_steward_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.expand_my_garden(p_steward_id);
  perform public.sync_my_garden_classic_expansion_v1(p_steward_id);
  return result;
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
  progress public.garden_member_progress%rowtype;
  remaining_count integer;
  connected_count integer;
  refund integer := 0;
begin
  perform public.ensure_my_garden_parcels_v1(p_steward_id);
  select * into parcel
  from public.garden_unlocked_parcels
  where steward_id = p_steward_id
    and parcel_x = p_parcel_x
    and parcel_y = p_parcel_y
  for update;

  if not found then
    raise exception 'That clearing is not part of My Garden.' using errcode = 'P0002';
  end if;
  if parcel.source = 'starter' then
    raise exception 'Your original garden clearing always stays.' using errcode = '42501';
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
  if remaining_count < 12 then
    raise exception 'My Garden must keep its original clearing.' using errcode = '42501';
  end if;

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
    if not found or profile.ordinary_footprint_capacity < 175 then
      raise exception 'Reach Caretaker to shape freeform garden clearings.' using errcode = '42501';
    end if;
    if progress.plot_level < 5 then
      raise exception 'Open the starter garden parcels first.' using errcode = '42501';
    end if;
    expansion_cost := public.get_my_garden_freeform_parcel_cost_v1(
      progress.plot_level
    );
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

revoke all on function public.get_my_garden_classic_expansion_cost_v1(integer)
  from public, anon, authenticated;
revoke all on function public.get_my_garden_parcel_purchase_ordinal_v1(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_my_garden_classic_strip_size_v1(integer)
  from public, anon, authenticated;
revoke all on function public.get_my_garden_classic_parcel_cost_v1(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_my_garden_freeform_parcel_cost_v1(integer)
  from public, anon, authenticated;
revoke all on function public.sync_my_garden_classic_expansion_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.expand_my_garden_with_parcels_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.return_my_garden_clearing_v1(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.expand_my_garden_freeform_v1(uuid, integer, integer)
  from public, anon, authenticated;

grant execute on function public.get_my_garden_classic_expansion_cost_v1(integer)
  to service_role;
grant execute on function public.get_my_garden_parcel_purchase_ordinal_v1(integer, integer)
  to service_role;
grant execute on function public.get_my_garden_classic_strip_size_v1(integer)
  to service_role;
grant execute on function public.get_my_garden_classic_parcel_cost_v1(integer, integer)
  to service_role;
grant execute on function public.get_my_garden_freeform_parcel_cost_v1(integer)
  to service_role;
grant execute on function public.sync_my_garden_classic_expansion_v1(uuid)
  to service_role;
grant execute on function public.expand_my_garden_with_parcels_v1(uuid)
  to service_role;
grant execute on function public.return_my_garden_clearing_v1(uuid, integer, integer)
  to service_role;
grant execute on function public.expand_my_garden_freeform_v1(uuid, integer, integer)
  to service_role;

