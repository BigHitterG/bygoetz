-- Watering has two related but distinct effects:
-- 1. shared hydration, stored on the canonical flower; and
-- 2. a Care opportunity, represented by a gardener's newest 100 watering claims.
--
-- An active claim makes the flower look recently cared for to everyone. When a
-- gardener exceeds 100 active claims, their oldest claim is released for other
-- gardeners. The original gardener still observes their own four-hour cooldown.

create table if not exists public.community_garden_watering_claims (
  plant_id uuid primary key references public.community_garden_roses(id) on delete cascade,
  actor_key text not null check (actor_key ~ '^[0-9a-f]{64}$'),
  claimed_at timestamptz not null,
  released_at timestamptz,
  action_id uuid not null
);

create index if not exists community_garden_watering_claims_actor_active_idx
  on public.community_garden_watering_claims (actor_key, claimed_at desc, plant_id)
  where released_at is null;

create table if not exists public.community_garden_watering_history (
  actor_key text not null check (actor_key ~ '^[0-9a-f]{64}$'),
  plant_id uuid not null references public.community_garden_roses(id) on delete cascade,
  last_rewarded_at timestamptz not null,
  action_id uuid not null,
  primary key (actor_key, plant_id)
);

create index if not exists community_garden_watering_history_rewarded_idx
  on public.community_garden_watering_history (last_rewarded_at);

alter table public.community_garden_watering_claims enable row level security;
alter table public.community_garden_watering_history enable row level security;

revoke all on table public.community_garden_watering_claims
  from public, anon, authenticated;
revoke all on table public.community_garden_watering_history
  from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_watering_claims
  to service_role;
grant select, insert, update, delete on table public.community_garden_watering_history
  to service_role;

