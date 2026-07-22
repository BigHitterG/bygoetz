-- Basil commons controls
--
-- Keeps the Community Garden generous for long human sessions while making
-- automated domination progressively unrewarding and eventually impossible.

alter table public.community_garden_roses
  add column if not exists contributor_key text,
  add column if not exists region_x smallint,
  add column if not exists region_y smallint,
  add column if not exists succession_at timestamptz,
  add column if not exists absolute_expires_at timestamptz;

alter table public.community_garden_roses
  drop constraint if exists community_garden_roses_contributor_key_check;
alter table public.community_garden_roses
  add constraint community_garden_roses_contributor_key_check
  check (contributor_key is null or contributor_key ~ '^[0-9a-f]{64}$') not valid;

update public.community_garden_roses
set
  region_x = floor(grid_x::numeric / 16)::smallint,
  region_y = floor(grid_y::numeric / 16)::smallint
where region_x is null or region_y is null;

create index if not exists community_garden_roses_region_idx
  on public.community_garden_roses (region_x, region_y, grid_x, grid_y);
create index if not exists community_garden_roses_contributor_live_idx
  on public.community_garden_roses (contributor_key, created_at)
  where contributor_key is not null;
create index if not exists community_garden_roses_succession_idx
  on public.community_garden_roses (succession_at)
  where succession_at is not null;
create index if not exists community_garden_roses_absolute_expiry_idx
  on public.community_garden_roses (absolute_expires_at)
  where absolute_expires_at is not null;

alter table public.garden_care_receipts
  add column if not exists actor_key text,
  add column if not exists action_id uuid,
  add column if not exists earning_phase text;

alter table public.garden_care_receipts
  drop constraint if exists garden_care_receipts_actor_key_check;
alter table public.garden_care_receipts
  add constraint garden_care_receipts_actor_key_check
  check (actor_key is null or actor_key ~ '^[0-9a-f]{64}$') not valid;
alter table public.garden_care_receipts
  drop constraint if exists garden_care_receipts_earning_phase_check;
alter table public.garden_care_receipts
  add constraint garden_care_receipts_earning_phase_check
  check (earning_phase is null or earning_phase in ('daily', 'full', 'taper4', 'taper20'));
alter table public.garden_care_receipts
  drop constraint if exists garden_care_receipts_value_check;
alter table public.garden_care_receipts
  add constraint garden_care_receipts_value_check check (care_value between 1 and 6);
alter table public.garden_care_receipts
  alter column community_plant_id drop not null;
alter table public.garden_care_receipts
  drop constraint if exists garden_care_receipts_action_check;
alter table public.garden_care_receipts
  add constraint garden_care_receipts_action_check check (action_type in ('plant', 'water', 'weed'));
create unique index if not exists garden_care_receipts_action_id_idx
  on public.garden_care_receipts (action_id)
  where action_id is not null;

create table if not exists public.community_garden_actor_days (
  actor_key text not null,
  activity_date date not null,
  mutation_count integer not null default 0,
  meaningful_actions integer not null default 0,
  care_earned integer not null default 0,
  tier_progress integer not null default 0,
  plants_placed integer not null default 0,
  watering_actions integer not null default 0,
  first_action_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (actor_key, activity_date),
  constraint community_garden_actor_days_actor_check check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_actor_days_counts_check check (
    mutation_count between 0 and 3000
    and meaningful_actions between 0 and 3000
    and care_earned between 0 and 300
    and tier_progress between 0 and 19
    and plants_placed between 0 and 3000
    and watering_actions between 0 and 3000
  )
);

create index if not exists community_garden_actor_days_date_idx
  on public.community_garden_actor_days (activity_date desc, care_earned desc);
alter table public.community_garden_actor_days enable row level security;
revoke all on table public.community_garden_actor_days from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_actor_days to service_role;

