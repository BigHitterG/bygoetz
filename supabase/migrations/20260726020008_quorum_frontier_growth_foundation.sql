begin;

-- Quorum frontier growth foundation.
--
-- This migration deliberately leaves every existing flower untouched. The
-- current 160x160 world becomes the permanent Founding Garden, while expansion
-- is measured in shadow mode and can only be applied through an audited,
-- service-role-only RPC.

alter table public.community_garden_regions
  add column if not exists land_state text not null default 'frontier',
  add column if not exists is_founding boolean not null default false,
  add column if not exists ring_index smallint not null default 0,
  add column if not exists opened_at timestamptz,
  add column if not exists established_at timestamptz,
  add column if not exists fallow_at timestamptz,
  add column if not exists heritage_capacity smallint not null default 9,
  add column if not exists consecutive_support_days smallint not null default 0,
  add column if not exists last_support_date date,
  add column if not exists latest_evaluation_date date,
  add column if not exists latest_support jsonb not null default '{}'::jsonb;

alter table public.community_garden_regions
  drop constraint if exists community_garden_regions_land_state_check,
  drop constraint if exists community_garden_regions_ring_index_check,
  drop constraint if exists community_garden_regions_heritage_capacity_check,
  drop constraint if exists community_garden_regions_support_days_check,
  drop constraint if exists community_garden_regions_latest_support_check;

alter table public.community_garden_regions
  add constraint community_garden_regions_land_state_check
    check (land_state in ('founding', 'established', 'frontier', 'fallow')),
  add constraint community_garden_regions_ring_index_check
    check (ring_index between 0 and 2047),
  add constraint community_garden_regions_heritage_capacity_check
    check (heritage_capacity between 0 and 64),
  add constraint community_garden_regions_support_days_check
    check (consecutive_support_days between 0 and 366),
  add constraint community_garden_regions_latest_support_check
    check (jsonb_typeof(latest_support) = 'object');

create table if not exists public.community_garden_account_actors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  actor_key text not null unique,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_garden_account_actors_actor_check
    check (actor_key ~ '^[0-9a-f]{64}$')
);

create table if not exists public.community_garden_region_actor_days (
  actor_key text not null,
  region_x smallint not null,
  region_y smallint not null,
  activity_date date not null,
  actor_kind text not null,
  meaningful_actions integer not null default 0,
  plants_placed integer not null default 0,
  watering_actions integer not null default 0,
  first_action_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  primary key (actor_key, region_x, region_y, activity_date),
  constraint community_garden_region_actor_days_actor_check
    check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_region_actor_days_kind_check
    check (actor_kind in ('account', 'guest')),
  constraint community_garden_region_actor_days_counts_check check (
    meaningful_actions between 0 and 2000000000
    and plants_placed between 0 and 2000000000
    and watering_actions between 0 and 2000000000
  )
);

create table if not exists public.community_garden_region_action_evidence (
  action_id uuid not null,
  region_x smallint not null,
  region_y smallint not null,
  actor_key text not null,
  actor_kind text not null,
  action_type text not null,
  recorded_at timestamptz not null default now(),
  primary key (action_id, region_x, region_y),
  constraint community_garden_region_action_evidence_actor_check
    check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_region_action_evidence_kind_check
    check (actor_kind in ('account', 'guest')),
  constraint community_garden_region_action_evidence_action_check
    check (action_type in ('plant', 'water', 'weed'))
);

create table if not exists public.community_garden_frontier_policy (
  singleton boolean primary key default true,
  policy_version text not null default 'quorum-frontier-v1',
  automation_enabled boolean not null default false,
  effective_region_capacity integer not null default 180,
  prepare_percent numeric(5,2) not null default 50,
  expand_percent numeric(5,2) not null default 60,
  target_percent numeric(5,2) not null default 55,
  supported_live_plants integer not null default 64,
  supported_subcells integer not null default 8,
  supported_accounts integer not null default 6,
  supported_active_days integer not null default 4,
  supported_consecutive_days integer not null default 3,
  max_regions_per_actor_day integer not null default 3,
  heritage_capacity_per_region integer not null default 9,
  updated_at timestamptz not null default now(),
  constraint community_garden_frontier_policy_singleton_check check (singleton),
  constraint community_garden_frontier_policy_version_check
    check (char_length(policy_version) between 1 and 80),
  constraint community_garden_frontier_policy_capacity_check
    check (effective_region_capacity between 1 and 256),
  constraint community_garden_frontier_policy_percent_check check (
    prepare_percent between 0 and 100
    and expand_percent between 0 and 100
    and target_percent > 0
    and target_percent <= 100
    and prepare_percent <= target_percent
    and target_percent <= expand_percent
  ),
  constraint community_garden_frontier_policy_thresholds_check check (
    supported_live_plants between 1 and 256
    and supported_subcells between 1 and 16
    and supported_accounts between 1 and 10000
    and supported_active_days between 1 and 7
    and supported_consecutive_days between 1 and 30
    and max_regions_per_actor_day between 1 and 32
    and heritage_capacity_per_region between 0 and 64
  )
);

insert into public.community_garden_frontier_policy (
  singleton, policy_version, automation_enabled,
  effective_region_capacity, prepare_percent, expand_percent, target_percent,
  supported_live_plants, supported_subcells, supported_accounts,
  supported_active_days, supported_consecutive_days,
  max_regions_per_actor_day, heritage_capacity_per_region
) values (
  true, 'quorum-frontier-v1', false,
  180, 50, 60, 55,
  64, 8, 6, 4, 3, 3, 9
)
on conflict (singleton) do nothing;

create table if not exists public.community_garden_frontier_world_evaluations (
  evaluation_date date primary key,
  evaluated_at timestamptz not null default now(),
  policy_version text not null,
  total_region_count integer not null,
  accessible_region_count integer not null,
  plant_count integer not null,
  effective_capacity integer not null,
  occupancy_percent numeric(7,2) not null,
  perimeter_region_count integer not null,
  required_accounts integer not null,
  active_accounts_7d integer not null,
  globally_qualified boolean not null,
  qualifying_frontier_regions integer not null default 0,
  recommended_expansion_count integer not null default 0,
  automation_enabled boolean not null,
  constraint community_garden_frontier_world_counts_check check (
    total_region_count >= 0
    and accessible_region_count >= 0
    and plant_count >= 0
    and effective_capacity >= 0
    and occupancy_percent >= 0
    and perimeter_region_count >= 0
    and required_accounts >= 0
    and active_accounts_7d >= 0
    and qualifying_frontier_regions >= 0
    and recommended_expansion_count >= 0
  )
);

create table if not exists public.community_garden_frontier_region_evaluations (
  evaluation_date date not null,
  region_x smallint not null,
  region_y smallint not null,
  region_exists boolean not null,
  land_state text not null,
  eligible_live_plants integer not null,
  covered_subcells integer not null,
  eligible_accounts_7d integer not null,
  active_days_7d integer not null,
  consecutive_support_days integer not null,
  locally_qualified boolean not null,
  globally_qualified boolean not null,
  recommended_action text not null default 'none',
  reasons jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  primary key (evaluation_date, region_x, region_y),
  constraint community_garden_frontier_region_state_check
    check (land_state in ('founding', 'established', 'frontier', 'fallow')),
  constraint community_garden_frontier_region_counts_check check (
    eligible_live_plants >= 0
    and covered_subcells between 0 and 16
    and eligible_accounts_7d >= 0
    and active_days_7d between 0 and 7
    and consecutive_support_days between 0 and 366
  ),
  constraint community_garden_frontier_region_action_check
    check (recommended_action in ('none', 'prepare', 'establish', 'restore')),
  constraint community_garden_frontier_region_reasons_check
    check (jsonb_typeof(reasons) = 'array')
);

create table if not exists public.community_garden_region_state_audit (
  id bigint generated always as identity primary key,
  region_x smallint not null,
  region_y smallint not null,
  previous_state text,
  next_state text not null,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  constraint community_garden_region_state_audit_previous_check check (
    previous_state is null
    or previous_state in ('founding', 'established', 'frontier', 'fallow')
  ),
  constraint community_garden_region_state_audit_next_check
    check (next_state in ('founding', 'established', 'frontier', 'fallow')),
  constraint community_garden_region_state_audit_reason_check
    check (char_length(reason) between 1 and 500)
);

create table if not exists public.community_garden_heritage_events (
  event_id uuid primary key default gen_random_uuid(),
  plant_id uuid not null unique
    references public.community_garden_roses(id) on delete cascade,
  planter_actor_key text not null,
  helper_actor_key text,
  region_x smallint not null,
  region_y smallint not null,
  plant_type text not null,
  became_heritage_at timestamptz not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  constraint community_garden_heritage_events_planter_check
    check (planter_actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_heritage_events_helper_check check (
    helper_actor_key is null or helper_actor_key ~ '^[0-9a-f]{64}$'
  )
);

create table if not exists public.community_garden_heritage_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.community_garden_heritage_events(event_id) on delete cascade,
  recipient_user_id uuid not null
    references auth.users(id) on delete cascade,
  plant_id uuid not null
    references public.community_garden_roses(id) on delete cascade,
  plant_type text not null,
  grid_x integer not null,
  grid_y integer not null,
  became_heritage_at timestamptz not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (recipient_user_id, event_id)
);

