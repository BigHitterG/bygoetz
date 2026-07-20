create table public.garden_personal_elements (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  grid_x integer not null check (grid_x between -100000 and 100000),
  grid_y integer not null check (grid_y between -100000 and 100000),
  element_type text not null check (
    element_type in ('birdhouse', 'bench', 'stone_paver')
  ),
  care_cost integer not null check (
    (element_type = 'birdhouse' and care_cost = 6)
    or (element_type = 'bench' and care_cost = 10)
    or (element_type = 'stone_paver' and care_cost = 1)
  ),
  placed_at timestamptz not null default now(),
  constraint garden_personal_elements_spot_unique
    unique (steward_id, grid_x, grid_y)
);

create index garden_personal_elements_steward_placed_idx
  on public.garden_personal_elements (steward_id, placed_at);

alter table public.garden_personal_elements enable row level security;
revoke all on table public.garden_personal_elements
  from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_personal_elements
  to service_role;

comment on table public.garden_personal_elements is
  'Private, saved My Garden items placed on individual tiles. Items can be rearranged without losing Care.';

create or replace function public.enforce_my_garden_tile_occupancy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'garden_personal_plants' then
    if exists (
      select 1
      from public.garden_personal_paths
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) or exists (
      select 1
      from public.garden_personal_elements
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) then
      raise exception 'That garden spot is occupied.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'garden_personal_paths' then
    if exists (
      select 1
      from public.garden_personal_plants
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) or exists (
      select 1
      from public.garden_personal_elements
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) then
      raise exception 'That garden spot is occupied.' using errcode = '23514';
    end if;
  else
    if exists (
      select 1
      from public.garden_personal_plants
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) or exists (
      select 1
      from public.garden_personal_paths
      where steward_id = new.steward_id
        and grid_x = new.grid_x
        and grid_y = new.grid_y
    ) then
      raise exception 'That garden spot is occupied.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_my_garden_tile_occupancy()
  from public, anon, authenticated;

create trigger enforce_my_garden_plant_occupancy
before insert or update of steward_id, grid_x, grid_y
on public.garden_personal_plants
for each row execute function public.enforce_my_garden_tile_occupancy();

create trigger enforce_my_garden_path_occupancy
before insert or update of steward_id, grid_x, grid_y
on public.garden_personal_paths
for each row execute function public.enforce_my_garden_tile_occupancy();

create trigger enforce_my_garden_element_occupancy
before insert or update of steward_id, grid_x, grid_y
on public.garden_personal_elements
for each row execute function public.enforce_my_garden_tile_occupancy();

create or replace function public.place_my_garden_element(
  p_steward_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_element_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  placed public.garden_personal_elements%rowtype;
  element_cost integer;
  expansion_count integer;
  left_count integer;
  right_count integer;
  up_count integer;
  down_count integer;
  plot_min_x integer;
  plot_max_x integer;
  plot_min_y integer;
  plot_max_y integer;
begin
  if not exists (
    select 1
    from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener'
      and status = 'active'
  ) then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  element_cost := case p_element_type
    when 'birdhouse' then 6
    when 'bench' then 10
    when 'stone_paver' then 1
    else null
  end;
  if element_cost is null then
    raise exception 'That item is not available in My Garden.' using errcode = '22023';
  end if;

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id)
  on conflict (steward_id) do nothing;

  select *
  into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  expansion_count := greatest(progress.plot_level - 1, 0);
  right_count := (expansion_count + 3) / 4;
  down_count := (expansion_count + 2) / 4;
  left_count := (expansion_count + 1) / 4;
  up_count := expansion_count / 4;
  plot_min_x := -4 * left_count;
  plot_max_x := 11 + 4 * right_count;
  plot_min_y := -4 * up_count;
  plot_max_y := 15 + 4 * down_count;

  if p_grid_x is null or p_grid_y is null
     or p_grid_x < plot_min_x or p_grid_x > plot_max_x
     or p_grid_y < plot_min_y or p_grid_y > plot_max_y then
    raise exception 'That spot is outside your current fenced garden.' using errcode = '22023';
  end if;

  if progress.care_balance < element_cost then
    raise exception 'Earn more Care in the Community Garden before placing that item.'
      using errcode = '22000';
  end if;

  insert into public.garden_personal_elements (
    steward_id,
    grid_x,
    grid_y,
    element_type,
    care_cost
  )
  values (
    p_steward_id,
    p_grid_x,
    p_grid_y,
    p_element_type,
    element_cost
  )
  returning * into placed;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - element_cost,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'element', to_jsonb(placed),
    'careBalance', progress.care_balance - element_cost
  );
exception
  when unique_violation then
    raise exception 'That garden spot already has an item.' using errcode = '23505';
end;
$$;

create or replace function public.remove_my_garden_element(
  p_steward_id uuid,
  p_element_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed public.garden_personal_elements%rowtype;
  next_balance integer;
begin
  if not exists (
    select 1
    from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener'
      and status = 'active'
  ) then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  perform 1
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  delete from public.garden_personal_elements
  where id = p_element_id
    and steward_id = p_steward_id
  returning * into removed;

  if removed.id is null then
    raise exception 'That item is no longer in My Garden.' using errcode = 'P0002';
  end if;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + removed.care_cost,
    updated_at = now()
  where steward_id = p_steward_id
  returning care_balance into next_balance;

  return jsonb_build_object(
    'removedElementId', removed.id,
    'careBalance', next_balance,
    'careReturned', removed.care_cost
  );
end;
$$;

revoke execute on function public.place_my_garden_element(
  uuid, integer, integer, text
) from public, anon, authenticated;
revoke execute on function public.remove_my_garden_element(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.place_my_garden_element(
  uuid, integer, integer, text
) to service_role;
grant execute on function public.remove_my_garden_element(uuid, uuid)
  to service_role;

-- Retire the former one-time upgrade shelf. Return the Care spent so existing
-- members can use it on the new freely placeable items instead.
update public.garden_member_progress as progress
set
  care_balance = progress.care_balance + refunded.total_cost,
  updated_at = now()
from (
  select steward_id, coalesce(sum(care_cost), 0)::integer as total_cost
  from public.garden_personal_upgrades
  group by steward_id
) as refunded
where progress.steward_id = refunded.steward_id;

delete from public.garden_personal_upgrades;
drop function if exists public.purchase_my_garden_upgrade(uuid, text);

comment on table public.garden_personal_upgrades is
  'Deprecated empty table retained temporarily for safe application rollout. Tile-based items now live in garden_personal_elements.';