create table if not exists public.community_garden_network_days (
  network_key text not null,
  activity_date date not null,
  mutation_count integer not null default 0,
  last_action_at timestamptz not null default now(),
  primary key (network_key, activity_date),
  constraint community_garden_network_days_network_check check (network_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_network_days_count_check check (mutation_count between 0 and 12000)
);

alter table public.community_garden_network_days enable row level security;
revoke all on table public.community_garden_network_days from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_network_days to service_role;

create table if not exists public.community_garden_regions (
  region_x smallint not null,
  region_y smallint not null,
  plant_count integer not null default 0,
  active_contributors integer not null default 0,
  pressure_state text not null default 'healthy',
  stress_started_at timestamptz,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (region_x, region_y),
  constraint community_garden_regions_count_check check (plant_count >= 0),
  constraint community_garden_regions_contributors_check check (active_contributors >= 0),
  constraint community_garden_regions_pressure_check check (pressure_state in ('healthy', 'busy', 'resting'))
);

create index if not exists community_garden_regions_pressure_idx
  on public.community_garden_regions (pressure_state, plant_count desc);
alter table public.community_garden_regions enable row level security;
revoke all on table public.community_garden_regions from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_regions to service_role;

create table if not exists public.community_garden_weeds (
  id uuid primary key default gen_random_uuid(),
  grid_x integer not null,
  grid_y integer not null,
  region_x smallint not null,
  region_y smallint not null,
  spawned_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '36 hours'),
  constraint community_garden_weeds_unique_coordinate unique (grid_x, grid_y),
  constraint community_garden_weeds_bounds_check check (
    grid_x between -96 and 63 and grid_y between -96 and 63
  )
);

create index if not exists community_garden_weeds_region_idx
  on public.community_garden_weeds (region_x, region_y);
create index if not exists community_garden_weeds_expiry_idx
  on public.community_garden_weeds (expires_at);
alter table public.community_garden_weeds enable row level security;
revoke all on table public.community_garden_weeds from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_weeds to service_role;

alter table public.community_garden_snapshots
  add column if not exists weed_payload jsonb not null default '[]'::jsonb;

alter table public.garden_care_ledger
  drop constraint if exists garden_care_ledger_action_check;
alter table public.garden_care_ledger
  add constraint garden_care_ledger_action_check check (action_type in ('plant', 'water', 'weed'));

alter table public.community_garden_actions
  drop constraint if exists community_garden_actions_type_check;
alter table public.community_garden_actions
  add constraint community_garden_actions_type_check check (action_type in ('plant', 'water', 'weed'));

comment on table public.community_garden_actor_days is
  'Server-only, pseudonymous UTC-day counters enforcing the 300 Care and 3,000 mutation commons limits.';
comment on table public.community_garden_regions is
  'Server-only 16 by 16 tile pressure summaries. Healthy below 140 plants, busy from 140, and resting at 180.';

alter table public.garden_care_ledger
  drop constraint if exists garden_care_ledger_earning_phase_check;
alter table public.garden_care_ledger
  add constraint garden_care_ledger_earning_phase_check
  check (earning_phase in ('quick', 'steady', 'daily', 'standard', 'full', 'taper4', 'taper20'));