-- Preserve the entire present garden and seed every one of its 100 regions as
-- Founding land. This recounts metadata only; it never mutates a flower.
with region_grid as (
  select x::smallint as region_x, y::smallint as region_y
  from generate_series(-6, 3) as x
  cross join generate_series(-6, 3) as y
), region_totals as (
  select
    grid.region_x,
    grid.region_y,
    count(plant.id)::integer as plant_count,
    count(distinct plant.contributor_key)
      filter (where plant.contributor_key is not null)::integer
      as active_contributors
  from region_grid as grid
  left join public.community_garden_roses as plant
    on plant.region_x = grid.region_x and plant.region_y = grid.region_y
  group by grid.region_x, grid.region_y
)
insert into public.community_garden_regions (
  region_x, region_y, plant_count, active_contributors,
  pressure_state, stress_started_at, version, updated_at,
  land_state, is_founding, ring_index, opened_at, heritage_capacity
)
select
  totals.region_x,
  totals.region_y,
  totals.plant_count,
  totals.active_contributors,
  case
    when totals.plant_count >= 180 then 'resting'
    when totals.plant_count >= 140 then 'busy'
    else 'healthy'
  end,
  case when totals.plant_count >= 160 then statement_timestamp() else null end,
  floor(extract(epoch from statement_timestamp()) / 600)::bigint,
  statement_timestamp(),
  'founding', true, 0, statement_timestamp(), 9
from region_totals as totals
on conflict (region_x, region_y) do update set
  plant_count = excluded.plant_count,
  active_contributors = excluded.active_contributors,
  pressure_state = excluded.pressure_state,
  stress_started_at = case
    when excluded.plant_count >= 160 then coalesce(
      public.community_garden_regions.stress_started_at,
      excluded.stress_started_at
    )
    else null
  end,
  version = excluded.version,
  updated_at = excluded.updated_at,
  land_state = 'founding',
  is_founding = true,
  ring_index = 0,
  opened_at = coalesce(
    public.community_garden_regions.opened_at,
    excluded.opened_at
  ),
  heritage_capacity = 9;

create index if not exists community_garden_region_actor_days_region_idx
  on public.community_garden_region_actor_days (
    region_x, region_y, activity_date desc, actor_kind, actor_key
  );
create index if not exists community_garden_region_actor_days_actor_idx
  on public.community_garden_region_actor_days (activity_date desc, actor_key);
create index if not exists community_garden_region_evidence_actor_idx
  on public.community_garden_region_action_evidence (actor_key, recorded_at desc);
create index if not exists community_garden_region_evidence_region_idx
  on public.community_garden_region_action_evidence (
    region_x, region_y, recorded_at desc
  );
create index if not exists community_garden_region_evidence_recorded_idx
  on public.community_garden_region_action_evidence (recorded_at);
create index if not exists community_garden_regions_land_state_idx
  on public.community_garden_regions (
    land_state, latest_evaluation_date, region_x, region_y
  );
create index if not exists community_garden_frontier_world_date_idx
  on public.community_garden_frontier_world_evaluations (evaluation_date desc);
create index if not exists community_garden_frontier_region_action_idx
  on public.community_garden_frontier_region_evaluations (
    evaluation_date desc, recommended_action
  );
create index if not exists community_garden_frontier_region_lookup_idx
  on public.community_garden_frontier_region_evaluations (
    region_x, region_y, evaluation_date desc
  );
create index if not exists community_garden_region_state_audit_region_idx
  on public.community_garden_region_state_audit (
    region_x, region_y, created_at desc
  );
create index if not exists community_garden_heritage_events_planter_idx
  on public.community_garden_heritage_events (
    planter_actor_key, created_at desc
  );
create index if not exists community_garden_heritage_events_region_idx
  on public.community_garden_heritage_events (region_x, region_y);
create index if not exists community_garden_heritage_notifications_pending_idx
  on public.community_garden_heritage_notifications (
    recipient_user_id, created_at, id
  ) where acknowledged_at is null;
create index if not exists community_garden_roses_region_heritage_idx
  on public.community_garden_roses (region_x, region_y, heritage_at)
  where heritage_at is not null;

alter table public.community_garden_account_actors enable row level security;
alter table public.community_garden_region_actor_days enable row level security;
alter table public.community_garden_region_action_evidence enable row level security;
alter table public.community_garden_frontier_policy enable row level security;
alter table public.community_garden_frontier_world_evaluations enable row level security;
alter table public.community_garden_frontier_region_evaluations enable row level security;
alter table public.community_garden_region_state_audit enable row level security;
alter table public.community_garden_heritage_events enable row level security;
alter table public.community_garden_heritage_notifications enable row level security;

revoke all on table public.community_garden_account_actors
  from public, anon, authenticated;
revoke all on table public.community_garden_region_actor_days
  from public, anon, authenticated;
revoke all on table public.community_garden_region_action_evidence
  from public, anon, authenticated;
revoke all on table public.community_garden_frontier_policy
  from public, anon, authenticated;
revoke all on table public.community_garden_frontier_world_evaluations
  from public, anon, authenticated;
revoke all on table public.community_garden_frontier_region_evaluations
  from public, anon, authenticated;
revoke all on table public.community_garden_region_state_audit
  from public, anon, authenticated;
revoke all on table public.community_garden_heritage_events
  from public, anon, authenticated;
revoke all on table public.community_garden_heritage_notifications
  from public, anon, authenticated;

grant select, insert, update, delete on table
  public.community_garden_account_actors,
  public.community_garden_region_actor_days,
  public.community_garden_region_action_evidence,
  public.community_garden_frontier_policy,
  public.community_garden_frontier_world_evaluations,
  public.community_garden_frontier_region_evaluations,
  public.community_garden_region_state_audit,
  public.community_garden_heritage_events,
  public.community_garden_heritage_notifications
to service_role;

revoke all on sequence public.community_garden_region_state_audit_id_seq
  from public, anon, authenticated;

grant usage, select
  on sequence public.community_garden_region_state_audit_id_seq
  to service_role;

-- Serialize every tile and region placement. The same tile namespace is used
-- by weeds, preventing a snapshot insert from racing a player planting action.
create or replace function public.enforce_community_garden_plant_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_region_x smallint;
  target_region_y smallint;
  target_land_state text;
  region_capacity integer := 180;
  existing_plant_count integer;
begin
  target_region_x := floor(new.grid_x::numeric / 16)::smallint;
  target_region_y := floor(new.grid_y::numeric / 16)::smallint;
  new.region_x := target_region_x;
  new.region_y := target_region_y;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-tile:' || new.grid_x::text || ':' || new.grid_y::text,
    0
  ));
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-region:'
      || target_region_x::text || ':' || target_region_y::text,
    0
  ));

  select region.land_state
  into target_land_state
  from public.community_garden_regions as region
  where region.region_x = target_region_x
    and region.region_y = target_region_y
    and region.land_state in ('founding', 'established', 'frontier', 'fallow')
  for update;

  if not found then
    raise exception 'This part of the Community Garden has not opened yet.'
      using errcode = 'P0001';
  end if;

  if target_land_state = 'fallow' then
    raise exception 'This part of the Community Garden is resting and cannot be planted right now.'
      using errcode = 'P0001';
  end if;

  select policy.effective_region_capacity
  into region_capacity
  from public.community_garden_frontier_policy as policy
  where policy.singleton;
  region_capacity := coalesce(region_capacity, 180);

  if exists (
    select 1 from public.community_garden_weeds as weed
    where weed.grid_x = new.grid_x and weed.grid_y = new.grid_y
  ) then
    raise exception 'Pull this weed before planting here.'
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into existing_plant_count
  from public.community_garden_roses as plant
  where plant.region_x = target_region_x
    and plant.region_y = target_region_y;

  if existing_plant_count >= region_capacity then
    raise exception
      'This patch is resting. Choose a nearby open part of the garden.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Region state changes are deliberately manual in this release. The function