create or replace function public.perform_idempotent_community_garden_water_v1(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
  p_plant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_action public.community_garden_actions%rowtype;
  actor_day public.community_garden_actor_days%rowtype;
  network_day public.community_garden_network_days%rowtype;
  before_watering public.community_garden_roses%rowtype;
  watered public.community_garden_roses%rowtype;
  existing_claim public.community_garden_watering_claims%rowtype;
  candidate_id uuid;
  normalized_ids uuid[];
  watered_plants jsonb := '[]'::jsonb;
  claimed_ids uuid[] := array[]::uuid[];
  result_payload jsonb;
  contribution_payload jsonb;
  actor_recent_count integer;
  network_recent_count integer;
  active_claim_count integer;
  base_care integer := 0;
  care_award integer := 0;
  special_bonus integer := 0;
  progress_required integer := 1;
  next_progress integer := 0;
  phase text := 'full';
  new_receipt uuid;
  care_plant_id uuid;
  special_flower boolean := false;
  personal_last_rewarded_at timestamptz;
  claim_available boolean;
  action_time timestamptz := statement_timestamp();
  activity_day date := (statement_timestamp() at time zone 'utc')::date;
begin
  if p_action_id is null
    or p_actor_key is null
    or p_actor_key !~ '^[0-9a-f]{64}$'
    or p_network_key is null
    or p_network_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden action could not be verified.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(p_action_id::text, 0));
  select * into previous_action
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

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_key || ':' || activity_day::text, 0)
  );

  insert into public.community_garden_actor_days (actor_key, activity_date)
  values (p_actor_key, activity_day)
  on conflict (actor_key, activity_date) do nothing;
  select * into actor_day
  from public.community_garden_actor_days
  where actor_key = p_actor_key and activity_date = activity_day
  for update;

  insert into public.community_garden_network_days (network_key, activity_date)
  values (p_network_key, activity_day)
  on conflict (network_key, activity_date) do nothing;
  select * into network_day
  from public.community_garden_network_days
  where network_key = p_network_key and activity_date = activity_day
  for update;

  if actor_day.care_earned >= 300 then
    raise exception 'You have given this garden a full day of Care. Come grow with us again tomorrow.' using errcode = 'P0001';
  end if;
  if actor_day.mutation_count >= 3000 then
    raise exception 'This garden session has reached today''s planting and watering limit. Come back tomorrow.' using errcode = 'P0001';
  end if;
  if network_day.mutation_count >= 12000 then
    raise exception 'This garden connection has reached today''s shared activity limit. Please return tomorrow.' using errcode = 'P0001';
  end if;

  select count(*)::integer into actor_recent_count
  from public.community_garden_actions
  where actor_key = p_actor_key and created_at >= action_time - interval '1 minute';
  select count(*)::integer into network_recent_count
  from public.community_garden_actions
  where network_key = p_network_key and created_at >= action_time - interval '1 minute';
  if actor_recent_count >= 60 or network_recent_count >= 600 then
    raise exception 'The garden needs a short breather. Please try again in a moment.' using errcode = 'P0001';
  end if;

  select array_agg(candidate.id order by candidate.id) into normalized_ids
  from (
    select distinct requested.id
    from unnest(coalesce(p_plant_ids, array[]::uuid[])) as requested(id)
    where requested.id is not null
  ) as candidate;
  if coalesce(cardinality(normalized_ids), 0) < 1 or cardinality(normalized_ids) > 4 then
    raise exception 'Choose between one and four plants to water.' using errcode = '22023';
  end if;

  insert into public.community_garden_actions (
    action_id, actor_key, network_key, action_type, request_payload
  ) values (
    p_action_id, p_actor_key, p_network_key, 'water',
    jsonb_build_object('plantIds', to_jsonb(normalized_ids))
  );

  foreach candidate_id in array normalized_ids loop
    select * into before_watering
    from public.community_garden_roses
    where id = candidate_id
    for update;
    if not found then continue; end if;

    update public.community_garden_roses
    set last_watered_at = action_time
    where id = candidate_id
      and (absolute_expires_at is null or absolute_expires_at > action_time)
      and (succession_at is null or succession_at > action_time)
      and last_watered_at > action_time - case plant_type
        when 'sunflower' then interval '58 hours'
        when 'lavender' then interval '156 hours'
        else interval '96 hours'
      end
    returning * into watered;
    if not found then continue; end if;

    watered_plants := watered_plants || jsonb_build_array(jsonb_build_object(
      'id', watered.id, 'grid_x', watered.grid_x, 'grid_y', watered.grid_y,
      'plant_type', watered.plant_type, 'planted_at', watered.planted_at,
      'last_watered_at', watered.last_watered_at, 'created_at', watered.created_at
    ));

    select history.last_rewarded_at into personal_last_rewarded_at
    from public.community_garden_watering_history as history
    where history.actor_key = p_actor_key and history.plant_id = candidate_id
    for update;
    if personal_last_rewarded_at is not null
      and personal_last_rewarded_at > action_time - interval '4 hours'
    then
      continue;
    end if;

    select * into existing_claim
    from public.community_garden_watering_claims
    where plant_id = candidate_id
    for update;

    claim_available := case
      when found then
        existing_claim.released_at is not null
        or existing_claim.claimed_at <= action_time - interval '4 hours'
      else
        before_watering.last_watered_at <= action_time - interval '4 hours'
      end;
    if not claim_available then continue; end if;

    insert into public.community_garden_watering_claims (
      plant_id, actor_key, claimed_at, released_at, action_id
    ) values (
      candidate_id, p_actor_key, action_time, null, p_action_id
    )
    on conflict (plant_id) do update set
      actor_key = excluded.actor_key,
      claimed_at = excluded.claimed_at,
      released_at = null,
      action_id = excluded.action_id;

    insert into public.community_garden_watering_history (
      actor_key, plant_id, last_rewarded_at, action_id
    ) values (
      p_actor_key, candidate_id, action_time, p_action_id
    )
    on conflict (actor_key, plant_id) do update set
      last_rewarded_at = excluded.last_rewarded_at,
      action_id = excluded.action_id;

    claimed_ids := array_append(claimed_ids, candidate_id);
    if care_plant_id is null then care_plant_id := candidate_id; end if;
    if mod(
      pg_catalog.get_byte(pg_catalog.decode(pg_catalog.substr(candidate_id::text, 1, 2), 'hex'), 0),
      64
    ) = 0 then special_flower := true; end if;
  end loop;

  if jsonb_array_length(watered_plants) = 0 then
    raise exception 'Those plants have already returned to the soil.' using errcode = 'P0002';
  end if;

  -- Keep only this gardener's newest 100 active watering claims. Released rows
  -- remain briefly as a marker that the flower is open to other gardeners even
  -- though its shared hydration timestamp may still be recent.
  with ranked_claims as (
    select
      plant_id,
      row_number() over (order by claimed_at desc, plant_id desc) as claim_rank
    from public.community_garden_watering_claims
    where actor_key = p_actor_key
      and released_at is null
      and claimed_at > action_time - interval '4 hours'
  )
  update public.community_garden_watering_claims as claims
  set released_at = action_time
  from ranked_claims
  where claims.plant_id = ranked_claims.plant_id
    and ranked_claims.claim_rank > 100;

  select count(*)::integer into active_claim_count
  from public.community_garden_watering_claims
  where actor_key = p_actor_key
    and released_at is null
    and claimed_at > action_time - interval '4 hours';

  base_care := case
    when cardinality(claimed_ids) = 0 then 0
    when special_flower then 3
    else 1
  end;

  if base_care > 0 then
    special_bonus := greatest(0, base_care - 1);
    if actor_day.care_earned = 0 then
      care_award := 4 + special_bonus;
      phase := 'daily';
      next_progress := 0;
    elsif actor_day.care_earned < 100 then
      care_award := 1 + special_bonus;
      phase := 'full';
      next_progress := 0;
    elsif actor_day.care_earned < 200 then
      progress_required := 4;
      phase := 'taper4';
      next_progress := actor_day.tier_progress + 1;
      care_award := special_bonus;
      if next_progress >= progress_required then
        care_award := care_award + 1;
        next_progress := 0;
      end if;
    else
      progress_required := 20;
      phase := 'taper20';
      next_progress := actor_day.tier_progress + 1;
      care_award := special_bonus;
      if next_progress >= progress_required then
        care_award := care_award + 1;
        next_progress := 0;
      end if;
    end if;
    care_award := least(care_award, 300 - actor_day.care_earned);

    if care_award > 0 then
      insert into public.garden_care_receipts (
        action_type, community_plant_id, care_value, actor_key, action_id, earning_phase
      ) values (
        'water', care_plant_id, care_award, p_actor_key, p_action_id, phase
      ) returning token into new_receipt;
    end if;
  end if;

  update public.community_garden_actor_days
  set
    mutation_count = mutation_count + 1,
    meaningful_actions = meaningful_actions + case when base_care > 0 then 1 else 0 end,
    care_earned = care_earned + care_award,
    tier_progress = case when base_care > 0 then next_progress else tier_progress end,
    watering_actions = watering_actions + 1,
    last_action_at = action_time
  where actor_key = p_actor_key and activity_date = activity_day
  returning * into actor_day;

  update public.community_garden_network_days
  set mutation_count = mutation_count + 1, last_action_at = action_time
  where network_key = p_network_key and activity_date = activity_day;

  contribution_payload := case
    when base_care <= 0 then null
    else jsonb_strip_nulls(jsonb_build_object(
      'action', 'water',
      'receiptToken', new_receipt,
      'careValue', care_award,
      'specialFlower', special_flower,
      'earningPhase', phase,
      'dailyCareEarned', actor_day.care_earned,
      'dailyCareLimit', 300,
      'tierProgress', actor_day.tier_progress,
      'actionsRequired', progress_required
    ))
  end;

  result_payload := jsonb_build_object(
    'plant', watered_plants -> 0,
    'plants', watered_plants,
    'wateringClaimedPlantIds', to_jsonb(claimed_ids),
    'wateringFootprintCount', active_claim_count,
    'contribution', contribution_payload
  );

  update public.community_garden_actions
  set status = 'completed', response_payload = result_payload, completed_at = action_time
  where action_id = p_action_id;

  -- Bounded opportunistic cleanup. Plant deletion also cascades these records.
  delete from public.community_garden_watering_history
  where ctid in (
    select ctid
    from public.community_garden_watering_history
    where last_rewarded_at < action_time - interval '24 hours'
    order by last_rewarded_at
    limit 500
  );

  return result_payload;