create or replace function public.perform_idempotent_community_garden_action_v3(
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
  actor_day public.community_garden_actor_days%rowtype;
  network_day public.community_garden_network_days%rowtype;
  planted public.community_garden_roses%rowtype;
  candidate_id uuid;
  before_watering public.community_garden_roses%rowtype;
  watered public.community_garden_roses%rowtype;
  normalized_ids uuid[];
  watered_plants jsonb := '[]'::jsonb;
  result_payload jsonb;
  request_payload jsonb;
  contribution_payload jsonb;
  actor_recent_count integer;
  network_recent_count integer;
  region_count integer;
  contributor_count integer;
  base_care integer := 0;
  care_award integer := 0;
  special_bonus integer := 0;
  progress_required integer := 1;
  next_progress integer := 0;
  phase text := 'full';
  new_receipt uuid;
  care_plant_id uuid;
  special_flower boolean := false;
  action_time timestamptz := statement_timestamp();
  activity_day date := (statement_timestamp() at time zone 'utc')::date;
  next_snapshot_at timestamptz := to_timestamp((floor(extract(epoch from statement_timestamp()) / 600) + 1) * 600);
begin
  if p_action_id is null
    or p_actor_key is null
    or p_actor_key !~ '^[0-9a-f]{64}$'
    or p_network_key is null
    or p_network_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden action could not be verified.' using errcode = '22023';
  end if;
  if p_action_type not in ('plant', 'water', 'weed') then
    raise exception 'That garden action is not available.' using errcode = '22023';
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

  request_payload := jsonb_strip_nulls(jsonb_build_object(
    'gridX', p_grid_x,
    'gridY', p_grid_y,
    'plantType', p_plant_type,
    'plantIds', to_jsonb(p_plant_ids)
  ));
  insert into public.community_garden_actions (
    action_id, actor_key, network_key, action_type, request_payload
  ) values (
    p_action_id, p_actor_key, p_network_key, p_action_type, request_payload
  );

  if p_action_type = 'plant' then
    if p_grid_x not between -96 and 63 or p_grid_y not between -96 and 63 then
      raise exception 'Choose a spot inside the Community Garden.' using errcode = '22023';
    end if;
    if p_plant_type not in ('rose', 'sunflower', 'lavender') then
      raise exception 'That seed is not available.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.community_garden_weeds
      where grid_x = p_grid_x and grid_y = p_grid_y
    ) then
      raise exception 'Pull this weed before planting here.' using errcode = 'P0001';
    end if;

    select count(*)::integer into region_count
    from public.community_garden_roses
    where region_x = floor(p_grid_x::numeric / 16)::smallint
      and region_y = floor(p_grid_y::numeric / 16)::smallint;
    if region_count >= 180 then
      raise exception 'This patch is resting. Choose a nearby open part of the garden.' using errcode = 'P0001';
    end if;

    insert into public.community_garden_roses (
      grid_x, grid_y, plant_type, contributor_key, region_x, region_y,
      absolute_expires_at
    ) values (
      p_grid_x, p_grid_y, p_plant_type, p_actor_key,
      floor(p_grid_x::numeric / 16)::smallint,
      floor(p_grid_y::numeric / 16)::smallint,
      action_time + case p_plant_type
        when 'sunflower' then interval '7 days'
        when 'lavender' then interval '21 days'
        else interval '14 days'
      end
    ) returning * into planted;

    base_care := 1;
    care_plant_id := planted.id;
    result_payload := jsonb_build_object(
      'plant', jsonb_build_object(
        'id', planted.id, 'grid_x', planted.grid_x, 'grid_y', planted.grid_y,
        'plant_type', planted.plant_type, 'planted_at', planted.planted_at,
        'last_watered_at', planted.last_watered_at, 'created_at', planted.created_at
      ),
      'plants', jsonb_build_array(jsonb_build_object(
        'id', planted.id, 'grid_x', planted.grid_x, 'grid_y', planted.grid_y,
        'plant_type', planted.plant_type, 'planted_at', planted.planted_at,
        'last_watered_at', planted.last_watered_at, 'created_at', planted.created_at
      ))
    );

    -- Keep a contributor's current mark visible, but let their oldest work
    -- succeed naturally once their live footprint grows beyond 100 plants.
    select count(*)::integer into contributor_count
    from public.community_garden_roses
    where contributor_key = p_actor_key;
    if contributor_count > 100 then
      with oldest as (
        select id
        from public.community_garden_roses
        where contributor_key = p_actor_key
          and id <> planted.id
          and succession_at is null
        order by created_at, id
        limit contributor_count - 100
      )
      update public.community_garden_roses as plants
      set succession_at = next_snapshot_at
      from oldest
      where plants.id = oldest.id;
    end if;
    if contributor_count > 125 then
      delete from public.community_garden_roses
      where id in (
        select id from public.community_garden_roses
        where contributor_key = p_actor_key and id <> planted.id
        order by coalesce(succession_at, 'infinity'::timestamptz), created_at, id
        limit contributor_count - 125
      );
    end if;
  elsif p_action_type = 'water' then
    select array_agg(candidate.id order by candidate.id) into normalized_ids
    from (
      select distinct requested.id
      from unnest(coalesce(p_plant_ids, array[]::uuid[])) as requested(id)
      where requested.id is not null
    ) as candidate;
    if coalesce(cardinality(normalized_ids), 0) < 1 or cardinality(normalized_ids) > 4 then
      raise exception 'Choose between one and four plants to water.' using errcode = '22023';
    end if;

    foreach candidate_id in array normalized_ids loop
      select * into before_watering
      from public.community_garden_roses where id = candidate_id for update;
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
      if before_watering.last_watered_at <= action_time - interval '4 hours' then
        if care_plant_id is null then care_plant_id := watered.id; end if;
        if mod(
          pg_catalog.get_byte(pg_catalog.decode(pg_catalog.substr(watered.id::text, 1, 2), 'hex'), 0),
          64
        ) = 0 then special_flower := true; end if;
      end if;
    end loop;
    if jsonb_array_length(watered_plants) = 0 then
      raise exception 'Those plants have already returned to the soil.' using errcode = 'P0002';
    end if;
    base_care := case when care_plant_id is null then 0 when special_flower then 3 else 1 end;
    result_payload := jsonb_build_object(
      'plant', watered_plants -> 0,
      'plants', watered_plants
    );
  else
    if coalesce(cardinality(p_plant_ids), 0) <> 1 then
      raise exception 'Choose one weed to pull.' using errcode = '22023';
    end if;
    select id into candidate_id
    from public.community_garden_weeds
    where id = p_plant_ids[1]
    for update;
    if candidate_id is null then
      raise exception 'That weed has already been cleared.' using errcode = 'P0002';
    end if;
    delete from public.community_garden_weeds where id = candidate_id;
    base_care := 1;
    result_payload := jsonb_build_object('removedWeedId', candidate_id);
  end if;

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
        p_action_type, care_plant_id, care_award, p_actor_key, p_action_id, phase
      ) returning token into new_receipt;
    end if;
  end if;

  update public.community_garden_actor_days
  set
    mutation_count = mutation_count + 1,
    meaningful_actions = meaningful_actions + case when base_care > 0 then 1 else 0 end,
    care_earned = care_earned + care_award,
    tier_progress = case when base_care > 0 then next_progress else tier_progress end,
    plants_placed = plants_placed + case when p_action_type = 'plant' then 1 else 0 end,
    watering_actions = watering_actions + case when p_action_type = 'water' then 1 else 0 end,
    last_action_at = action_time
  where actor_key = p_actor_key and activity_date = activity_day
  returning * into actor_day;

  update public.community_garden_network_days
  set mutation_count = mutation_count + 1, last_action_at = action_time
  where network_key = p_network_key and activity_date = activity_day;

  contribution_payload := case
    when base_care <= 0 then null
    else jsonb_strip_nulls(jsonb_build_object(
      'action', p_action_type,
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
  result_payload := result_payload || jsonb_build_object('contribution', contribution_payload);

  update public.community_garden_actions
  set status = 'completed', response_payload = result_payload, completed_at = action_time
  where action_id = p_action_id;
  return result_payload;
end;
$$;

drop function if exists public.claim_garden_care(uuid, uuid, text);
create function public.claim_garden_care(
  p_steward_id uuid,
  p_receipt_token uuid,
  p_actor_key text
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
  next_balance integer;
  next_lifetime integer;
begin
  if p_actor_key is null or p_actor_key !~ '^[0-9a-f]{64}$' then
    raise exception 'That Care receipt does not belong to this garden session.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener'
      and status = 'active'
  ) then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id) on conflict (steward_id) do nothing;
  perform 1 from public.garden_member_progress
  where steward_id = p_steward_id for update;

  select * into receipt
  from public.garden_care_receipts
  where token = p_receipt_token
    and actor_key = p_actor_key
    and claimed_at is null
    and expires_at > now()
  for update;
  if receipt.token is null then
    raise exception 'That Care receipt expired, was already claimed, or belongs to another session.' using errcode = 'P0002';
  end if;

  update public.garden_care_receipts
  set claimed_by_steward_id = p_steward_id, claimed_at = now()
  where token = receipt.token;
  insert into public.garden_care_ledger (
    steward_id, receipt_token, action_type, care_delta, earning_phase
  ) values (
    p_steward_id, receipt.token, receipt.action_type, receipt.care_value,
    coalesce(receipt.earning_phase, 'full')
  );
  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + receipt.care_value,
    lifetime_care = garden_member_progress.lifetime_care + receipt.care_value,
    updated_at = now()
  where steward_id = p_steward_id
  returning garden_member_progress.care_balance, garden_member_progress.lifetime_care
  into next_balance, next_lifetime;

  return query select
    receipt.care_value::integer,
    next_balance,
    next_lifetime,
    coalesce(receipt.earning_phase, 'full'),
    0,
    case coalesce(receipt.earning_phase, 'full') when 'taper4' then 4 when 'taper20' then 20 else 1 end;
end;
$$;

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
  weed_payload jsonb;
  existing_snapshot public.community_garden_snapshots%rowtype;
begin
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('basil-community-garden-snapshot', 0));
  select * into existing_snapshot
  from public.community_garden_snapshots where version = snapshot_version;
  if existing_snapshot.version is not null then
    return jsonb_build_object(
      'version', existing_snapshot.version,
      'generatedAt', existing_snapshot.generated_at,
      'nextRefreshAt', existing_snapshot.next_refresh_at,
      'plantCount', existing_snapshot.plant_count,
      'plants', existing_snapshot.payload,
      'weeds', existing_snapshot.weed_payload
    );
  end if;

  round_started_at := to_timestamp(snapshot_version * 600);
  refresh_at := round_started_at + interval '10 minutes';
  delete from public.community_garden_roses
  where grid_x between -96 and 63 and grid_y between -96 and 63
    and (
      succession_at <= statement_timestamp()
      or absolute_expires_at <= statement_timestamp()
      or last_watered_at <= statement_timestamp() - case plant_type
        when 'sunflower' then interval '66 hours'
        when 'lavender' then interval '168 hours'
        else interval '102 hours'
      end
    );

  insert into public.community_garden_regions (
    region_x, region_y, plant_count, active_contributors,
    pressure_state, stress_started_at, version, updated_at
  )
  select
    region_x, region_y, count(*)::integer,
    count(distinct contributor_key)::integer,
    case when count(*) >= 180 then 'resting' when count(*) >= 140 then 'busy' else 'healthy' end,
    case when count(*) >= 160 then statement_timestamp() else null end,
    snapshot_version,
    statement_timestamp()
  from public.community_garden_roses
  where grid_x between -96 and 63 and grid_y between -96 and 63
  group by region_x, region_y
  on conflict (region_x, region_y) do update set
    plant_count = excluded.plant_count,
    active_contributors = excluded.active_contributors,
    pressure_state = excluded.pressure_state,
    stress_started_at = case
      when excluded.plant_count >= 160
        then coalesce(public.community_garden_regions.stress_started_at, excluded.stress_started_at)
      else null
    end,
    version = excluded.version,
    updated_at = excluded.updated_at;
  update public.community_garden_regions
  set plant_count = 0, active_contributors = 0, pressure_state = 'healthy',
      stress_started_at = null, version = snapshot_version, updated_at = statement_timestamp()
  where version <> snapshot_version;

  delete from public.community_garden_weeds
  where expires_at <= statement_timestamp()
     or (region_x, region_y) in (
       select region_x, region_y from public.community_garden_regions
       where pressure_state = 'healthy'
     );

  -- A pressured 16x16 region grows a small, bounded number of weeds. Pulling
  -- them is a restorative action; weeds never occupy more than 12 cells in a
  -- region and disappear naturally when the region recovers.
  with needs as (
    select
      regions.region_x,
      regions.region_y,
      least(12, greatest(0, ((regions.plant_count - 140) / 5) + 1))
        - count(weeds.id)::integer as needed
    from public.community_garden_regions as regions
    left join public.community_garden_weeds as weeds
      on weeds.region_x = regions.region_x and weeds.region_y = regions.region_y
    where regions.pressure_state in ('busy', 'resting')
    group by regions.region_x, regions.region_y, regions.plant_count
  ), candidates as (
    select
      needs.region_x,
      needs.region_y,
      positions.grid_x,
      positions.grid_y,
      row_number() over (
        partition by needs.region_x, needs.region_y
        order by pg_catalog.hashtextextended(
          positions.grid_x::text || ':' || positions.grid_y::text || ':' || snapshot_version::text,
          0
        )
      ) as candidate_number,
      needs.needed
    from needs
    cross join lateral (
      select x as grid_x, y as grid_y
      from generate_series(needs.region_x * 16, needs.region_x * 16 + 15) as x
      cross join generate_series(needs.region_y * 16, needs.region_y * 16 + 15) as y
    ) as positions
    where needs.needed > 0
      and positions.grid_x between -96 and 63
      and positions.grid_y between -96 and 63
      and not exists (
        select 1 from public.community_garden_roses plants
        where plants.grid_x = positions.grid_x and plants.grid_y = positions.grid_y
      )
      and not exists (
        select 1 from public.community_garden_weeds weeds
        where weeds.grid_x = positions.grid_x and weeds.grid_y = positions.grid_y
      )
  )
  insert into public.community_garden_weeds (grid_x, grid_y, region_x, region_y)
  select grid_x, grid_y, region_x, region_y
  from candidates
  where candidate_number <= needed
  on conflict (grid_x, grid_y) do nothing;

  select count(*)::integer, coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'grid_x', grid_x, 'grid_y', grid_y, 'plant_type', plant_type,
    'planted_at', planted_at, 'last_watered_at', last_watered_at, 'created_at', created_at
  ) order by grid_x, grid_y), '[]'::jsonb)
  into snapshot_count, snapshot_payload
  from public.community_garden_roses
  where grid_x between -96 and 63 and grid_y between -96 and 63;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'grid_x', grid_x, 'grid_y', grid_y, 'spawned_at', spawned_at
  ) order by grid_x, grid_y), '[]'::jsonb)
  into weed_payload
  from public.community_garden_weeds;

  insert into public.community_garden_snapshots (
    version, generated_at, next_refresh_at, plant_count, payload, weed_payload
  ) values (
    snapshot_version, statement_timestamp(), refresh_at, snapshot_count, snapshot_payload, weed_payload
  );
  delete from public.community_garden_snapshots where version not in (
    select version from public.community_garden_snapshots order by version desc limit 2
  );
  delete from public.community_garden_actions where created_at < statement_timestamp() - interval '24 hours';
  delete from public.garden_care_receipts
  where (claimed_at is not null and claimed_at < statement_timestamp() - interval '30 days')
     or (claimed_at is null and expires_at < statement_timestamp() - interval '1 day');
  delete from public.community_garden_actor_days
  where activity_date < (statement_timestamp() at time zone 'utc')::date - 35;
  delete from public.community_garden_network_days
  where activity_date < (statement_timestamp() at time zone 'utc')::date - 35;

  return jsonb_build_object(
    'version', snapshot_version, 'generatedAt', statement_timestamp(),
    'nextRefreshAt', refresh_at, 'plantCount', snapshot_count,
    'plants', snapshot_payload, 'weeds', weed_payload
  );
