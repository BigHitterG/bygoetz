alter table public.garden_care_ledger
  drop constraint if exists garden_care_ledger_earning_phase_check;

alter table public.garden_care_ledger
  add constraint garden_care_ledger_earning_phase_check
  check (earning_phase in ('quick', 'steady', 'daily', 'standard'));

comment on table public.garden_care_ledger is
  'Private Care awards for paid members. The first eligible Community Garden action each UTC day awards four Care; later eligible actions award one.';

create or replace function public.perform_community_garden_planting(
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text
)
returns table (
  plant_id uuid,
  grid_x integer,
  grid_y integer,
  plant_type text,
  planted_at timestamptz,
  last_watered_at timestamptz,
  created_at timestamptz,
  receipt_token uuid,
  care_value integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  planted public.community_garden_roses%rowtype;
  new_receipt uuid;
begin
  select *
  into planted
  from public.plant_community_garden_plant(p_grid_x, p_grid_y, p_plant_type);

  insert into public.garden_care_receipts (
    action_type,
    community_plant_id,
    care_value
  )
  values ('plant', planted.id, 1)
  returning token into new_receipt;

  return query
  select
    planted.id,
    planted.grid_x,
    planted.grid_y,
    planted.plant_type,
    planted.planted_at,
    planted.last_watered_at,
    planted.created_at,
    new_receipt,
    1;
end;
$$;

create or replace function public.perform_community_garden_watering_cluster(
  p_plant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_ids uuid[];
  candidate_id uuid;
  before_watering public.community_garden_roses%rowtype;
  watered public.community_garden_roses%rowtype;
  watered_plants jsonb := '[]'::jsonb;
  care_plant_id uuid;
  new_receipt uuid;
  action_time timestamptz := statement_timestamp();
begin
  select array_agg(candidate.id order by candidate.id)
  into normalized_ids
  from (
    select distinct requested.id
    from unnest(coalesce(p_plant_ids, array[]::uuid[])) as requested(id)
    where requested.id is not null
  ) as candidate;

  if coalesce(cardinality(normalized_ids), 0) < 1
     or cardinality(normalized_ids) > 4 then
    raise exception 'Choose between one and four plants to water.' using errcode = '22023';
  end if;

  foreach candidate_id in array normalized_ids
  loop
    select *
    into before_watering
    from public.community_garden_roses
    where id = candidate_id
    for update;

    if not found then
      continue;
    end if;

    update public.community_garden_roses
    set last_watered_at = action_time
    where id = candidate_id
      and last_watered_at > action_time - case plant_type
        when 'sunflower' then interval '58 hours'
        when 'lavender' then interval '156 hours'
        else interval '96 hours'
      end
    returning * into watered;

    if not found then
      continue;
    end if;

    watered_plants := watered_plants || jsonb_build_array(jsonb_build_object(
      'id', watered.id,
      'grid_x', watered.grid_x,
      'grid_y', watered.grid_y,
      'plant_type', watered.plant_type,
      'planted_at', watered.planted_at,
      'last_watered_at', watered.last_watered_at,
      'created_at', watered.created_at
    ));

    if care_plant_id is null
       and before_watering.last_watered_at <= action_time - interval '4 hours' then
      care_plant_id := watered.id;
    end if;
  end loop;

  if jsonb_array_length(watered_plants) = 0 then
    raise exception 'Those plants have already returned to the soil.' using errcode = 'P0002';
  end if;

  if care_plant_id is not null then
    insert into public.garden_care_receipts (
      action_type,
      community_plant_id,
      care_value
    )
    values ('water', care_plant_id, 1)
    returning token into new_receipt;
  end if;

  return jsonb_build_object(
    'plant', watered_plants -> 0,
    'plants', watered_plants,
    'contribution',
      case
        when new_receipt is not null
        then jsonb_build_object(
          'action', 'water',
          'receiptToken', new_receipt,
          'careValue', 1
        )
        else null
      end
  );
end;
$$;

create or replace function public.perform_idempotent_community_garden_action_v2(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
  p_action_type text,
  p_grid_x integer default null,
  p_grid_y integer default null,
  p_plant_type text default null,
  p_plant_ids uuid[] default null
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
    if previous_action.status = 'completed'
       and previous_action.response_payload is not null then
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
    'plantIds', to_jsonb(p_plant_ids)
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
      'plants', jsonb_build_array(jsonb_build_object(
        'id', action_result.plant_id,
        'grid_x', action_result.grid_x,
        'grid_y', action_result.grid_y,
        'plant_type', action_result.plant_type,
        'planted_at', action_result.planted_at,
        'last_watered_at', action_result.last_watered_at,
        'created_at', action_result.created_at
      )),
      'contribution', jsonb_build_object(
        'action', 'plant',
        'receiptToken', action_result.receipt_token,
        'careValue', 1
      )
    );
  else
    result_payload := public.perform_community_garden_watering_cluster(p_plant_ids);
  end if;

  update public.community_garden_actions
  set
    status = 'completed',
    response_payload = result_payload,
    completed_at = statement_timestamp()
  where action_id = p_action_id;

  return result_payload;
end;
$$;

create or replace function public.claim_garden_care(
  p_steward_id uuid,
  p_receipt_token uuid
)
returns table (
  awarded_care integer,
  care_balance integer,
  lifetime_care integer,
  earning_phase text,
  steady_progress integer,
  steady_actions_required integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.garden_care_receipts%rowtype;
  already_awarded_today boolean;
  award integer;
  phase text;
  next_balance integer;
  next_lifetime integer;
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

  perform 1
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  select *
  into receipt
  from public.garden_care_receipts
  where token = p_receipt_token
    and claimed_at is null
    and expires_at > now()
  for update;

  if receipt.token is null then
    raise exception 'That Care receipt has expired or was already claimed.' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.garden_care_ledger as ledger
    where ledger.steward_id = p_steward_id
      and ledger.created_at >= date_trunc('day', statement_timestamp())
      and ledger.care_delta > 0
  )
  into already_awarded_today;

  award := case when already_awarded_today then 1 else 4 end;
  phase := case when already_awarded_today then 'standard' else 'daily' end;

  update public.garden_care_receipts
  set
    claimed_by_steward_id = p_steward_id,
    claimed_at = now()
  where token = receipt.token;

  insert into public.garden_care_ledger (
    steward_id,
    receipt_token,
    action_type,
    care_delta,
    earning_phase
  )
  values (
    p_steward_id,
    receipt.token,
    receipt.action_type,
    award,
    phase
  );

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + award,
    lifetime_care = garden_member_progress.lifetime_care + award,
    updated_at = now()
  where steward_id = p_steward_id
  returning
    garden_member_progress.care_balance,
    garden_member_progress.lifetime_care
  into next_balance, next_lifetime;

  return query
  select award, next_balance, next_lifetime, phase, 0, 1;
end;
$$;

revoke execute on function public.perform_community_garden_planting(integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.perform_community_garden_watering_cluster(uuid[])
  from public, anon, authenticated;
revoke execute on function public.perform_idempotent_community_garden_action_v2(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
revoke execute on function public.claim_garden_care(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.perform_community_garden_planting(integer, integer, text)
  to service_role;
grant execute on function public.perform_community_garden_watering_cluster(uuid[])
  to service_role;
grant execute on function public.perform_idempotent_community_garden_action_v2(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;
grant execute on function public.claim_garden_care(uuid, uuid)
  to service_role;
