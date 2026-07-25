create table public.garden_builder_actions (
  action_id uuid primary key,
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  request_hash text not null check (char_length(request_hash) = 32),
  result jsonb,
  created_at timestamptz not null default now()
);

create index garden_builder_actions_steward_created_idx
  on public.garden_builder_actions (steward_id, created_at desc);
create index garden_builder_actions_created_idx
  on public.garden_builder_actions (created_at);

alter table public.garden_builder_actions enable row level security;
revoke all on table public.garden_builder_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_builder_actions
  to service_role;

comment on table public.garden_builder_actions is
  'Private idempotency receipts for atomic My Garden Builder Mode placement and removal strings.';

create or replace function public.apply_my_garden_builder_action(
  p_steward_id uuid,
  p_action_id uuid,
  p_mode text,
  p_category text,
  p_item_type text,
  p_cells jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  cell jsonb;
  cell_index integer := 0;
  cell_x integer;
  cell_y integer;
  previous_x integer;
  previous_y integer;
  cell_xs integer[] := array[]::integer[];
  cell_ys integer[] := array[]::integer[];
  cell_keys text[] := array[]::text[];
  cell_key text;
  cell_count integer;
  affected_count integer := 0;
  removed_count integer;
  care_delta integer := 0;
  item_cost integer := 0;
  required_lifetime integer := 0;
  item_width integer := 1;
  item_height integer := 1;
  expansion_count integer;
  left_count integer;
  right_count integer;
  up_count integer;
  down_count integer;
  plot_min_x integer;
  plot_max_x integer;
  plot_min_y integer;
  plot_max_y integer;
  request_hash text;
  existing_hash text;
  existing_result jsonb;
  inserted_action boolean := false;
  action_result jsonb;
begin
  if p_steward_id is null or p_action_id is null then
    raise exception 'Choose a valid Builder action.' using errcode = '22023';
  end if;

  if p_mode not in ('place', 'remove')
     or p_category not in ('plant', 'path', 'element') then
    raise exception 'Choose a valid Builder action.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_cells) <> 'array' then
    raise exception 'Choose a valid Builder string.' using errcode = '22023';
  end if;

  cell_count := jsonb_array_length(p_cells);
  if cell_count < 1 or cell_count > 10 then
    raise exception 'Builder strings can use between 1 and 10 tiles.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener'
      and status = 'active'
  ) then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  for cell in
    select value
    from jsonb_array_elements(p_cells)
  loop
    cell_index := cell_index + 1;
    if jsonb_typeof(cell) <> 'object'
       or not (cell ? 'gridX')
       or not (cell ? 'gridY')
       or (cell ->> 'gridX') !~ '^-?[0-9]+$'
       or (cell ->> 'gridY') !~ '^-?[0-9]+$' then
      raise exception 'Choose a valid Builder string.' using errcode = '22023';
    end if;

    cell_x := (cell ->> 'gridX')::integer;
    cell_y := (cell ->> 'gridY')::integer;
    if cell_x < -100000 or cell_x > 100000
       or cell_y < -100000 or cell_y > 100000 then
      raise exception 'Choose a valid Builder string.' using errcode = '22023';
    end if;

    cell_key := cell_x::text || ':' || cell_y::text;
    if cell_key = any(cell_keys) then
      raise exception 'A Builder string cannot cross itself.' using errcode = '22023';
    end if;
    if cell_index > 1
       and abs(cell_x - previous_x) + abs(cell_y - previous_y) <> 1 then
      raise exception 'Each Builder tile must touch the previous tile.'
        using errcode = '22023';
    end if;

    cell_xs := array_append(cell_xs, cell_x);
    cell_ys := array_append(cell_ys, cell_y);
    cell_keys := array_append(cell_keys, cell_key);
    previous_x := cell_x;
    previous_y := cell_y;
  end loop;

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

  for cell_index in 1..cell_count loop
    if cell_xs[cell_index] < plot_min_x
       or cell_xs[cell_index] > plot_max_x
       or cell_ys[cell_index] < plot_min_y
       or cell_ys[cell_index] > plot_max_y then
      raise exception 'That spot is outside your current fenced garden.'
        using errcode = '22023';
    end if;
  end loop;

  request_hash := md5(
    p_steward_id::text || '|' ||
    p_mode || '|' ||
    p_category || '|' ||
    coalesce(p_item_type, '') || '|' ||
    p_cells::text
  );

  insert into public.garden_builder_actions (
    action_id,
    steward_id,
    request_hash
  )
  values (
    p_action_id,
    p_steward_id,
    request_hash
  )
  on conflict (action_id) do nothing;
  get diagnostics affected_count = row_count;
  inserted_action := affected_count = 1;

  if not inserted_action then
    select actions.request_hash, actions.result
    into existing_hash, existing_result
    from public.garden_builder_actions actions
    where actions.action_id = p_action_id;

    if existing_hash is distinct from request_hash then
      raise exception 'That Builder action identifier was already used.'
        using errcode = '23505';
    end if;
    return coalesce(
      existing_result,
      jsonb_build_object('applied', true, 'replayed', true)
    );
  end if;

  if p_mode = 'place' and p_category = 'plant' then
    select care_cost, lifetime_care_required
    into item_cost, required_lifetime
    from public.garden_personal_plant_catalog
    where plant_type = p_item_type
      and active;

    if item_cost is null then
      raise exception 'That plant is not available in My Garden.' using errcode = '22023';
    end if;
    if progress.lifetime_care < required_lifetime then
      raise exception 'Earn more lifetime Care to unlock this collection.'
        using errcode = '42501';
    end if;
    care_delta := -(item_cost * cell_count);
    if progress.care_balance + care_delta < 0 then
      raise exception 'Earn more Care in the Community Garden before planting here.'
        using errcode = '22000';
    end if;

    for cell_index in 1..cell_count loop
      insert into public.garden_personal_plants (
        steward_id,
        grid_x,
        grid_y,
        plant_type
      )
      values (
        p_steward_id,
        cell_xs[cell_index],
        cell_ys[cell_index],
        p_item_type
      );
    end loop;
  elsif p_mode = 'place' and p_category = 'path' then
    if p_item_type is not null and p_item_type <> 'path' then
      raise exception 'Choose a valid Builder path.' using errcode = '22023';
    end if;
    for cell_index in 1..cell_count loop
      insert into public.garden_personal_paths (steward_id, grid_x, grid_y)
      values (
        p_steward_id,
        cell_xs[cell_index],
        cell_ys[cell_index]
      );
    end loop;
  elsif p_mode = 'place' and p_category = 'element' then
    select
      care_cost,
      lifetime_care_required,
      footprint_width,
      footprint_height
    into
      item_cost,
      required_lifetime,
      item_width,
      item_height
    from public.garden_personal_element_catalog
    where element_type = p_item_type
      and active;

    if item_cost is null then
      raise exception 'That item is not available in My Garden.' using errcode = '22023';
    end if;
    if item_width <> 1 or item_height <> 1 then
      raise exception 'Builder Mode supports one-tile items only.' using errcode = '22023';
    end if;
    if progress.lifetime_care < required_lifetime then
      raise exception 'Earn more lifetime Care to unlock this collection.'
        using errcode = '42501';
    end if;
    care_delta := -(item_cost * cell_count);
    if progress.care_balance + care_delta < 0 then
      raise exception 'Earn more Care in the Community Garden before placing that item.'
        using errcode = '22000';
    end if;

    for cell_index in 1..cell_count loop
      insert into public.garden_personal_elements (
        steward_id,
        grid_x,
        grid_y,
        element_type,
        care_cost
      )
      values (
        p_steward_id,
        cell_xs[cell_index],
        cell_ys[cell_index],
        p_item_type,
        item_cost
      );
    end loop;
  elsif p_mode = 'remove' and p_category = 'plant' then
    care_delta := cell_count;
    for cell_index in 1..cell_count loop
      delete from public.garden_personal_plants
      where steward_id = p_steward_id
        and grid_x = cell_xs[cell_index]
        and grid_y = cell_ys[cell_index];
      get diagnostics removed_count = row_count;
      if removed_count <> 1 then
        raise exception 'Every Builder tile must contain a plant to uproot.'
          using errcode = 'P0002';
      end if;
    end loop;
  elsif p_mode = 'remove' and p_category = 'path' then
    for cell_index in 1..cell_count loop
      delete from public.garden_personal_paths
      where steward_id = p_steward_id
        and grid_x = cell_xs[cell_index]
        and grid_y = cell_ys[cell_index];
      get diagnostics removed_count = row_count;
      if removed_count <> 1 then
        raise exception 'Every Builder tile must contain a path to remove.'
          using errcode = 'P0002';
      end if;
    end loop;
  elsif p_mode = 'remove' and p_category = 'element' then
    for cell_index in 1..cell_count loop
      with removed as (
        delete from public.garden_personal_elements elements
        using public.garden_personal_element_catalog catalog
        where elements.steward_id = p_steward_id
          and elements.grid_x = cell_xs[cell_index]
          and elements.grid_y = cell_ys[cell_index]
          and catalog.element_type = elements.element_type
          and catalog.footprint_width = 1
          and catalog.footprint_height = 1
        returning elements.care_cost
      )
      select care_cost
      into item_cost
      from removed;
      if not found then
        raise exception 'Every Builder tile must contain a one-tile item to pick up.'
          using errcode = 'P0002';
      end if;
      care_delta := care_delta + item_cost;
    end loop;
  else
    raise exception 'Choose a valid Builder action.' using errcode = '22023';
  end if;

  if care_delta <> 0 then
    update public.garden_member_progress
    set
      care_balance = garden_member_progress.care_balance + care_delta,
      updated_at = now()
    where steward_id = p_steward_id
    returning care_balance into progress.care_balance;
  end if;

  action_result := jsonb_build_object(
    'applied', true,
    'replayed', false,
    'mode', p_mode,
    'category', p_category,
    'count', cell_count,
    'careDelta', care_delta,
    'careBalance', progress.care_balance
  );

  update public.garden_builder_actions
  set result = action_result
  where action_id = p_action_id;

  delete from public.garden_builder_actions
  where created_at < now() - interval '90 days'
    and action_id <> p_action_id;

  return action_result;
exception
  when unique_violation then
    raise exception 'One of those Builder tiles is already occupied.'
      using errcode = '23505';
  when check_violation then
    raise exception 'One of those Builder tiles is occupied.'
      using errcode = '23514';
end;
$$;

revoke execute on function public.apply_my_garden_builder_action(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_my_garden_builder_action(
  uuid, uuid, text, text, text, jsonb
) to service_role;

comment on function public.apply_my_garden_builder_action(
  uuid, uuid, text, text, text, jsonb
) is
  'Atomically validates and applies one idempotent 1-10 tile My Garden Builder Mode string for an active member.';