-- is service-role-only, requires an explanation, serializes on the region, and
-- writes an immutable audit record. The evaluator never calls it.
create or replace function public.set_community_garden_region_state_v1(
  p_region_x smallint,
  p_region_y smallint,
  p_land_state text,
  p_requested_by uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_state text := lower(trim(coalesce(p_land_state, '')));
  requested_reason text := trim(coalesce(p_reason, ''));
  current_region public.community_garden_regions%rowtype;
  region_exists boolean := false;
  adjacent_solid_regions integer := 0;
  selected_policy public.community_garden_frontier_policy%rowtype;
  calculated_ring smallint;
begin
  if requested_state not in ('founding', 'established', 'frontier', 'fallow') then
    raise exception 'Unsupported community-garden land state.';
  end if;
  if char_length(requested_reason) not between 1 and 500 then
    raise exception 'A reason between 1 and 500 characters is required.';
  end if;
  if p_requested_by is null
    or not exists (select 1 from auth.users where id = p_requested_by)
  then
    raise exception 'A valid requesting account is required.';
  end if;
  if p_region_x is null or p_region_y is null
    or p_region_x not between -128 and 127
    or p_region_y not between -128 and 127
  then
    raise exception 'Region coordinates are outside the supported world.';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'basil-community-region-state:' || p_region_x::text || ':' || p_region_y::text,
      0
    )
  );

  select region.*
  into current_region
  from public.community_garden_regions as region
  where region.region_x = p_region_x
    and region.region_y = p_region_y
  for update;

  -- Capture FOUND now. Subsequent SELECT statements must not be allowed to
  -- change the missing/existing decision for this region.
  region_exists := found;

  select policy.*
  into strict selected_policy
  from public.community_garden_frontier_policy as policy
  where policy.singleton;

  if not region_exists then
    if requested_state <> 'frontier' then
      raise exception 'A missing region must first be opened as frontier.';
    end if;

    select count(*)::integer
    into adjacent_solid_regions
    from public.community_garden_regions as neighbor
    where abs(neighbor.region_x - p_region_x)
        + abs(neighbor.region_y - p_region_y) = 1
      and neighbor.land_state in ('founding', 'established');

    if adjacent_solid_regions = 0 then
      raise exception 'A new frontier region must touch founding or established land.';
    end if;

    calculated_ring := greatest(
      -6 - p_region_x,
      p_region_x - 3,
      -6 - p_region_y,
      p_region_y - 3,
      0
    )::smallint;

    insert into public.community_garden_regions (
      region_x, region_y, plant_count, active_contributors,
      pressure_state, version, updated_at,
      land_state, is_founding, ring_index,
      opened_at, established_at, fallow_at,
      heritage_capacity, consecutive_support_days,
      latest_support
    ) values (
      p_region_x, p_region_y, 0, 0,
      'healthy', 0, statement_timestamp(),
      'frontier', false, calculated_ring,
      statement_timestamp(), null, null,
      selected_policy.heritage_capacity_per_region, 0,
      jsonb_build_object('openedReason', requested_reason)
    );

    insert into public.community_garden_region_state_audit (
      region_x, region_y, previous_state, next_state,
      requested_by, reason, policy_version
    ) values (
      p_region_x, p_region_y, null, 'frontier',
      p_requested_by, requested_reason, selected_policy.policy_version
    );

    return jsonb_build_object(
      'changed', true,
      'created', true,
      'regionX', p_region_x,
      'regionY', p_region_y,
      'previousState', null,
      'landState', 'frontier',
      'policyVersion', selected_policy.policy_version
    );
  end if;

  if current_region.land_state = requested_state then
    return jsonb_build_object(
      'changed', false,
      'created', false,
      'regionX', p_region_x,
      'regionY', p_region_y,
      'previousState', current_region.land_state,
      'landState', current_region.land_state,
      'policyVersion', selected_policy.policy_version
    );
  end if;

  if current_region.is_founding or current_region.land_state = 'founding' then
    raise exception 'Founding Garden regions are immutable.';
  end if;
  if requested_state = 'founding' then
    raise exception 'New regions cannot be promoted into the Founding Garden.';
  end if;

  update public.community_garden_regions
  set
    land_state = requested_state,
    established_at = case
      when requested_state = 'established'
        then coalesce(established_at, statement_timestamp())
      else established_at
    end,
    fallow_at = case
      when requested_state = 'fallow' then statement_timestamp()
      else null
    end,
    heritage_capacity = selected_policy.heritage_capacity_per_region,
    updated_at = statement_timestamp(),
    version = version + 1
  where region_x = p_region_x
    and region_y = p_region_y;

  insert into public.community_garden_region_state_audit (
    region_x, region_y, previous_state, next_state,
    requested_by, reason, policy_version
  ) values (
    p_region_x, p_region_y, current_region.land_state, requested_state,
    p_requested_by, requested_reason, selected_policy.policy_version
  );

  return jsonb_build_object(
    'changed', true,
    'created', false,
    'regionX', p_region_x,
    'regionY', p_region_y,
    'previousState', current_region.land_state,
    'landState', requested_state,
    'policyVersion', selected_policy.policy_version
  );
end;
$$;

-- Compact aggregate for the private owner health panel. There is one pass for
-- each independent metric; recommendations come from the most recent shadow
-- evaluation. No player identity or actor hash is exposed by this RPC.
create or replace function public.get_community_garden_frontier_health_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_policy public.community_garden_frontier_policy%rowtype;
  latest_world public.community_garden_frontier_world_evaluations%rowtype;
  latest_evaluation_date date;
  total_regions integer := 0;
  founding_regions integer := 0;
  established_regions integer := 0;
  frontier_regions integer := 0;
  fallow_regions integer := 0;
  accessible_regions integer := 0;
  live_plants integer := 0;
  effective_capacity bigint := 0;
  occupancy_percent_value numeric(8,2) := 0;
  perimeter_regions integer := 0;
  required_accounts_value integer := 12;
  active_accounts_value integer := 0;
  managed_heritage_flowers integer := 0;
  grandfathered_heritage_flowers integer := 0;
  heritage_capacity_value integer := 0;
  recommendations jsonb := '[]'::jsonb;
begin
  select policy.*
  into strict selected_policy
  from public.community_garden_frontier_policy as policy
  where policy.singleton;

  select evaluation.*
  into latest_world
  from public.community_garden_frontier_world_evaluations as evaluation
  order by evaluation.evaluation_date desc
  limit 1;
  latest_evaluation_date := latest_world.evaluation_date;

  select
    count(*)::integer,
    count(*) filter (where region.land_state = 'founding')::integer,
    count(*) filter (where region.land_state = 'established')::integer,
    count(*) filter (where region.land_state = 'frontier')::integer,
    count(*) filter (where region.land_state = 'fallow')::integer,
    count(*) filter (
      where region.land_state in ('founding', 'established', 'frontier')
    )::integer,
    coalesce(sum(region.heritage_capacity) filter (
      where region.land_state in ('founding', 'established')
    ), 0)::integer
  into
    total_regions,
    founding_regions,
    established_regions,
    frontier_regions,
    fallow_regions,
    accessible_regions,
    heritage_capacity_value
  from public.community_garden_regions as region;

  select count(*)::integer
  into live_plants
  from public.community_garden_roses as plant
  join public.community_garden_regions as region
    on region.region_x = plant.region_x and region.region_y = plant.region_y
  where region.land_state in ('founding', 'established', 'frontier')
    and (
      plant.heritage_at is not null
      or (
        (plant.succession_at is null or plant.succession_at > statement_timestamp())
        and (plant.absolute_expires_at is null
          or plant.absolute_expires_at > statement_timestamp())
        and (plant.guest_expires_at is null
          or plant.guest_expires_at > statement_timestamp())
      )
    );

  effective_capacity := accessible_regions::bigint
    * selected_policy.effective_region_capacity::bigint;
  occupancy_percent_value := case
    when effective_capacity <= 0 then 0
    else round(100 * live_plants::numeric / effective_capacity::numeric, 2)
  end;

  with solid_regions as (
    select region_x, region_y
    from public.community_garden_regions
    where land_state in ('founding', 'established')
  ),
  absent_neighbors as (
    select (solid.region_x + direction.dx)::smallint as region_x,
           (solid.region_y + direction.dy)::smallint as region_y
    from solid_regions as solid
    cross join (values (1,0),(-1,0),(0,1),(0,-1)) as direction(dx,dy)
    left join public.community_garden_regions as existing
      on existing.region_x = solid.region_x + direction.dx
     and existing.region_y = solid.region_y + direction.dy
    where existing.region_x is null
  )
  select count(*)::integer
  into perimeter_regions
  from (select distinct region_x, region_y from absent_neighbors) as perimeter;

  required_accounts_value := greatest(12, ceil(perimeter_regions::numeric / 3)::integer);

  with ranked_account_regions as (
    select
      day.actor_key,
      day.activity_date,
      row_number() over (
        partition by day.actor_key, day.activity_date
        order by day.meaningful_actions desc,
                 day.last_action_at desc,
                 day.region_x,
                 day.region_y
      ) as credited_region_number
    from public.community_garden_region_actor_days as day
    where day.actor_kind = 'account'
      and day.activity_date between current_date - 6 and current_date
  )
  select count(distinct actor_key)::integer
  into active_accounts_value
  from ranked_account_regions
  where credited_region_number <= selected_policy.max_regions_per_actor_day;

  select count(*)::integer
  into managed_heritage_flowers
  from public.community_garden_heritage_events;

  select greatest(
    count(*)::integer - managed_heritage_flowers,
    0
  )
  into grandfathered_heritage_flowers
  from public.community_garden_roses
  where heritage_at is not null;

  if latest_evaluation_date is not null then
    select coalesce(jsonb_agg(item order by candidate_order), '[]'::jsonb)
    into recommendations
    from (
      select
        row_number() over (
          order by
            case evaluation.recommended_action
              when 'restore' then 0
              when 'establish' then 1
              else 2
            end,
            evaluation.eligible_accounts_7d desc,
            evaluation.eligible_live_plants desc,
            evaluation.region_x,
            evaluation.region_y
        ) as candidate_order,
        jsonb_build_object(
          'regionX', evaluation.region_x,
          'regionY', evaluation.region_y,
          'regionExists', evaluation.region_exists,
          'currentState', evaluation.land_state,
          'recommendedAction', evaluation.recommended_action,
          'eligibleLivePlants', evaluation.eligible_live_plants,
          'coveredSubcells', evaluation.covered_subcells,
          'eligibleAccounts7d', evaluation.eligible_accounts_7d,
          'activeDays7d', evaluation.active_days_7d,
          'consecutiveSupportDays', evaluation.consecutive_support_days,
          'reasons', evaluation.reasons
        ) as item
      from public.community_garden_frontier_region_evaluations as evaluation
      where evaluation.evaluation_date = latest_evaluation_date
        and evaluation.recommended_action <> 'none'
      order by
        case evaluation.recommended_action
          when 'restore' then 0
          when 'establish' then 1
          else 2
        end,
        evaluation.eligible_accounts_7d desc,
        evaluation.eligible_live_plants desc,
        evaluation.region_x,
        evaluation.region_y
      limit 6
    ) as ranked;
  end if;

  return jsonb_build_object(
    'mode', 'shadow',
    'policyVersion', selected_policy.policy_version,
    'automationEnabled', selected_policy.automation_enabled,
    'evaluatedAt', latest_world.evaluated_at,
    'evaluationDate', latest_evaluation_date,
    'regions', jsonb_build_object(
      'total', total_regions,
      'founding', founding_regions,
      'established', established_regions,
      'frontier', frontier_regions,
      'fallow', fallow_regions,
      'qualifyingFrontier',
        coalesce(latest_world.qualifying_frontier_regions, 0)
    ),
    'capacity', jsonb_build_object(
      'plants', live_plants,
      'effectiveCapacity', effective_capacity,
      'occupancyPercent', occupancy_percent_value,
      'prepareAtPercent', selected_policy.prepare_percent,
      'expandAtPercent', selected_policy.expand_percent,
      'targetPercent', selected_policy.target_percent
    ),
    'quorum', jsonb_build_object(
      'perimeterRegions', perimeter_regions,
      'requiredAccounts', required_accounts_value,
      'activeAccounts7d', active_accounts_value,
      'globallyQualified', coalesce(latest_world.globally_qualified, false)
    ),
    'heritage', jsonb_build_object(
      'flowers', managed_heritage_flowers,
      'capacity', heritage_capacity_value,
      'grandfatheredFlowers', grandfathered_heritage_flowers
    ),
    'recommendations', recommendations
  );
