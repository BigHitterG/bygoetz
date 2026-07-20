create table if not exists public.community_garden_snapshots (
  version bigint primary key,
  generated_at timestamptz not null,
  next_refresh_at timestamptz not null,
  plant_count integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint community_garden_snapshots_plant_count_check check (plant_count >= 0),
  constraint community_garden_snapshots_payload_check check (jsonb_typeof(payload) = 'array')
);

alter table public.community_garden_snapshots enable row level security;
revoke all on table public.community_garden_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_snapshots to service_role;

comment on table public.community_garden_snapshots is
  'Immutable ten-minute views of the public 160 by 160 Community Garden. Only the server may create or read them.';

create table if not exists public.community_garden_actions (
  action_id uuid primary key,
  actor_key text not null,
  network_key text not null,
  action_type text not null,
  request_payload jsonb not null,
  response_payload jsonb,
  status text not null default 'processing',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint community_garden_actions_actor_key_check check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_actions_network_key_check check (network_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_actions_type_check check (action_type in ('plant', 'water')),
  constraint community_garden_actions_status_check check (status in ('processing', 'completed'))
);

create index if not exists community_garden_actions_actor_created_idx
  on public.community_garden_actions (actor_key, created_at desc);
create index if not exists community_garden_actions_network_created_idx
  on public.community_garden_actions (network_key, created_at desc);
create index if not exists community_garden_actions_created_idx
  on public.community_garden_actions (created_at);

alter table public.community_garden_actions enable row level security;
revoke all on table public.community_garden_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_actions to service_role;

comment on table public.community_garden_actions is
  'Short-lived server-only idempotency and rate-limit records for anonymous public garden actions. No raw IP address is stored.';

create or replace function public.get_or_create_community_garden_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_version bigint := floor(extract(epoch from statement_timestamp()) / 600)::bigint;
  round_started_at timestamptz;
  refresh_at timestamptz;
  snapshot_payload jsonb;
  snapshot_count integer;
  existing_snapshot public.community_garden_snapshots%rowtype;
begin
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('basil-community-garden-snapshot', 0)
  );

  select *
  into existing_snapshot
  from public.community_garden_snapshots
  where version = snapshot_version;

  if existing_snapshot.version is not null then
    return jsonb_build_object(
      'version', existing_snapshot.version,
      'generatedAt', existing_snapshot.generated_at,
      'nextRefreshAt', existing_snapshot.next_refresh_at,
      'plantCount', existing_snapshot.plant_count,
      'plants', existing_snapshot.payload
    );
  end if;

  round_started_at := to_timestamp(snapshot_version * 600);
  refresh_at := round_started_at + interval '10 minutes';

  delete from public.community_garden_roses
  where grid_x between -96 and 63
    and grid_y between -96 and 63
    and last_watered_at <= statement_timestamp() - case plant_type
      when 'sunflower' then interval '66 hours'
      when 'lavender' then interval '168 hours'
      else interval '102 hours'
    end;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'grid_x', grid_x,
          'grid_y', grid_y,
          'plant_type', plant_type,
          'planted_at', planted_at,
          'last_watered_at', last_watered_at,
          'created_at', created_at
        )
        order by grid_x, grid_y
      ),
      '[]'::jsonb
    )
  into snapshot_count, snapshot_payload
  from public.community_garden_roses
  where grid_x between -96 and 63
    and grid_y between -96 and 63;

  insert into public.community_garden_snapshots (
    version,
    generated_at,
    next_refresh_at,
    plant_count,
    payload
  )
  values (
    snapshot_version,
    statement_timestamp(),
    refresh_at,
    snapshot_count,
    snapshot_payload
  );

  delete from public.community_garden_snapshots
  where version not in (
    select version
    from public.community_garden_snapshots
    order by version desc
    limit 2
  );

  delete from public.community_garden_actions
  where created_at < statement_timestamp() - interval '24 hours';

  delete from public.garden_care_receipts
  where claimed_at is null
    and expires_at < statement_timestamp() - interval '1 day';

  return jsonb_build_object(
    'version', snapshot_version,
    'generatedAt', statement_timestamp(),
    'nextRefreshAt', refresh_at,
    'plantCount', snapshot_count,
    'plants', snapshot_payload
  );
end;
$$;