end;
$$;

create or replace function public.perform_idempotent_community_garden_action_v5(
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
begin
  if p_action_type = 'water' then
    return public.perform_idempotent_community_garden_water_v1(
      p_action_id, p_actor_key, p_network_key, p_plant_ids
    );
  end if;

  return public.perform_idempotent_community_garden_action_v4(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );
end;
$$;

create or replace function public.get_community_garden_watering_status_v1(
  p_actor_key text,
  p_min_x integer,
  p_max_x integer,
  p_min_y integer,
  p_max_y integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := statement_timestamp();
  ready_ids uuid[];
begin
  if p_actor_key is null or p_actor_key !~ '^[0-9a-f]{64}$' then
    raise exception 'This garden session could not be verified.' using errcode = '22023';
  end if;
  if p_min_x < -96 or p_max_x > 63 or p_min_y < -96 or p_max_y > 63
    or p_min_x > p_max_x or p_min_y > p_max_y
    or p_max_x - p_min_x > 95 or p_max_y - p_min_y > 95
  then
    raise exception 'That garden area is not available.' using errcode = '22023';
  end if;

  select array_agg(plant.id order by plant.id)
  into ready_ids
  from public.community_garden_roses as plant
  left join public.community_garden_watering_claims as claim
    on claim.plant_id = plant.id
  left join public.community_garden_watering_history as personal
    on personal.actor_key = p_actor_key and personal.plant_id = plant.id
  where plant.grid_x between p_min_x and p_max_x
    and plant.grid_y between p_min_y and p_max_y
    and (plant.absolute_expires_at is null or plant.absolute_expires_at > checked_at)
    and (plant.succession_at is null or plant.succession_at > checked_at)
    and plant.last_watered_at > checked_at - case plant.plant_type
      when 'sunflower' then interval '58 hours'
      when 'lavender' then interval '156 hours'
      else interval '96 hours'
    end
    and (
      personal.last_rewarded_at is null
      or personal.last_rewarded_at <= checked_at - interval '4 hours'
    )
    and (
      (
        claim.plant_id is null
        and plant.last_watered_at <= checked_at - interval '4 hours'
      )
      or (
        claim.plant_id is not null
        and (
          claim.released_at is not null
          or claim.claimed_at <= checked_at - interval '4 hours'
        )
      )
    );

  return jsonb_build_object(
    'checkedAt', checked_at,
    'readyPlantIds', to_jsonb(coalesce(ready_ids, array[]::uuid[]))
  );
end;
$$;

revoke execute on function public.perform_idempotent_community_garden_water_v1(
  uuid, text, text, uuid[]
) from public, anon, authenticated;
revoke execute on function public.perform_idempotent_community_garden_action_v5(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
revoke execute on function public.get_community_garden_watering_status_v1(
  text, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.perform_idempotent_community_garden_water_v1(
  uuid, text, text, uuid[]
) to service_role;
grant execute on function public.perform_idempotent_community_garden_action_v5(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;
grant execute on function public.get_community_garden_watering_status_v1(
  text, integer, integer, integer, integer
) to service_role;

comment on table public.community_garden_watering_claims is
  'The active or explicitly released shared watering claim for each flower.';
comment on table public.community_garden_watering_history is
  'Private pseudonymous per-gardener watering reward cooldowns; never exposed directly.';
comment on function public.perform_idempotent_community_garden_action_v5(
  uuid, text, text, text, integer, integer, text, uuid[]
) is 'Processes authoritative garden actions with newest-100 shared watering claims and personal four-hour reward cooldowns.';