end;
$$;

drop trigger if exists enforce_community_garden_plant_insert
  on public.community_garden_roses;
create trigger enforce_community_garden_plant_insert
before insert on public.community_garden_roses
for each row execute function public.enforce_community_garden_plant_insert_v1();

create or replace function public.enforce_community_garden_weed_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.region_x := floor(new.grid_x::numeric / 16)::smallint;
  new.region_y := floor(new.grid_y::numeric / 16)::smallint;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-tile:' || new.grid_x::text || ':' || new.grid_y::text,
    0
  ));
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-region:' || new.region_x::text || ':' || new.region_y::text,
    0
  ));

  if not exists (
    select 1
    from public.community_garden_regions as region
    where region.region_x = new.region_x
      and region.region_y = new.region_y
      and region.land_state in ('founding', 'established', 'frontier', 'fallow')
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.community_garden_roses as plant
    where plant.grid_x = new.grid_x and plant.grid_y = new.grid_y
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_community_garden_weed_insert
  on public.community_garden_weeds;
create trigger enforce_community_garden_weed_insert
before insert on public.community_garden_weeds
for each row execute function public.enforce_community_garden_weed_insert_v1();

-- Only newly promoted, account-owned flowers consume the nine-event regional
-- Heritage budget. Existing Heritage rows are intentionally grandfathered and
-- do not appear in community_garden_heritage_events.
create or replace function public.enforce_community_garden_heritage_capacity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_land_state text;
  target_capacity integer;
  current_event_count integer;
begin
  if old.heritage_at is not null or new.heritage_at is null then
    return new;
  end if;

  if new.contributor_kind <> 'account' or new.contributor_key is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-heritage:'
      || new.region_x::text || ':' || new.region_y::text,
    0
  ));

  select region.land_state, region.heritage_capacity
  into target_land_state, target_capacity
  from public.community_garden_regions as region
  where region.region_x = new.region_x and region.region_y = new.region_y
  for update;

  if not found or target_land_state not in ('founding', 'established') then
    return null;
  end if;

  select count(*)::integer
  into current_event_count
  from public.community_garden_heritage_events as event
  where event.region_x = new.region_x and event.region_y = new.region_y;

  if current_event_count >= target_capacity then
    return null;
  end if;

  new.guest_expires_at := null;
  new.succession_at := null;
  new.absolute_expires_at := null;
  return new;
end;
$$;

drop trigger if exists enforce_community_garden_heritage_capacity
  on public.community_garden_roses;
create trigger enforce_community_garden_heritage_capacity
before update of heritage_at on public.community_garden_roses
for each row
execute function public.enforce_community_garden_heritage_capacity_v1();

create or replace function public.record_community_garden_heritage_event_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_event_id uuid;
  helper_key text;
  selected_policy_version text := 'quorum-frontier-v1';
begin
  if old.heritage_at is not null or new.heritage_at is null then
    return new;
  end if;

  helper_key := nullif(
    pg_catalog.current_setting('basil.helper_actor_key', true),
    ''
  );
  if helper_key is not null and helper_key !~ '^[0-9a-f]{64}$' then
    helper_key := null;
  end if;

  select policy.policy_version
  into selected_policy_version
  from public.community_garden_frontier_policy as policy
  where policy.singleton;
  selected_policy_version := coalesce(
    selected_policy_version,
    'quorum-frontier-v1'
  );

  insert into public.community_garden_heritage_events (
    plant_id, planter_actor_key, helper_actor_key,
    region_x, region_y, plant_type, became_heritage_at, policy_version
  ) values (
    new.id, new.contributor_key, helper_key,
    new.region_x, new.region_y, new.plant_type,
    new.heritage_at, selected_policy_version
  )
  on conflict (plant_id) do nothing
  returning event_id into created_event_id;

  if created_event_id is null then
    select event.event_id
    into created_event_id
    from public.community_garden_heritage_events as event
    where event.plant_id = new.id;
  end if;

  insert into public.community_garden_heritage_notifications (
    event_id, recipient_user_id, plant_id, plant_type,
    grid_x, grid_y, became_heritage_at
  )
  select
    created_event_id, mapping.user_id, new.id, new.plant_type,
    new.grid_x, new.grid_y, new.heritage_at
  from public.community_garden_account_actors as mapping
  where mapping.actor_key = new.contributor_key
  on conflict (recipient_user_id, event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists record_community_garden_heritage_event
  on public.community_garden_roses;
create trigger record_community_garden_heritage_event
after update of heritage_at on public.community_garden_roses
for each row execute function public.record_community_garden_heritage_event_v1();

create or replace function public.register_community_garden_account_actor_v1(
  p_user_id uuid,
  p_actor_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflicting_user_id uuid;
begin
  if p_user_id is null
    or p_actor_key is null
    or p_actor_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden account could not be verified.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'This garden account no longer exists.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-account-actor:' || p_actor_key,
    0
  ));

  select mapping.user_id
  into conflicting_user_id
  from public.community_garden_account_actors as mapping
  where mapping.actor_key = p_actor_key and mapping.user_id <> p_user_id
  for update;

  if conflicting_user_id is not null then
    raise exception 'This garden identity belongs to another account.'
      using errcode = '42501';
  end if;

  insert into public.community_garden_account_actors (user_id, actor_key)
  values (p_user_id, p_actor_key)
  on conflict (user_id) do update set
    actor_key = excluded.actor_key,
    updated_at = statement_timestamp();

  -- Registration can occur just after the action that created an event. Fill
  -- any planter notices which could not be addressed before this mapping existed.
  insert into public.community_garden_heritage_notifications (
    event_id, recipient_user_id, plant_id, plant_type,
    grid_x, grid_y, became_heritage_at
  )
  select
    event.event_id,
    p_user_id,
    event.plant_id,
    event.plant_type,
    plant.grid_x,
    plant.grid_y,
    event.became_heritage_at
  from public.community_garden_heritage_events as event
  join public.community_garden_roses as plant on plant.id = event.plant_id
  where event.planter_actor_key = p_actor_key
  on conflict (recipient_user_id, event_id) do nothing;

  return jsonb_build_object('registered', true);
