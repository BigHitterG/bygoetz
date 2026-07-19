alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_x_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_x_check
  check (grid_x between 0 and 15);

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_y_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_y_check
  check (grid_y between 0 and 19);

comment on table public.garden_personal_plants is
  'Persistent, private plants placed anywhere inside a paid member''s fenced My Garden property. Personal plants do not expire.';

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
  plot_width integer;
  plot_height integer;
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

  plot_width := case progress.plot_level when 1 then 12 when 2 then 14 else 16 end;
  plot_height := case progress.plot_level when 1 then 16 when 2 then 18 else 20 end;

  if p_grid_x is null or p_grid_y is null
     or p_grid_x < 0 or p_grid_x >= plot_width
     or p_grid_y < 0 or p_grid_y >= plot_height then
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
  next_level integer;
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

  if progress.plot_level >= 3 then
    raise exception 'Your current My Garden property is fully expanded.' using errcode = '22000';
  end if;

  expansion_cost := case progress.plot_level when 1 then 20 else 50 end;
  next_level := progress.plot_level + 1;

  if progress.care_balance < expansion_cost then
    raise exception 'Earn more Care in the Community Garden before expanding.' using errcode = '22000';
  end if;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - expansion_cost,
    plot_level = next_level,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'careBalance', progress.care_balance - expansion_cost,
    'plotLevel', next_level,
    'width', case next_level when 2 then 14 else 16 end,
    'height', case next_level when 2 then 18 else 20 end
  );
end;
$$;