create or replace function public.perform_idempotent_community_garden_action(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
  p_action_type text,
  p_grid_x integer default null,
  p_grid_y integer default null,
  p_plant_type text default null,
  p_plant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_action public.community_garden_actions%rowtype;
  action_result record;
  result_payload jsonb;
  request_payload jsonb;
  actor_recent_count integer;
  network_recent_count integer;
begin
  if p_action_id is null
    or p_actor_key is null
    or p_actor_key !~ '^[0-9a-f]{64}$'
    or p_network_key is null
    or p_network_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden action could not be verified.' using errcode = '22023';
  end if;

  if p_action_type not in ('plant', 'water') then
    raise exception 'That garden action is not available.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 0)
  );

  select *
  into previous_action
  from public.community_garden_actions
  where action_id = p_action_id;

  if previous_action.action_id is not null then
    if previous_action.actor_key <> p_actor_key then
      raise exception 'That garden action belongs to another session.' using errcode = '42501';
    end if;
    if previous_action.status = 'completed' and previous_action.response_payload is not null then
      return previous_action.response_payload;
    end if;
  end if;

  select count(*)::integer
  into actor_recent_count
  from public.community_garden_actions
  where actor_key = p_actor_key
    and created_at >= statement_timestamp() - interval '1 minute';

  select count(*)::integer
  into network_recent_count
  from public.community_garden_actions
  where network_key = p_network_key
    and created_at >= statement_timestamp() - interval '1 minute';

  if actor_recent_count >= 60 or network_recent_count >= 600 then
    raise exception 'The garden needs a short breather. Please try again in a moment.'
      using errcode = 'P0001';
  end if;

  request_payload := jsonb_strip_nulls(jsonb_build_object(
    'gridX', p_grid_x,
    'gridY', p_grid_y,
    'plantType', p_plant_type,
    'plantId', p_plant_id
  ));

  insert into public.community_garden_actions (
    action_id,
    actor_key,
    network_key,
    action_type,
    request_payload
  )
  values (
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    request_payload
  );

  if p_action_type = 'plant' then
    if p_grid_x not between -96 and 63 or p_grid_y not between -96 and 63 then
      raise exception 'Choose a spot inside the Community Garden.' using errcode = '22023';
    end if;
    if p_plant_type not in ('rose', 'sunflower', 'lavender') then
      raise exception 'That seed is not available.' using errcode = '22023';
    end if;

    select *
    into action_result
    from public.perform_community_garden_planting(
      p_grid_x,
      p_grid_y,
      p_plant_type
    );
  else
    if p_plant_id is null then
      raise exception 'Choose a plant to water.' using errcode = '22023';
    end if;

    select *
    into action_result
    from public.perform_community_garden_watering(p_plant_id);
  end if;

  result_payload := jsonb_build_object(
    'plant', jsonb_build_object(
      'id', action_result.plant_id,
      'grid_x', action_result.grid_x,
      'grid_y', action_result.grid_y,
      'plant_type', action_result.plant_type,
      'planted_at', action_result.planted_at,
      'last_watered_at', action_result.last_watered_at,
      'created_at', action_result.created_at
    ),
    'contribution',
      case
        when action_result.receipt_token is not null and action_result.care_value > 0
        then jsonb_build_object(
          'action', p_action_type,
          'receiptToken', action_result.receipt_token,
          'careValue', action_result.care_value
        )
        else null
      end
  );

  update public.community_garden_actions
  set
    status = 'completed',
    response_payload = result_payload,
    completed_at = statement_timestamp()
  where action_id = p_action_id;

  return result_payload;
end;
$$;

revoke execute on function public.get_or_create_community_garden_snapshot()
  from public, anon, authenticated;
revoke execute on function public.perform_idempotent_community_garden_action(
  uuid, text, text, text, integer, integer, text, uuid
) from public, anon, authenticated;

grant execute on function public.get_or_create_community_garden_snapshot()
  to service_role;
grant execute on function public.perform_idempotent_community_garden_action(
  uuid, text, text, text, integer, integer, text, uuid
) to service_role;

revoke execute on function public.perform_community_garden_planting(integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.perform_community_garden_watering(uuid)
  from public, anon, authenticated;
revoke execute on function public.plant_community_garden_plant(integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.water_community_garden_plant(uuid)
  from public, anon, authenticated;
revoke execute on function public.cleanup_community_garden_plants(integer, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.plant_community_garden_rose(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.water_community_garden_rose(uuid)
  from public, anon, authenticated;
revoke execute on function public.cleanup_community_garden_roses(integer, integer, integer, integer)
  from public, anon, authenticated;

revoke all on table public.community_garden_roses from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_roses
  to service_role;