end;
$$;

create or replace function public.reconcile_community_garden_actor_v2(
  p_user_id uuid,
  p_guest_actor_key text,
  p_account_actor_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconciliation jsonb;
begin
  if p_user_id is null
    or p_guest_actor_key is null
    or p_account_actor_key is null
    or p_guest_actor_key !~ '^[0-9a-f]{64}$'
    or p_account_actor_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden identity could not be verified.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-actor:'
      || least(p_guest_actor_key, p_account_actor_key),
    0
  ));
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-actor:'
      || greatest(p_guest_actor_key, p_account_actor_key),
    0
  ));

  perform public.register_community_garden_account_actor_v1(
    p_user_id,
    p_account_actor_key
  );

  reconciliation := public.reconcile_community_garden_actor_v1(
    p_guest_actor_key,
    p_account_actor_key
  );

  if p_guest_actor_key = p_account_actor_key then
    update public.community_garden_region_actor_days
    set actor_kind = 'account'
    where actor_key = p_account_actor_key;
    update public.community_garden_region_action_evidence
    set actor_kind = 'account'
    where actor_key = p_account_actor_key;
    return coalesce(reconciliation, '{}'::jsonb)
      || jsonb_build_object('accountActorRegistered', true);
  end if;

  insert into public.community_garden_region_actor_days (
    actor_key, region_x, region_y, activity_date, actor_kind,
    meaningful_actions, plants_placed, watering_actions,
    first_action_at, last_action_at
  )
  select
    p_account_actor_key, day.region_x, day.region_y, day.activity_date,
    'account', day.meaningful_actions, day.plants_placed,
    day.watering_actions, day.first_action_at, day.last_action_at
  from public.community_garden_region_actor_days as day
  where day.actor_key = p_guest_actor_key
  on conflict (actor_key, region_x, region_y, activity_date) do update set
    actor_kind = 'account',
    meaningful_actions = least(
      2000000000::bigint,
      public.community_garden_region_actor_days.meaningful_actions::bigint
        + excluded.meaningful_actions
    )::integer,
    plants_placed = least(
      2000000000::bigint,
      public.community_garden_region_actor_days.plants_placed::bigint
        + excluded.plants_placed
    )::integer,
    watering_actions = least(
      2000000000::bigint,
      public.community_garden_region_actor_days.watering_actions::bigint
        + excluded.watering_actions
    )::integer,
    first_action_at = least(
      public.community_garden_region_actor_days.first_action_at,
      excluded.first_action_at
    ),
    last_action_at = greatest(
      public.community_garden_region_actor_days.last_action_at,
      excluded.last_action_at
    );

  delete from public.community_garden_region_actor_days
  where actor_key = p_guest_actor_key;

  update public.community_garden_region_action_evidence
  set actor_key = p_account_actor_key, actor_kind = 'account'
  where actor_key = p_guest_actor_key;

  return coalesce(reconciliation, '{}'::jsonb)
    || jsonb_build_object('accountActorRegistered', true);
end;
$$;

create or replace function public.get_community_garden_heritage_notifications_v1(
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', notification.id,
        'eventId', notification.event_id,
        'plantId', notification.plant_id,
        'plantType', notification.plant_type,
        'gridX', notification.grid_x,
        'gridY', notification.grid_y,
        'becameHeritageAt', notification.became_heritage_at,
        'createdAt', notification.created_at
      ) order by notification.created_at, notification.id
    ),
    '[]'::jsonb
  )
  from (
    select pending.*
    from public.community_garden_heritage_notifications as pending
    where pending.recipient_user_id = p_user_id
      and pending.acknowledged_at is null
    order by pending.created_at, pending.id
    limit 20
  ) as notification
$$;

create or replace function public.acknowledge_community_garden_heritage_notifications_v1(
  p_user_id uuid,
  p_notification_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acknowledged_count integer := 0;
begin
  if p_user_id is null
    or coalesce(cardinality(p_notification_ids), 0) < 1
    or cardinality(p_notification_ids) > 20
  then
    raise exception 'Choose valid Heritage Flower notices.'
      using errcode = '22023';
  end if;

  with acknowledged as (
    update public.community_garden_heritage_notifications as notification
    set acknowledged_at = statement_timestamp()
    where notification.recipient_user_id = p_user_id
      and notification.id = any(p_notification_ids)
      and notification.acknowledged_at is null
    returning notification.id
  )
  select count(*)::integer into acknowledged_count from acknowledged;

  return jsonb_build_object('acknowledged', acknowledged_count);
end;
$$;

-- Preserve the exact server-facing v9 signature. v8 remains the authoritative
-- transaction; v9 adds identity class, regional evidence, and additive
-- Heritage moments without changing reward or conflict behavior.
create or replace function public.perform_idempotent_community_garden_action_v9(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
  p_is_guest boolean,
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
  result_payload jsonb;
  planted_id uuid;
  target_region_x smallint;
  target_region_y smallint;
  weed_region_x smallint;
  weed_region_y smallint;
  affected_region record;
  inserted_evidence_count integer;
  evidence_time timestamptz;
  evidence_day date;
  actor_kind_value text;
  heritage_ids uuid[] := array[]::uuid[];
  heritage_moments jsonb := '[]'::jsonb;
  heritage_event record;
  action_time timestamptz := statement_timestamp();
begin
  if p_is_guest is null then
    raise exception 'This garden identity could not be verified.'
      using errcode = '22023';
  end if;

  actor_kind_value := case when p_is_guest then 'guest' else 'account' end;

  perform pg_catalog.set_config(
    'basil.helper_actor_key',
    coalesce(p_actor_key, ''),
    true
  );

  if p_action_type = 'plant'
    and p_grid_x is not null
    and p_grid_y is not null
  then
    target_region_x := floor(p_grid_x::numeric / 16)::smallint;
    target_region_y := floor(p_grid_y::numeric / 16)::smallint;
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'basil-community-tile:' || p_grid_x::text || ':' || p_grid_y::text,
      0
    ));
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'basil-community-region:'
        || target_region_x::text || ':' || target_region_y::text,
      0
    ));
  elsif p_action_type = 'weed'
    and coalesce(cardinality(p_plant_ids), 0) = 1
  then
    select weed.region_x, weed.region_y
    into weed_region_x, weed_region_y
    from public.community_garden_weeds as weed
    where weed.id = p_plant_ids[1];
  end if;

  result_payload := public.perform_idempotent_community_garden_action_v8(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );

  if p_action_type = 'plant' then
    planted_id := nullif(result_payload #>> '{plant,id}', '')::uuid;
    if planted_id is not null then
      update public.community_garden_roses
      set
        contributor_kind = actor_kind_value,
        guest_expires_at = case
          when p_is_guest then coalesce(
            guest_expires_at,
            planted_at + interval '24 hours'
          )
          else null
        end
      where id = planted_id
        and contributor_key = p_actor_key
        and heritage_at is null;
    end if;
  end if;

  -- community_garden_actions has created_at and completed_at. Use the stored
  -- timestamp so a retry cannot shift a prior action into another UTC day.
  select coalesce(action.completed_at, action.created_at, action_time)
  into evidence_time
  from public.community_garden_actions as action
  where action.action_id = p_action_id;
  evidence_time := coalesce(evidence_time, action_time);
  evidence_day := (evidence_time at time zone 'utc')::date;

  for affected_region in
    with response_plants as (
      select element.value
      from jsonb_array_elements(
        case
          when jsonb_typeof(result_payload -> 'plants') = 'array'
            then result_payload -> 'plants'
          when jsonb_typeof(result_payload -> 'plant') = 'object'
            then jsonb_build_array(result_payload -> 'plant')
          else '[]'::jsonb
        end
      ) as element(value)
      where element.value ? 'grid_x' and element.value ? 'grid_y'
    ), affected_regions as (
      select distinct
        floor(((value ->> 'grid_x')::integer)::numeric / 16)::smallint
          as region_x,
        floor(((value ->> 'grid_y')::integer)::numeric / 16)::smallint
          as region_y
      from response_plants
      union
      select weed_region_x, weed_region_y
      where p_action_type = 'weed'
        and weed_region_x is not null and weed_region_y is not null
    )
    select region_x, region_y
    from affected_regions
    order by region_x, region_y
  loop
    insert into public.community_garden_region_action_evidence (
      action_id, region_x, region_y, actor_key,
      actor_kind, action_type, recorded_at
    ) values (
      p_action_id,
      affected_region.region_x,
      affected_region.region_y,
      p_actor_key,
      actor_kind_value,
      p_action_type,
      evidence_time
    )
    on conflict (action_id, region_x, region_y) do nothing;
    get diagnostics inserted_evidence_count = row_count;

    if inserted_evidence_count = 1 then
      insert into public.community_garden_region_actor_days (
        actor_key, region_x, region_y, activity_date, actor_kind,
        meaningful_actions, plants_placed, watering_actions,
        first_action_at, last_action_at
      ) values (
        p_actor_key,
        affected_region.region_x,
        affected_region.region_y,
        evidence_day,
        actor_kind_value,
        1,
        case when p_action_type = 'plant' then 1 else 0 end,
        case when p_action_type = 'water' then 1 else 0 end,
        evidence_time,
        evidence_time
      )
      on conflict (actor_key, region_x, region_y, activity_date) do update set
        actor_kind = case
          when public.community_garden_region_actor_days.actor_kind = 'account'
            or excluded.actor_kind = 'account'
          then 'account' else 'guest'
        end,
        meaningful_actions = least(
          2000000000::bigint,
          public.community_garden_region_actor_days.meaningful_actions::bigint + 1
        )::integer,
        plants_placed = least(
          2000000000::bigint,
          public.community_garden_region_actor_days.plants_placed::bigint
            + case when p_action_type = 'plant' then 1 else 0 end
        )::integer,
        watering_actions = least(
          2000000000::bigint,
          public.community_garden_region_actor_days.watering_actions::bigint
            + case when p_action_type = 'water' then 1 else 0 end
        )::integer,
        first_action_at = least(
          public.community_garden_region_actor_days.first_action_at,
          excluded.first_action_at
        ),
        last_action_at = greatest(
          public.community_garden_region_actor_days.last_action_at,
          excluded.last_action_at
        );
    end if;
  end loop;

  if jsonb_typeof(result_payload -> 'heritagePlantIds') = 'array' then
    select coalesce(array_agg(distinct parsed.plant_id), array[]::uuid[])
    into heritage_ids
    from (
      select value::uuid as plant_id
      from jsonb_array_elements_text(
        result_payload -> 'heritagePlantIds'
      ) as item(value)
      where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) as parsed;
  end if;

  for heritage_event in
    select
      event.event_id,
      event.plant_id,
      event.planter_actor_key,
      event.plant_type,
      event.became_heritage_at,
      plant.grid_x,
      plant.grid_y,
      case
        when event.planter_actor_key = p_actor_key then 'planter'
        else 'helper'
      end as actor_role,
      case
        when event.planter_actor_key = p_actor_key then notification.id
        else null
      end as notification_id
    from unnest(heritage_ids) as promoted(plant_id)
    join public.community_garden_heritage_events as event
      on event.plant_id = promoted.plant_id
    join public.community_garden_roses as plant on plant.id = event.plant_id
    left join public.community_garden_account_actors as mapping
      on mapping.actor_key = event.planter_actor_key
     and mapping.actor_key = p_actor_key
    left join public.community_garden_heritage_notifications as notification
      on notification.event_id = event.event_id
     and notification.recipient_user_id = mapping.user_id
    order by event.became_heritage_at, event.event_id
  loop
    heritage_moments := heritage_moments || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'eventId', heritage_event.event_id,
        'notificationId', heritage_event.notification_id,
        'plantId', heritage_event.plant_id,
        'plantType', heritage_event.plant_type,
        'gridX', heritage_event.grid_x,
        'gridY', heritage_event.grid_y,
        'role', heritage_event.actor_role,
        'becameHeritageAt', heritage_event.became_heritage_at
      ))
    );
  end loop;

  result_payload := jsonb_set(
    result_payload,
    '{heritageMoments}',
    heritage_moments,
    true
  );

  update public.community_garden_actions
  set response_payload = result_payload
  where action_id = p_action_id and status = 'completed';

  return result_payload;
