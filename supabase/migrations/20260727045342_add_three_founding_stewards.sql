begin;

-- Three low-volume, server-only Founding Stewards help paid-member areas
-- develop while Basil's real community is small. They use the normal garden
-- action RPC, so footprints, rate rails, Heritage rules, and region pressure
-- still apply. No browser receives their keys or a player-presence record.

create table if not exists public.community_garden_founding_stewards (
  steward_id smallint primary key,
  code text not null unique,
  display_name text not null,
  actor_key text not null unique,
  network_key text not null unique,
  enabled boolean not null default true,
  paid_only boolean not null default true,
  daily_plant_actions smallint not null default 2,
  daily_water_actions smallint not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_garden_founding_stewards_id_check
    check (steward_id between 1 and 3),
  constraint community_garden_founding_stewards_code_check
    check (code ~ '^[a-z][a-z0-9_-]{2,31}$'),
  constraint community_garden_founding_stewards_name_check
    check (char_length(display_name) between 2 and 40),
  constraint community_garden_founding_stewards_actor_check
    check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_founding_stewards_network_check
    check (network_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_founding_stewards_action_check check (
    daily_plant_actions between 0 and 12
    and daily_water_actions between 0 and 24
  )
);

insert into public.community_garden_founding_stewards (
  steward_id, code, display_name, actor_key, network_key
)
values
  (
    1, 'rowan', 'Rowan',
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  (
    2, 'clover', 'Clover',
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  (
    3, 'wren', 'Wren',
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  )
on conflict (steward_id) do update set
  code = excluded.code,
  display_name = excluded.display_name,
  enabled = true,
  paid_only = true,
  daily_plant_actions = 2,
  daily_water_actions = 4,
  updated_at = now();

create table if not exists public.community_garden_founding_steward_runs (
  run_id uuid primary key default gen_random_uuid(),
  run_date date not null unique,
  status text not null default 'running',
  paid_member_count integer not null default 0,
  actions_attempted integer not null default 0,
  actions_succeeded integer not null default 0,
  actions_failed integer not null default 0,
  plants_placed integer not null default 0,
  flowers_watered integer not null default 0,
  heritage_promotions_completed integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  constraint community_garden_founding_steward_runs_status_check
    check (status in ('running', 'completed', 'partial', 'skipped', 'failed')),
  constraint community_garden_founding_steward_runs_counts_check check (
    paid_member_count >= 0
    and actions_attempted >= 0
    and actions_succeeded >= 0
    and actions_failed >= 0
    and plants_placed >= 0
    and flowers_watered >= 0
    and heritage_promotions_completed >= 0
  ),
  constraint community_garden_founding_steward_runs_error_check
    check (error_summary is null or char_length(error_summary) <= 500)
);

create table if not exists public.community_garden_founding_steward_actions (
  action_id uuid primary key,
  run_id uuid not null references public.community_garden_founding_steward_runs(run_id) on delete cascade,
  steward_id smallint not null references public.community_garden_founding_stewards(steward_id),
  action_ordinal smallint not null,
  action_type text not null,
  status text not null default 'pending',
  target_owner_kind text not null,
  target_plant_id uuid references public.community_garden_roses(id) on delete set null,
  grid_x integer not null,
  grid_y integer not null,
  region_x smallint not null,
  region_y smallint not null,
  care_awarded integer not null default 0,
  heritage_plant_ids uuid[] not null default '{}'::uuid[],
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id, steward_id, action_ordinal),
  constraint community_garden_founding_steward_actions_ordinal_check
    check (action_ordinal between 1 and 48),
  constraint community_garden_founding_steward_actions_type_check
    check (action_type in ('plant', 'water')),
  constraint community_garden_founding_steward_actions_status_check
    check (status in ('pending', 'success', 'failed')),
  constraint community_garden_founding_steward_actions_owner_check
    check (target_owner_kind in ('paid_member', 'founding_steward')),
  constraint community_garden_founding_steward_actions_care_check
    check (care_awarded >= 0),
  constraint community_garden_founding_steward_actions_error_check
    check (error_code is null or error_code ~ '^[a-z0-9_-]{1,80}$')
);

create index if not exists community_garden_founding_steward_runs_status_idx
  on public.community_garden_founding_steward_runs (status, run_date desc);
create index if not exists community_garden_founding_steward_actions_steward_idx
  on public.community_garden_founding_steward_actions (steward_id, created_at desc);
create index if not exists community_garden_founding_steward_actions_region_idx
  on public.community_garden_founding_steward_actions (region_x, region_y, created_at desc);

alter table public.community_garden_founding_stewards enable row level security;
alter table public.community_garden_founding_steward_runs enable row level security;
alter table public.community_garden_founding_steward_actions enable row level security;

revoke all on table public.community_garden_founding_stewards from public, anon, authenticated;
revoke all on table public.community_garden_founding_steward_runs from public, anon, authenticated;
revoke all on table public.community_garden_founding_steward_actions from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_founding_stewards to service_role;
grant select, insert, update, delete on table public.community_garden_founding_steward_runs to service_role;
grant select, insert, update, delete on table public.community_garden_founding_steward_actions to service_role;

create or replace function public.get_community_garden_founding_steward_plan_v1(
  p_run_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid_member_count integer;
  steward_payload jsonb;
  water_payload jsonb;
  anchor_payload jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select count(distinct mapping.actor_key)::integer
    into paid_member_count
  from public.community_garden_account_actors as mapping
  join public.garden_stewards as member
    on member.user_id = mapping.user_id
  join public.garden_entitlements as entitlement
    on entitlement.steward_id = member.id
   and entitlement.product_key = 'basil_founding_gardener'
   and entitlement.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'stewardId', steward_id,
    'code', code,
    'displayName', display_name,
    'actorKey', actor_key,
    'networkKey', network_key,
    'dailyPlantActions', daily_plant_actions,
    'dailyWaterActions', daily_water_actions
  ) order by steward_id), '[]'::jsonb)
  into steward_payload
  from public.community_garden_founding_stewards
  where enabled and paid_only;

  with paid_actors as (
    select distinct mapping.actor_key
    from public.community_garden_account_actors as mapping
    join public.garden_stewards as member on member.user_id = mapping.user_id
    join public.garden_entitlements as entitlement
      on entitlement.steward_id = member.id
     and entitlement.product_key = 'basil_founding_gardener'
     and entitlement.status = 'active'
  ), eligible_plants as (
    select
      plant.id, plant.grid_x, plant.grid_y, plant.region_x, plant.region_y,
      plant.plant_type, plant.planted_at,
      case when paid.actor_key is not null then 'paid_member' else 'founding_steward' end as owner_kind,
      count(distinct care.care_date)::integer as care_days,
      count(distinct care.actor_key)::integer as care_actors
    from public.community_garden_roses as plant
    left join paid_actors as paid on paid.actor_key = plant.contributor_key
    left join public.community_garden_founding_stewards as founder
      on founder.actor_key = plant.contributor_key and founder.enabled
    left join public.community_garden_heritage_care as care on care.plant_id = plant.id
    join public.community_garden_regions as region
      on region.region_x = plant.region_x and region.region_y = plant.region_y
    where plant.heritage_at is null
      and plant.contributor_kind = 'account'
      and (paid.actor_key is not null or founder.actor_key is not null)
      and region.land_state in ('founding', 'established')
    group by plant.id, paid.actor_key, founder.actor_key
    order by
      (plant.planted_at <= now() - interval '5 days') desc,
      care_days desc,
      care_actors desc,
      plant.planted_at,
      plant.id
    limit 72
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'plantId', id,
    'gridX', grid_x,
    'gridY', grid_y,
    'regionX', region_x,
    'regionY', region_y,
    'plantType', plant_type,
    'ownerKind', owner_kind,
    'careDays', care_days,
    'careActors', care_actors
  )), '[]'::jsonb)
  into water_payload
  from eligible_plants;

  with paid_actors as (
    select distinct mapping.actor_key
    from public.community_garden_account_actors as mapping
    join public.garden_stewards as member on member.user_id = mapping.user_id
    join public.garden_entitlements as entitlement
      on entitlement.steward_id = member.id
     and entitlement.product_key = 'basil_founding_gardener'
     and entitlement.status = 'active'
  ), anchors as (
    select plant.id, plant.grid_x, plant.grid_y, plant.region_x, plant.region_y
    from public.community_garden_roses as plant
    join paid_actors as paid on paid.actor_key = plant.contributor_key
    join public.community_garden_regions as region
      on region.region_x = plant.region_x and region.region_y = plant.region_y
    where region.land_state in ('founding', 'established')
    order by plant.planted_at desc, plant.id
    limit 72
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'plantId', id,
    'gridX', grid_x,
    'gridY', grid_y,
    'regionX', region_x,
    'regionY', region_y
  )), '[]'::jsonb)
  into anchor_payload
  from anchors;

  return jsonb_build_object(
    'runDate', p_run_date,
    'paidMemberCount', paid_member_count,
    'stewards', steward_payload,
    'waterCandidates', water_payload,
    'plantAnchors', anchor_payload
  );
