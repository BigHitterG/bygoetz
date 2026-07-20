alter table public.garden_member_progress
  drop constraint if exists garden_member_progress_plot_level_check;

alter table public.garden_member_progress
  alter column plot_level type integer;

alter table public.garden_member_progress
  add constraint garden_member_progress_plot_level_check
  check (plot_level between 1 and 100000);

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_x_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_x_check
  check (grid_x between -100000 and 100000);

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_y_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_y_check
  check (grid_y between -100000 and 100000);

alter table public.garden_personal_paths
  drop constraint if exists garden_personal_paths_grid_x_check;

alter table public.garden_personal_paths
  add constraint garden_personal_paths_grid_x_check
  check (grid_x between -100000 and 100000);

alter table public.garden_personal_paths
  drop constraint if exists garden_personal_paths_grid_y_check;

alter table public.garden_personal_paths
  add constraint garden_personal_paths_grid_y_check
  check (grid_y between -100000 and 100000);

create or replace function public.plant_my_garden(
  p_steward_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  planted public.garden_personal_plants%rowtype;
  expansion_count integer;
  left_count integer;
  right_count integer;
  up_count integer;
  down_count integer;
  plot_min_x integer;
  plot_max_x integer;
  plot_min_y integer;
  plot_max_y integer;
  plant_cost integer := 2;
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

  if p_plant_type is null or p_plant_type not in ('rose', 'sunflower', 'lavender') then
    raise exception 'That plant is not available in My Garden.' using errcode = '22023';
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

  if progress.care_balance < plant_cost then
    raise exception 'Earn more Care in the Community Garden before planting here.' using errcode = '22000';
  end if;

  insert into public.garden_personal_plants (
    steward_id,
    grid_x,
    grid_y,
    plant_type
  )
  values (
    p_steward_id,
    p_grid_x,
    p_grid_y,
    p_plant_type
  )
  returning * into planted;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - plant_cost,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'plant', to_jsonb(planted),
    'careBalance', progress.care_balance - plant_cost
  );
exception
  when unique_violation then
    raise exception 'That garden spot is already planted.' using errcode = '23505';
end;
$$;

create or replace function public.toggle_my_garden_path(
  p_steward_id uuid,
  p_grid_x integer,
  p_grid_y integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  expansion_count integer;
  left_count integer;
  right_count integer;
  up_count integer;
  down_count integer;
  plot_min_x integer;
  plot_max_x integer;
  plot_min_y integer;
  plot_max_y integer;
  removed_count integer;
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

  delete from public.garden_personal_paths
  where steward_id = p_steward_id
    and grid_x = p_grid_x
    and grid_y = p_grid_y;

  get diagnostics removed_count = row_count;
  if removed_count > 0 then
    return false;
  end if;

  insert into public.garden_personal_paths (steward_id, grid_x, grid_y)
  values (p_steward_id, p_grid_x, p_grid_y);
  return true;
end;
$$;

create or replace function public.expand_my_garden(
  p_steward_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  expansion_cost integer;
  cost_step bigint;
  next_level integer;
  expansion_count integer;
  left_count integer;
  right_count integer;
  up_count integer;
  down_count integer;
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

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id)
  on conflict (steward_id) do nothing;

  select *
  into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  if progress.plot_level >= 100000 then
    raise exception 'This garden has reached its safe map boundary.' using errcode = '22000';
  end if;

  cost_step := greatest(progress.plot_level - 4, 0);
  expansion_cost := case progress.plot_level
    when 1 then 30
    when 2 then 50
    when 3 then 75
    when 4 then 100
    else least(
        2000000000::bigint,
        100::bigint + 25 * cost_step + (5 * cost_step * (cost_step + 1)) / 2
      )::integer
  end;
  next_level := progress.plot_level + 1;

  if progress.care_balance < expansion_cost then
    raise exception 'Earn more Care in the Community Garden before expanding.' using errcode = '22000';
  end if;

  expansion_count := next_level - 1;
  right_count := (expansion_count + 3) / 4;
  down_count := (expansion_count + 2) / 4;
  left_count := (expansion_count + 1) / 4;
  up_count := expansion_count / 4;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - expansion_cost,
    plot_level = next_level,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'careBalance', progress.care_balance - expansion_cost,
    'plotLevel', next_level,
    'minX', -4 * left_count,
    'minY', -4 * up_count,
    'width', 12 + 4 * (left_count + right_count),
    'height', 16 + 4 * (up_count + down_count)
  );
end;
$$;

revoke execute on function public.plant_my_garden(uuid, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.toggle_my_garden_path(uuid, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.expand_my_garden(uuid)
  from public, anon, authenticated;
grant execute on function public.plant_my_garden(uuid, integer, integer, text)
  to service_role;
grant execute on function public.toggle_my_garden_path(uuid, integer, integer)
  to service_role;
grant execute on function public.expand_my_garden(uuid)
  to service_role;

comment on table public.garden_member_progress is
  'Private saved Care and My Garden progression. Parcels expand clockwise around the starter garden: right, down, left, up, then repeat.';