end;
$$;

create or replace function public.evaluate_community_garden_frontier_v1(
  p_evaluation_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_policy public.community_garden_frontier_policy%rowtype;
  evaluation_day date := coalesce(
    p_evaluation_date,
    (statement_timestamp() at time zone 'utc')::date
  );
  evaluation_as_of timestamptz;
  window_start date;
  total_regions integer;
  accessible_regions integer;
  live_plants integer;
  effective_capacity integer;
  occupancy_percent_value numeric(7,2);
  perimeter_regions integer;
  required_accounts_value integer;
  active_accounts_value integer;
  globally_qualified_value boolean;
  recommended_expansion_count integer := 0;
  qualifying_frontier_count integer := 0;
  target_record record;
  target_live_plants integer;
  target_subcells integer;
  target_accounts integer;
  target_active_days integer;
  target_side_adjacent boolean;
  previous_consecutive integer;
  next_consecutive integer;
  daily_support boolean;
  locally_qualified_value boolean;
  reasons_value jsonb;
begin
  if evaluation_day > (statement_timestamp() at time zone 'utc')::date then
    raise exception 'A future frontier date cannot be evaluated.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-frontier-evaluation:' || evaluation_day::text,
    0
  ));

  select *
  into selected_policy
  from public.community_garden_frontier_policy
  where singleton
  for update;
  if not found then
    raise exception 'The Community Garden frontier policy is unavailable.'
      using errcode = 'P0001';
  end if;

  evaluation_as_of := least(
    statement_timestamp(),
    ((evaluation_day + 1)::timestamp at time zone 'utc')
  );
  window_start := evaluation_day - 6;

  select count(*)::integer, count(*) filter (
    where land_state in ('founding', 'established', 'frontier')
  )::integer
  into total_regions, accessible_regions
  from public.community_garden_regions;

  select count(*)::integer
  into live_plants
  from public.community_garden_roses as plant
  join public.community_garden_regions as region
    on region.region_x = plant.region_x and region.region_y = plant.region_y
  where region.land_state in ('founding', 'established', 'frontier')
    and plant.planted_at <= evaluation_as_of
    and (
      plant.heritage_at is not null
      or (
        (plant.succession_at is null or plant.succession_at > evaluation_as_of)
        and (
          plant.absolute_expires_at is null
          or plant.absolute_expires_at > evaluation_as_of
        )
        and (
          plant.guest_expires_at is null
          or plant.guest_expires_at > evaluation_as_of
        )
        and plant.last_watered_at > evaluation_as_of - case plant.plant_type
          when 'sunflower' then interval '66 hours'
          when 'lavender' then interval '168 hours'
          else interval '102 hours'
        end
      )
    );

  effective_capacity :=
    accessible_regions * selected_policy.effective_region_capacity;
  occupancy_percent_value := case
    when effective_capacity <= 0 then 0
    else round(live_plants::numeric / effective_capacity * 100, 2)
  end;

  with solid_land as (
    select region_x, region_y
    from public.community_garden_regions
    where land_state in ('founding', 'established')
  ), neighboring_coordinates as (
    select (region_x + 1)::smallint as region_x, region_y from solid_land
    union
    select (region_x - 1)::smallint, region_y from solid_land
    union
    select region_x, (region_y + 1)::smallint from solid_land
    union
    select region_x, (region_y - 1)::smallint from solid_land
  )
  select count(*)::integer
  into perimeter_regions
  from neighboring_coordinates as candidate
  where not exists (
    select 1 from public.community_garden_regions as existing
    where existing.region_x = candidate.region_x
      and existing.region_y = candidate.region_y
  );

  required_accounts_value := greatest(
    12,
    ceil(perimeter_regions::numeric / 3)::integer
  );

  with ranked_account_regions as (
    select
      day.actor_key,
      day.activity_date,
      row_number() over (
        partition by day.actor_key, day.activity_date
        order by day.first_action_at, day.region_x, day.region_y
      ) as credited_region_number
    from public.community_garden_region_actor_days as day
    where day.actor_kind = 'account'
      and day.meaningful_actions > 0
      and day.activity_date between window_start and evaluation_day
  )
  select count(distinct actor_key)::integer
  into active_accounts_value
  from ranked_account_regions
  where credited_region_number <= selected_policy.max_regions_per_actor_day;

  globally_qualified_value :=
    occupancy_percent_value >= selected_policy.expand_percent
    and active_accounts_value >= required_accounts_value;

  -- Evaluate both recorded regions and every truly absent, side-adjacent
  -- frontier candidate. Existing frontier/fallow regions use activity within
  -- themselves; absent candidates temporarily derive support from adjacent
  -- solid land until an owner deliberately opens them for planting.
  for target_record in
    with solid_land as (
      select region_x, region_y
      from public.community_garden_regions
      where land_state in ('founding', 'established')
    ), neighboring_coordinates as (
      select (region_x + 1)::smallint as region_x, region_y from solid_land
      union
      select (region_x - 1)::smallint, region_y from solid_land
      union
      select region_x, (region_y + 1)::smallint from solid_land
      union
      select region_x, (region_y - 1)::smallint from solid_land
    ), missing_frontier as (
      select candidate.region_x, candidate.region_y
      from neighboring_coordinates as candidate
      where not exists (
        select 1 from public.community_garden_regions as existing
        where existing.region_x = candidate.region_x
          and existing.region_y = candidate.region_y
      )
    ), evaluation_targets as (
      select
        region.region_x,
        region.region_y,
        true as region_exists,
        region.land_state
      from public.community_garden_regions as region
      union all
      select
        missing.region_x,
        missing.region_y,
        false,
        'frontier'::text
      from missing_frontier as missing
    )
    select * from evaluation_targets
    order by region_x, region_y
  loop
    target_side_adjacent := target_record.land_state in ('founding', 'established')
      or exists (
        select 1
        from public.community_garden_regions as neighbor
        where neighbor.land_state in ('founding', 'established')
          and abs(neighbor.region_x - target_record.region_x)
            + abs(neighbor.region_y - target_record.region_y) = 1
      );

    with source_regions as (
      select source.region_x, source.region_y
      from public.community_garden_regions as source
      where (
          (
            target_record.region_exists
            and source.region_x = target_record.region_x
            and source.region_y = target_record.region_y
          )
          or (
            not target_record.region_exists
            and source.land_state in ('founding', 'established')
            and abs(source.region_x - target_record.region_x)
              + abs(source.region_y - target_record.region_y) = 1
          )
        )
    )
    select
      count(plant.id)::integer,
      least(
        16,
        count(distinct (
          source.region_x,
          source.region_y,
          (
            ((plant.grid_x - source.region_x * 16) / 4) * 4
            + ((plant.grid_y - source.region_y * 16) / 4)
          )
        )) filter (where plant.id is not null)::integer
      )
    into target_live_plants, target_subcells
    from source_regions as source
    left join public.community_garden_roses as plant
      on plant.region_x = source.region_x
     and plant.region_y = source.region_y
     and plant.contributor_kind = 'account'
     and plant.planted_at <= evaluation_as_of
     and (
       plant.heritage_at is not null
       or (
         (plant.succession_at is null
           or plant.succession_at > evaluation_as_of)
         and (plant.absolute_expires_at is null
           or plant.absolute_expires_at > evaluation_as_of)
         and (plant.guest_expires_at is null
           or plant.guest_expires_at > evaluation_as_of)
         and plant.last_watered_at > evaluation_as_of - case plant.plant_type
           when 'sunflower' then interval '66 hours'
           when 'lavender' then interval '168 hours'
           else interval '102 hours'
         end
       )
     );

    if target_record.region_exists
      and target_record.land_state in ('founding', 'established')
    then
      select
        count(distinct day.actor_key)::integer,
        count(distinct day.activity_date)::integer
      into target_accounts, target_active_days
      from public.community_garden_region_actor_days as day
      where day.actor_kind = 'account'
        and day.meaningful_actions > 0
        and day.region_x = target_record.region_x
        and day.region_y = target_record.region_y
        and day.activity_date between window_start and evaluation_day;
    else
      -- Rank actual frontier candidates, not source regions. One account may
      -- support at most N distinct frontier targets per UTC day, even when a
      -- single busy source region touches several unopened candidates.
      with solid_land as (
        select region_x, region_y
        from public.community_garden_regions
        where land_state in ('founding', 'established')
      ), neighboring_coordinates as (
        select (region_x + 1)::smallint as region_x, region_y from solid_land
        union
        select (region_x - 1)::smallint, region_y from solid_land
        union
        select region_x, (region_y + 1)::smallint from solid_land
        union
        select region_x, (region_y - 1)::smallint from solid_land
      ), frontier_targets as (
        select
          region.region_x,
          region.region_y,
          true as region_exists
        from public.community_garden_regions as region
        where region.land_state in ('frontier', 'fallow')
        union
        select
          candidate.region_x,
          candidate.region_y,
          false
        from neighboring_coordinates as candidate
        where not exists (
          select 1
          from public.community_garden_regions as existing
          where existing.region_x = candidate.region_x
            and existing.region_y = candidate.region_y
        )
      ), candidate_sources as (
        select
          candidate.region_x as candidate_region_x,
          candidate.region_y as candidate_region_y,
          source.region_x as source_region_x,
          source.region_y as source_region_y
        from frontier_targets as candidate
        join public.community_garden_regions as source
          on (
            candidate.region_exists
            and source.region_x = candidate.region_x
            and source.region_y = candidate.region_y
          ) or (
            not candidate.region_exists
            and source.land_state in ('founding', 'established')
            and abs(source.region_x - candidate.region_x)
              + abs(source.region_y - candidate.region_y) = 1
          )
      ), candidate_activity as (
        select
          source.candidate_region_x,
          source.candidate_region_y,
          day.actor_key,
          day.activity_date,
          min(day.first_action_at) as first_support_at
        from candidate_sources as source
        join public.community_garden_region_actor_days as day
          on day.region_x = source.source_region_x
         and day.region_y = source.source_region_y
        where day.actor_kind = 'account'
          and day.meaningful_actions > 0
          and day.activity_date between window_start and evaluation_day
        group by
          source.candidate_region_x,
          source.candidate_region_y,
          day.actor_key,
          day.activity_date
      ), ranked_candidate_activity as (
        select
          activity.*,
          row_number() over (
            partition by activity.actor_key, activity.activity_date
            order by
              activity.first_support_at,
              activity.candidate_region_x,
              activity.candidate_region_y
          ) as credited_candidate_number
        from candidate_activity as activity
      ), credited_target_activity as (
        select distinct activity.actor_key, activity.activity_date
        from ranked_candidate_activity as activity
        where activity.credited_candidate_number
            <= selected_policy.max_regions_per_actor_day
          and activity.candidate_region_x = target_record.region_x
          and activity.candidate_region_y = target_record.region_y
      )
      select
        count(distinct actor_key)::integer,
        count(distinct activity_date)::integer
      into target_accounts, target_active_days
      from credited_target_activity;
    end if;

    daily_support :=
      target_side_adjacent
      and target_live_plants >= selected_policy.supported_live_plants
      and target_subcells >= selected_policy.supported_subcells
      and target_accounts >= selected_policy.supported_accounts
      and target_active_days >= selected_policy.supported_active_days;

    select evaluation.consecutive_support_days
    into previous_consecutive
    from public.community_garden_frontier_region_evaluations as evaluation
    where evaluation.evaluation_date = evaluation_day - 1
      and evaluation.region_x = target_record.region_x
      and evaluation.region_y = target_record.region_y;
    previous_consecutive := coalesce(previous_consecutive, 0);
    next_consecutive := case
      when daily_support then least(previous_consecutive + 1, 366)
      else 0
    end;
    locally_qualified_value := daily_support
      and next_consecutive >= selected_policy.supported_consecutive_days;

    reasons_value := '[]'::jsonb;
    if target_live_plants < selected_policy.supported_live_plants then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs ' || selected_policy.supported_live_plants::text
          || ' supported account flowers.'
      );
    end if;
    if target_subcells < selected_policy.supported_subcells then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs healthy planting across '
          || selected_policy.supported_subcells::text || ' garden sections.'
      );
    end if;
    if target_accounts < selected_policy.supported_accounts then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs ' || selected_policy.supported_accounts::text
          || ' distinct account gardeners.'
      );
    end if;
    if target_active_days < selected_policy.supported_active_days then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs activity on ' || selected_policy.supported_active_days::text
          || ' of the last 7 days.'
      );
    end if;
    if not target_side_adjacent then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs side adjacency to founding or established land.'
      );
    end if;
    if daily_support
      and next_consecutive < selected_policy.supported_consecutive_days
    then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs ' || selected_policy.supported_consecutive_days::text
          || ' consecutive supported evaluations.'
      );
    end if;
    if not globally_qualified_value then
      reasons_value := reasons_value || jsonb_build_array(
        'The whole garden has not reached its shared growth quorum.'
      );
    end if;

    insert into public.community_garden_frontier_region_evaluations (
      evaluation_date, region_x, region_y, region_exists, land_state,
      eligible_live_plants, covered_subcells, eligible_accounts_7d,
      active_days_7d, consecutive_support_days,
      locally_qualified, globally_qualified,
      recommended_action, reasons, evaluated_at
    ) values (
      evaluation_day,
      target_record.region_x,
      target_record.region_y,
      target_record.region_exists,
      target_record.land_state,
      target_live_plants,
      target_subcells,
      target_accounts,
      target_active_days,
      next_consecutive,
      locally_qualified_value,
      globally_qualified_value,
      'none',
      reasons_value,
      statement_timestamp()
    )
    on conflict (evaluation_date, region_x, region_y) do update set
      region_exists = excluded.region_exists,
      land_state = excluded.land_state,
      eligible_live_plants = excluded.eligible_live_plants,
      covered_subcells = excluded.covered_subcells,
      eligible_accounts_7d = excluded.eligible_accounts_7d,
      active_days_7d = excluded.active_days_7d,
      consecutive_support_days = excluded.consecutive_support_days,
      locally_qualified = excluded.locally_qualified,
      globally_qualified = excluded.globally_qualified,
      recommended_action = 'none',
      reasons = excluded.reasons,
      evaluated_at = excluded.evaluated_at;
  end loop;

  -- Add only enough capacity to return the world toward 55% occupancy. Even
  -- when many edge sections qualify simultaneously, volume cannot explode the map.
  if globally_qualified_value and live_plants > 0 then
    recommended_expansion_count := greatest(
      ceil(
        live_plants::numeric
        / (
          selected_policy.effective_region_capacity
          * (selected_policy.target_percent / 100)
        )
      )::integer - accessible_regions,
      0
    );
    recommended_expansion_count := least(
      recommended_expansion_count,
      perimeter_regions
    );
  end if;

  with ranked_candidates as (
    select
      evaluation.region_x,
      evaluation.region_y,
      evaluation.region_exists,
      row_number() over (
        order by
          evaluation.eligible_accounts_7d desc,
          evaluation.eligible_live_plants desc,
          evaluation.covered_subcells desc,
          evaluation.region_x,
          evaluation.region_y
      ) as candidate_rank
    from public.community_garden_frontier_region_evaluations as evaluation
    where evaluation.evaluation_date = evaluation_day
      and evaluation.land_state = 'frontier'
      and evaluation.locally_qualified
      and evaluation.globally_qualified
  )
  update public.community_garden_frontier_region_evaluations as evaluation
  set recommended_action = case
    when ranked.candidate_rank <= recommended_expansion_count
      then case when ranked.region_exists then 'establish' else 'prepare' end
    else 'none'
  end
  from ranked_candidates as ranked
  where evaluation.evaluation_date = evaluation_day
    and evaluation.region_x = ranked.region_x
    and evaluation.region_y = ranked.region_y;

  update public.community_garden_frontier_region_evaluations
  set recommended_action = 'restore'
  where evaluation_date = evaluation_day
    and land_state = 'fallow'
    and locally_qualified
    and globally_qualified;

  select count(*)::integer
  into qualifying_frontier_count
  from public.community_garden_frontier_region_evaluations
  where evaluation_date = evaluation_day
    and recommended_action <> 'none';

  -- Persist support counters only on real regions. Missing candidates remain
  -- evaluation rows until an owner deliberately opens them.
  update public.community_garden_regions as region
  set
    consecutive_support_days = evaluation.consecutive_support_days,
    last_support_date = case
      when evaluation.eligible_live_plants >= selected_policy.supported_live_plants
        and evaluation.covered_subcells >= selected_policy.supported_subcells
        and evaluation.eligible_accounts_7d >= selected_policy.supported_accounts
        and evaluation.active_days_7d >= selected_policy.supported_active_days
      then evaluation_day
      else region.last_support_date
    end,
    latest_evaluation_date = evaluation_day,
    latest_support = jsonb_build_object(
      'eligibleLivePlants', evaluation.eligible_live_plants,
      'coveredSubcells', evaluation.covered_subcells,
      'eligibleAccounts7d', evaluation.eligible_accounts_7d,
      'activeDays7d', evaluation.active_days_7d,
      'consecutiveSupportDays', evaluation.consecutive_support_days,
      'locallyQualified', evaluation.locally_qualified,
      'globallyQualified', evaluation.globally_qualified,
      'recommendedAction', evaluation.recommended_action,
      'reasons', evaluation.reasons
    ),
    updated_at = statement_timestamp()
  from public.community_garden_frontier_region_evaluations as evaluation
  where evaluation.evaluation_date = evaluation_day
    and evaluation.region_exists
    and region.region_x = evaluation.region_x
    and region.region_y = evaluation.region_y
    and (
      region.latest_evaluation_date is null
      or evaluation_day >= region.latest_evaluation_date
    );

  insert into public.community_garden_frontier_world_evaluations (
    evaluation_date, evaluated_at, policy_version,
    total_region_count, accessible_region_count,
    plant_count, effective_capacity, occupancy_percent,
    perimeter_region_count, required_accounts, active_accounts_7d,
    globally_qualified, qualifying_frontier_regions,
    recommended_expansion_count, automation_enabled
  ) values (
    evaluation_day,
    statement_timestamp(),
    selected_policy.policy_version,
    total_regions,
    accessible_regions,
    live_plants,
    effective_capacity,
    occupancy_percent_value,
    perimeter_regions,
    required_accounts_value,
    active_accounts_value,
    globally_qualified_value,
    qualifying_frontier_count,
    recommended_expansion_count,
    selected_policy.automation_enabled
  )
  on conflict (evaluation_date) do update set
    evaluated_at = excluded.evaluated_at,
    policy_version = excluded.policy_version,
    total_region_count = excluded.total_region_count,
    accessible_region_count = excluded.accessible_region_count,
    plant_count = excluded.plant_count,
    effective_capacity = excluded.effective_capacity,
    occupancy_percent = excluded.occupancy_percent,
    perimeter_region_count = excluded.perimeter_region_count,
    required_accounts = excluded.required_accounts,
    active_accounts_7d = excluded.active_accounts_7d,
    globally_qualified = excluded.globally_qualified,
    qualifying_frontier_regions = excluded.qualifying_frontier_regions,
    recommended_expansion_count = excluded.recommended_expansion_count,
    automation_enabled = excluded.automation_enabled;

  delete from public.community_garden_region_action_evidence
  where recorded_at < evaluation_as_of - interval '35 days';
  delete from public.community_garden_region_actor_days
  where activity_date < evaluation_day - 35;
  delete from public.community_garden_frontier_region_evaluations
  where evaluation_date < evaluation_day - 400;
  delete from public.community_garden_frontier_world_evaluations
  where evaluation_date < evaluation_day - 400;

  return jsonb_build_object(
    'mode', 'shadow',
    'policyVersion', selected_policy.policy_version,
    'evaluationDate', evaluation_day,
    'occupancyPercent', occupancy_percent_value,
    'perimeterRegions', perimeter_regions,
    'requiredAccounts', required_accounts_value,
    'activeAccounts7d', active_accounts_value,
    'globallyQualified', globally_qualified_value,
    'qualifyingFrontierRegions', qualifying_frontier_count,
    'recommendedExpansionCount', recommended_expansion_count
  );