end;
$$;

create or replace function public.get_community_garden_founding_steward_dashboard_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'configured', (select count(*) from public.community_garden_founding_stewards),
    'active', (select count(*) from public.community_garden_founding_stewards where enabled),
    'paidOnly', true,
    'visibleAsPlayers', false,
    'latestRun', coalesce((
      select jsonb_build_object(
        'runDate', run_date,
        'status', status,
        'paidMemberCount', paid_member_count,
        'actionsAttempted', actions_attempted,
        'actionsSucceeded', actions_succeeded,
        'actionsFailed', actions_failed,
        'plantsPlaced', plants_placed,
        'flowersWatered', flowers_watered,
        'heritagePromotionsCompleted', heritage_promotions_completed,
        'startedAt', started_at,
        'completedAt', completed_at
      )
      from public.community_garden_founding_steward_runs
      order by run_date desc
      limit 1
    ), 'null'::jsonb),
    'last7Days', (
      select jsonb_build_object(
        'actions', count(*),
        'successful', count(*) filter (where status = 'success'),
        'failed', count(*) filter (where status = 'failed'),
        'plantsPlaced', count(*) filter (where status = 'success' and action_type = 'plant'),
        'wateringActions', count(*) filter (where status = 'success' and action_type = 'water'),
        'regionsTouched', count(distinct (region_x, region_y)) filter (where status = 'success')
      )
      from public.community_garden_founding_steward_actions
      where created_at >= now() - interval '7 days'
    ),
    'allTime', (
      select jsonb_build_object(
        'actions', count(*),
        'successful', count(*) filter (where status = 'success'),
        'failed', count(*) filter (where status = 'failed'),
        'plantsPlaced', count(*) filter (where status = 'success' and action_type = 'plant'),
        'wateringActions', count(*) filter (where status = 'success' and action_type = 'water'),
        'regionsTouched', count(distinct (region_x, region_y)) filter (where status = 'success')
      )
      from public.community_garden_founding_steward_actions
    ),
    'heritage', jsonb_build_object(
      'careRecords', (
        select count(*)
        from public.community_garden_heritage_care as care
        join public.community_garden_founding_stewards as steward
          on steward.actor_key = care.actor_key
      ),
      'promotionsCompleted', (
        select count(*)
        from public.community_garden_heritage_events as event
        join public.community_garden_founding_stewards as steward
          on steward.actor_key = event.helper_actor_key
      ),
      'stewardPlantsPromoted', (
        select count(*)
        from public.community_garden_heritage_events as event
        join public.community_garden_founding_stewards as steward
          on steward.actor_key = event.planter_actor_key
      )
    ),
    'stewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stewardId', steward.steward_id,
        'displayName', steward.display_name,
        'enabled', steward.enabled,
        'dailyPlantActions', steward.daily_plant_actions,
        'dailyWaterActions', steward.daily_water_actions,
        'lastActionAt', stats.last_action_at,
        'actions7d', coalesce(stats.actions_7d, 0),
        'plants7d', coalesce(stats.plants_7d, 0),
        'waterings7d', coalesce(stats.waterings_7d, 0),
        'failures7d', coalesce(stats.failures_7d, 0)
      ) order by steward.steward_id)
      from public.community_garden_founding_stewards as steward
      left join lateral (
        select
          max(action.created_at) as last_action_at,
          count(*) filter (where action.created_at >= now() - interval '7 days') as actions_7d,
          count(*) filter (
            where action.created_at >= now() - interval '7 days'
              and action.status = 'success' and action.action_type = 'plant'
          ) as plants_7d,
          count(*) filter (
            where action.created_at >= now() - interval '7 days'
              and action.status = 'success' and action.action_type = 'water'
          ) as waterings_7d,
          count(*) filter (
            where action.created_at >= now() - interval '7 days'
              and action.status = 'failed'
          ) as failures_7d
        from public.community_garden_founding_steward_actions as action
        where action.steward_id = steward.steward_id
      ) as stats on true
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_community_garden_founding_steward_plan_v1(date)
  from public, anon, authenticated;
grant execute on function public.get_community_garden_founding_steward_plan_v1(date)
  to service_role;
revoke all on function public.get_community_garden_founding_steward_dashboard_v1()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_founding_steward_dashboard_v1()
  to service_role;

comment on table public.community_garden_founding_stewards is
  'Private server-only identities for three low-volume Founding Stewards. Keys never enter public snapshots or player presence.';
comment on table public.community_garden_founding_steward_runs is
  'One idempotent daily execution record for the private Founding Steward batch.';
comment on table public.community_garden_founding_steward_actions is
  'Founder-visible audit trail for steward actions. It contains no player email or other PII.';

commit;
