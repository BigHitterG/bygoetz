create table public.garden_personal_plant_catalog (
  plant_type text primary key,
  display_name text not null check (char_length(display_name) between 1 and 80),
  collection_key text not null check (
    collection_key in ('starter', 'cottage', 'pollinator', 'water')
  ),
  lifetime_care_required integer not null check (lifetime_care_required >= 0),
  care_cost integer not null check (care_cost between 1 and 100000),
  sort_order integer not null check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.garden_personal_element_catalog (
  element_type text primary key,
  display_name text not null check (char_length(display_name) between 1 and 80),
  collection_key text not null check (
    collection_key in ('starter', 'cottage', 'pollinator', 'water')
  ),
  inventory_category text not null check (
    inventory_category in ('paths', 'decor', 'nature', 'water')
  ),
  lifetime_care_required integer not null check (lifetime_care_required >= 0),
  care_cost integer not null check (care_cost between 1 and 100000),
  footprint_width smallint not null check (footprint_width between 1 and 8),
  footprint_height smallint not null check (footprint_height between 1 and 8),
  sort_order integer not null check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.garden_personal_plant_catalog enable row level security;
alter table public.garden_personal_element_catalog enable row level security;

revoke all on table public.garden_personal_plant_catalog
  from public, anon, authenticated;
revoke all on table public.garden_personal_element_catalog
  from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_personal_plant_catalog
  to service_role;
grant select, insert, update, delete on table public.garden_personal_element_catalog
  to service_role;

comment on table public.garden_personal_plant_catalog is
  'Server-authoritative personal-garden flower prices and lifetime-Care collection requirements.';
comment on table public.garden_personal_element_catalog is
  'Server-authoritative personal-garden item prices, lifetime-Care requirements and placement footprints.';

insert into public.garden_personal_plant_catalog (
  plant_type,
  display_name,
  collection_key,
  lifetime_care_required,
  care_cost,
  sort_order
)
values
  ('rose', 'Rose', 'starter', 0, 2, 10),
  ('sunflower', 'Sunflower', 'starter', 0, 2, 20),
  ('lavender', 'Lavender', 'starter', 0, 2, 30),
  ('daisy', 'Daisy', 'starter', 0, 2, 40),
  ('tulip', 'Tulip', 'starter', 0, 2, 50),
  ('wildflowers', 'Wildflowers', 'starter', 0, 2, 60),
  ('peony', 'Peony', 'cottage', 250, 2, 110),
  ('bee_balm', 'Bee balm', 'pollinator', 750, 2, 210);

insert into public.garden_personal_element_catalog (
  element_type,
  display_name,
  collection_key,
  inventory_category,
  lifetime_care_required,
  care_cost,
  footprint_width,
  footprint_height,
  sort_order
)
values
  ('stone_paver', 'Stone paver', 'starter', 'paths', 0, 1, 1, 1, 10),
  ('gravel_tile', 'Gravel tile', 'starter', 'paths', 0, 1, 1, 1, 20),
  ('brick_paver', 'Brick paver', 'starter', 'paths', 0, 2, 1, 1, 30),
  ('clay_pot', 'Clay pot', 'starter', 'decor', 0, 3, 1, 1, 40),
  ('hedge', 'Hedge', 'starter', 'nature', 0, 4, 1, 1, 50),
  ('birdhouse', 'Birdhouse', 'starter', 'decor', 0, 6, 1, 1, 60),
  ('bench', 'Garden bench', 'starter', 'decor', 0, 10, 1, 1, 70),
  ('fern', 'Fern', 'cottage', 'nature', 250, 5, 1, 1, 110),
  ('hydrangea', 'Hydrangea', 'cottage', 'nature', 250, 8, 1, 1, 120),
  ('wheelbarrow', 'Wheelbarrow', 'cottage', 'decor', 250, 8, 1, 1, 130),
  ('wooden_planter', 'Wooden planter', 'cottage', 'decor', 250, 8, 2, 1, 140),
  ('bird_feeder', 'Bird feeder', 'cottage', 'decor', 250, 12, 1, 1, 150),
  ('rustic_bench', 'Rustic bench', 'cottage', 'decor', 250, 12, 2, 1, 160),
  ('trellis', 'Trellis', 'cottage', 'decor', 250, 25, 1, 1, 170),
  ('butterfly_bush', 'Butterfly bush', 'pollinator', 'nature', 750, 10, 1, 1, 210),
  ('pollinator_sign', 'Pollinator sign', 'pollinator', 'decor', 750, 12, 1, 1, 220),
  ('butterfly_house', 'Butterfly house', 'pollinator', 'decor', 750, 20, 1, 1, 230),
  ('beehive', 'Beehive', 'pollinator', 'decor', 750, 35, 1, 1, 240),
  ('rose_trellis', 'Rose-covered trellis', 'pollinator', 'decor', 750, 50, 2, 1, 250),
  ('reeds', 'Reeds', 'water', 'water', 1500, 5, 1, 1, 310),
  ('lily_pads', 'Lily pads', 'water', 'water', 1500, 5, 1, 1, 320),
  ('birdbath', 'Birdbath', 'water', 'water', 1500, 35, 1, 1, 330),
  ('stone_basin', 'Stone basin', 'water', 'water', 1500, 60, 1, 1, 340),
  ('willow_tree', 'Willow tree', 'water', 'nature', 1500, 100, 1, 1, 350),
  ('fountain', 'Garden fountain', 'water', 'water', 1500, 175, 2, 2, 360),
  ('small_pond', 'Small pond', 'water', 'water', 1500, 250, 3, 2, 370);

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_type_check;
alter table public.garden_personal_plants
  add constraint garden_personal_plants_catalog_fkey
  foreign key (plant_type)
  references public.garden_personal_plant_catalog(plant_type)
  on update cascade
  on delete restrict;

alter table public.garden_personal_elements
  drop constraint if exists garden_personal_elements_check;
alter table public.garden_personal_elements
  drop constraint if exists garden_personal_elements_element_type_check;
alter table public.garden_personal_elements
  add constraint garden_personal_elements_catalog_fkey
  foreign key (element_type)
  references public.garden_personal_element_catalog(element_type)
  on update cascade
  on delete restrict;
alter table public.garden_personal_elements
  add constraint garden_personal_elements_care_cost_range
  check (care_cost between 1 and 100000);

create or replace function public.enforce_my_garden_tile_occupancy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_width integer := 1;
  item_height integer := 1;
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
      from public.garden_personal_elements elements
      join public.garden_personal_element_catalog catalog
        on catalog.element_type = elements.element_type
      where elements.steward_id = new.steward_id
        and new.grid_x between elements.grid_x
          and elements.grid_x + catalog.footprint_width - 1
        and new.grid_y between elements.grid_y
          and elements.grid_y + catalog.footprint_height - 1
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
      from public.garden_personal_elements elements
      join public.garden_personal_element_catalog catalog
        on catalog.element_type = elements.element_type
      where elements.steward_id = new.steward_id
        and new.grid_x between elements.grid_x
          and elements.grid_x + catalog.footprint_width - 1
        and new.grid_y between elements.grid_y
          and elements.grid_y + catalog.footprint_height - 1
    ) then
      raise exception 'That garden spot is occupied.' using errcode = '23514';
    end if;
  else
    select footprint_width, footprint_height
    into item_width, item_height
    from public.garden_personal_element_catalog
    where element_type = new.element_type
      and active;

    if not found then
      raise exception 'That item is not available in My Garden.' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.garden_personal_plants plants
      where plants.steward_id = new.steward_id
        and plants.grid_x between new.grid_x and new.grid_x + item_width - 1
        and plants.grid_y between new.grid_y and new.grid_y + item_height - 1
    ) or exists (
      select 1
      from public.garden_personal_paths paths
      where paths.steward_id = new.steward_id
        and paths.grid_x between new.grid_x and new.grid_x + item_width - 1
        and paths.grid_y between new.grid_y and new.grid_y + item_height - 1
    ) or exists (
      select 1
      from public.garden_personal_elements elements
      join public.garden_personal_element_catalog catalog
        on catalog.element_type = elements.element_type
      where elements.steward_id = new.steward_id
        and (tg_op <> 'UPDATE' or elements.id <> new.id)
        and new.grid_x <= elements.grid_x + catalog.footprint_width - 1
        and new.grid_x + item_width - 1 >= elements.grid_x
        and new.grid_y <= elements.grid_y + catalog.footprint_height - 1
        and new.grid_y + item_height - 1 >= elements.grid_y
    ) then
      raise exception 'That garden spot is occupied.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_my_garden_tile_occupancy()
  from public, anon, authenticated;

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
  plant_cost integer;
  required_lifetime integer;
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

  select care_cost, lifetime_care_required
  into plant_cost, required_lifetime
  from public.garden_personal_plant_catalog
  where plant_type = p_plant_type
    and active;

  if plant_cost is null then
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

  if progress.lifetime_care < required_lifetime then
    raise exception 'Earn more lifetime Care to unlock this collection.'
      using errcode = '42501';
  end if;

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
    raise exception 'Earn more Care in the Community Garden before planting here.'
      using errcode = '22000';
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
  required_lifetime integer;
  item_width integer;
  item_height integer;
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

  select
    care_cost,
    lifetime_care_required,
    footprint_width,
    footprint_height
  into
    element_cost,
    required_lifetime,
    item_width,
    item_height
  from public.garden_personal_element_catalog
  where element_type = p_element_type
    and active;

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

  if progress.lifetime_care < required_lifetime then
    raise exception 'Earn more lifetime Care to unlock this collection.'
      using errcode = '42501';
  end if;

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
     or p_grid_x < plot_min_x
     or p_grid_x + item_width - 1 > plot_max_x
     or p_grid_y < plot_min_y
     or p_grid_y + item_height - 1 > plot_max_y then
    raise exception 'That item does not fit inside your current fenced garden.'
      using errcode = '22023';
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

revoke execute on function public.plant_my_garden(uuid, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.place_my_garden_element(
  uuid, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.plant_my_garden(uuid, integer, integer, text)
  to service_role;
grant execute on function public.place_my_garden_element(
  uuid, integer, integer, text
) to service_role;