end;
$$;

-- Every new security-definer helper is private. Browser clients continue to
-- use the validated Basil API routes, which invoke these RPCs with the service
-- role after performing their own account/owner checks.
revoke execute on function public.enforce_community_garden_plant_insert_v1()
  from public, anon, authenticated;
grant execute on function public.enforce_community_garden_plant_insert_v1()
  to service_role;

revoke execute on function public.enforce_community_garden_weed_insert_v1()
  from public, anon, authenticated;
grant execute on function public.enforce_community_garden_weed_insert_v1()
  to service_role;

revoke execute on function public.enforce_community_garden_heritage_capacity_v1()
  from public, anon, authenticated;
grant execute on function public.enforce_community_garden_heritage_capacity_v1()
  to service_role;

revoke execute on function public.record_community_garden_heritage_event_v1()
  from public, anon, authenticated;
grant execute on function public.record_community_garden_heritage_event_v1()
  to service_role;

revoke execute on function public.register_community_garden_account_actor_v1(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.register_community_garden_account_actor_v1(
  uuid, text
) to service_role;

revoke execute on function public.reconcile_community_garden_actor_v2(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.reconcile_community_garden_actor_v2(
  uuid, text, text
) to service_role;

revoke execute on function public.get_community_garden_heritage_notifications_v1(
  uuid
) from public, anon, authenticated;
grant execute on function public.get_community_garden_heritage_notifications_v1(
  uuid
) to service_role;

revoke execute on function public.acknowledge_community_garden_heritage_notifications_v1(
  uuid, uuid[]
) from public, anon, authenticated;
grant execute on function public.acknowledge_community_garden_heritage_notifications_v1(
  uuid, uuid[]
) to service_role;

revoke execute on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) to service_role;

revoke execute on function public.evaluate_community_garden_frontier_v1(date)
  from public, anon, authenticated;
grant execute on function public.evaluate_community_garden_frontier_v1(date)
  to service_role;

revoke execute on function public.set_community_garden_region_state_v1(
  smallint, smallint, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.set_community_garden_region_state_v1(
  smallint, smallint, text, uuid, text
) to service_role;

revoke execute on function public.get_community_garden_frontier_health_v1()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_frontier_health_v1()
  to service_role;

comment on function public.evaluate_community_garden_frontier_v1(date) is
  'Shadow-only quorum frontier evaluator. It records recommendations but never changes region state or flowers.';
comment on function public.set_community_garden_region_state_v1(
  smallint, smallint, text, uuid, text
) is 'Audited service-role-only manual region transition. It never modifies community flowers.';
comment on function public.get_community_garden_frontier_health_v1() is
  'Aggregate quorum/frontier health for Basil private administration; exposes no player identities.';
comment on table public.community_garden_heritage_events is
  'Capacity-managed Heritage promotions created after quorum-frontier launch. Existing Heritage flowers are grandfathered and do not consume these slots.';
comment on table public.community_garden_account_actors is
  'Private bridge from Supabase users to anonymous community actor hashes. Never expose this mapping to clients.';

commit;