end;
$$;

create or replace function public.get_community_garden_commons_health()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'careCap', 300,
    'mutationCap', 3000,
    'activeContributorsToday', (
      select count(*) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date
    ),
    'contributorsAtCareCap', (
      select count(*) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date and care_earned >= 300
    ),
    'careAwardedToday', (
      select coalesce(sum(care_earned), 0) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date
    ),
    'mutationsToday', (
      select coalesce(sum(mutation_count), 0) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date
    ),
    'busyRegions', (select count(*) from public.community_garden_regions where pressure_state = 'busy'),
    'restingRegions', (select count(*) from public.community_garden_regions where pressure_state = 'resting'),
    'densestRegionPlants', (select coalesce(max(plant_count), 0) from public.community_garden_regions),
    'scheduledSuccession', (select count(*) from public.community_garden_roses where succession_at is not null),
    'weeds', (select count(*) from public.community_garden_weeds),
    'gardenOccupancyPercent', round((select count(*) from public.community_garden_roses)::numeric / 25600 * 100, 2),
    'expansionRecommended', (select count(*) from public.community_garden_roses) >= 16640
  )
$$;

revoke execute on function public.perform_idempotent_community_garden_action_v3(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
revoke execute on function public.claim_garden_care(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.get_community_garden_commons_health()
  from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_action_v3(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;
grant execute on function public.claim_garden_care(uuid, uuid, text)
  to service_role;
grant execute on function public.get_community_garden_commons_health()
  to service_role;

revoke all on table public.community_garden_actor_days from public, anon, authenticated;
revoke all on table public.community_garden_network_days from public, anon, authenticated;
revoke all on table public.community_garden_regions from public, anon, authenticated;
revoke all on table public.community_garden_weeds from public, anon, authenticated;
