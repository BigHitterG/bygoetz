begin;

-- Run the three private Founding Stewards at the same high-intensity daily
-- pace measured from the founder's July 26 play session. Work is divided into
-- resumable half-hour bursts by the application worker; these database values
-- are explicit, founder-visible targets rather than population-scaled limits.

alter table public.community_garden_founding_stewards
  add column if not exists daily_weed_actions smallint not null default 12;

alter table public.community_garden_founding_stewards
  drop constraint if exists community_garden_founding_stewards_action_check;
alter table public.community_garden_founding_stewards
  add constraint community_garden_founding_stewards_action_check check (
    daily_plant_actions between 0 and 999
    and daily_water_actions between 0 and 999
    and daily_weed_actions between 0 and 999
  );

update public.community_garden_founding_stewards
set
  daily_plant_actions = 105,
  daily_water_actions = 360,
  daily_weed_actions = 12,
  updated_at = now()
where steward_id between 1 and 3;

alter table public.community_garden_founding_steward_runs
  add column if not exists target_actions integer not null default 0,
  add column if not exists target_plant_actions integer not null default 0,
  add column if not exists target_water_actions integer not null default 0,
  add column if not exists target_weed_actions integer not null default 0,
  add column if not exists weeds_removed integer not null default 0;

alter table public.community_garden_founding_steward_runs
  drop constraint if exists community_garden_founding_steward_runs_counts_check;
alter table public.community_garden_founding_steward_runs
  add constraint community_garden_founding_steward_runs_counts_check check (
    paid_member_count >= 0
    and target_actions >= 0
    and target_plant_actions >= 0
    and target_water_actions >= 0
    and target_weed_actions >= 0
    and actions_attempted >= 0
    and actions_succeeded >= 0
    and actions_failed >= 0
    and plants_placed >= 0
    and flowers_watered >= 0
    and weeds_removed >= 0
    and heritage_promotions_completed >= 0
  );

alter table public.community_garden_founding_steward_actions
  add column if not exists session_slot smallint not null default 0,
  add column if not exists affected_count smallint not null default 0;

alter table public.community_garden_founding_steward_actions
  drop constraint if exists community_garden_founding_steward_actions_ordinal_check,
  drop constraint if exists community_garden_founding_steward_actions_type_check,
  drop constraint if exists community_garden_founding_steward_actions_owner_check;
alter table public.community_garden_founding_steward_actions
  add constraint community_garden_founding_steward_actions_ordinal_check
    check (action_ordinal between 1 and 3999),
  add constraint community_garden_founding_steward_actions_type_check
    check (action_type in ('plant', 'water', 'weed')),
  add constraint community_garden_founding_steward_actions_owner_check
    check (target_owner_kind in ('paid_member', 'founding_steward', 'garden')),
  add constraint community_garden_founding_steward_actions_session_check
    check (session_slot between 0 and 47),
  add constraint community_garden_founding_steward_actions_affected_check
    check (affected_count between 0 and 16);

create index if not exists community_garden_founding_steward_actions_run_type_idx
  on public.community_garden_founding_steward_actions
    (run_id, steward_id, action_type, status, action_ordinal);

create or replace function public.get_community_garden_founding_steward_plan_v2(
  p_run_date date,
  p_session_slot smallint
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
  weed_payload jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select count(distinct mapping.actor_key)::integer
  into paid_member_count
  from public.community_garden_account_actors as mapping
  join public.garden_stewards as member on member.user_id = mapping.user_id
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
    'dailyWaterActions', daily_water_actions,
    'dailyWeedActions', daily_weed_actions
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
      plant.id,
      plant.grid_x,
      plant.grid_y,
      plant.region_x,
      plant.region_y,
      plant.plant_type,
      case when paid.actor_key is not null
        then 'paid_member' else 'founding_steward' end as owner_kind,
      coalesce(blocked.steward_ids, array[]::smallint[]) as blocked_steward_ids
    from public.community_garden_roses as plant
    left join paid_actors as paid on paid.actor_key = plant.contributor_key
    left join public.community_garden_founding_stewards as founder
      on founder.actor_key = plant.contributor_key and founder.enabled
    join public.community_garden_regions as region
      on region.region_x = plant.region_x and region.region_y = plant.region_y
    left join public.community_garden_watering_claims as claim
      on claim.plant_id = plant.id
     and claim.released_at is null
     and claim.claimed_at > now() - interval '4 hours'
    left join lateral (
      select array_agg(steward.steward_id order by steward.steward_id) as steward_ids
      from public.community_garden_watering_history as history
      join public.community_garden_founding_stewards as steward
        on steward.actor_key = history.actor_key and steward.enabled
      where history.plant_id = plant.id
        and history.last_rewarded_at > now() - interval '4 hours'
    ) as blocked on true
    where plant.heritage_at is null
      and plant.contributor_kind = 'account'
      and (paid.actor_key is not null or founder.actor_key is not null)
      and region.land_state in ('founding', 'established')
      and (plant.succession_at is null or plant.succession_at > now())
      and (plant.absolute_expires_at is null or plant.absolute_expires_at > now())
      and plant.last_watered_at > now() - case plant.plant_type
        when 'sunflower' then interval '58 hours'
        when 'lavender' then interval '156 hours'
        else interval '96 hours'
      end
      and claim.plant_id is null
    order by md5(
      plant.id::text || ':' || p_run_date::text || ':' || p_session_slot::text
    )
    limit 1500
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'plantId', id,
    'gridX', grid_x,
    'gridY', grid_y,
    'regionX', region_x,
    'regionY', region_y,
    'plantType', plant_type,
    'ownerKind', owner_kind,
    'blockedStewardIds', to_jsonb(blocked_steward_ids)
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
    select
      plant.id,
      plant.grid_x,
      plant.grid_y,
      plant.region_x,
      plant.region_y
    from public.community_garden_roses as plant
    left join paid_actors as paid on paid.actor_key = plant.contributor_key
    left join public.community_garden_founding_stewards as founder
      on founder.actor_key = plant.contributor_key and founder.enabled
    join public.community_garden_regions as region
      on region.region_x = plant.region_x and region.region_y = plant.region_y
    where plant.contributor_kind = 'account'
      and (paid.actor_key is not null or founder.actor_key is not null)
      and region.land_state in ('founding', 'established')
      and (plant.succession_at is null or plant.succession_at > now())
      and (plant.absolute_expires_at is null or plant.absolute_expires_at > now())
    order by md5(
      plant.id::text || ':anchor:' || p_run_date::text || ':' || p_session_slot::text
    )
    limit 1500
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'weedId', weed.id,
    'gridX', weed.grid_x,
    'gridY', weed.grid_y,
    'regionX', weed.region_x,
    'regionY', weed.region_y
  ) order by md5(
    weed.id::text || ':weed:' || p_run_date::text || ':' || p_session_slot::text
  )), '[]'::jsonb)
  into weed_payload
  from public.community_garden_weeds as weed
  join public.community_garden_regions as region
    on region.region_x = weed.region_x and region.region_y = weed.region_y
  where weed.expires_at > now()
    and region.land_state in ('founding', 'established');

  return jsonb_build_object(
    'runDate', p_run_date,
    'sessionSlot', p_session_slot,
    'paidMemberCount', paid_member_count,
    'stewards', steward_payload,
    'waterCandidates', water_payload,
    'plantAnchors', anchor_payload,
    'weedCandidates', weed_payload
  );
end;
$$;

create or replace function public.get_community_garden_founding_steward_dashboard_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  local_today date := (now() at time zone 'America/Chicago')::date;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'configured', (select count(*) from public.community_garden_founding_stewards),
    'active', (select count(*) from public.community_garden_founding_stewards where enabled),
    'paidOnly', true,
    'visibleAsPlayers', false,
    'localDate', local_today,
    'latestRun', coalesce((
      select jsonb_build_object(
        'runDate', run_date,
        'status', status,
        'paidMemberCount', paid_member_count,
        'targetActions', target_actions,
        'targetPlantActions', target_plant_actions,
        'targetWaterActions', target_water_actions,
        'targetWeedActions', target_weed_actions,
        'actionsAttempted', actions_attempted,
        'actionsSucceeded', actions_succeeded,
        'actionsFailed', actions_failed,
        'plantsPlaced', plants_placed,
        'flowersWatered', flowers_watered,
        'weedsRemoved', weeds_removed,
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
        'plantsPlaced', count(*) filter (
          where status = 'success' and action_type = 'plant'
        ),
        'wateringActions', count(*) filter (
          where status = 'success' and action_type = 'water'
        ),
        'weedsRemoved', count(*) filter (
          where status = 'success' and action_type = 'weed'
        ),
        'flowersAffected', coalesce(sum(affected_count) filter (
          where status = 'success' and action_type = 'water'
        ), 0),
        'regionsTouched', count(distinct (region_x, region_y)) filter (
          where status = 'success'
        )
      )
      from public.community_garden_founding_steward_actions
      where created_at >= now() - interval '7 days'
    ),
    'allTime', (
      select jsonb_build_object(
        'actions', count(*),
        'successful', count(*) filter (where status = 'success'),
        'failed', count(*) filter (where status = 'failed'),
        'plantsPlaced', count(*) filter (
          where status = 'success' and action_type = 'plant'
        ),
        'wateringActions', count(*) filter (
          where status = 'success' and action_type = 'water'
        ),
        'weedsRemoved', count(*) filter (
          where status = 'success' and action_type = 'weed'
        ),
        'flowersAffected', coalesce(sum(affected_count) filter (
          where status = 'success' and action_type = 'water'
        ), 0),
        'regionsTouched', count(distinct (region_x, region_y)) filter (
          where status = 'success'
        )
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
        'dailyWeedActions', steward.daily_weed_actions,
        'dailyTarget', steward.daily_plant_actions
          + steward.daily_water_actions + steward.daily_weed_actions,
        'actionsToday', coalesce(today.actions, 0),
        'plantsToday', coalesce(today.plants, 0),
        'wateringsToday', coalesce(today.waterings, 0),
        'weedsToday', coalesce(today.weeds, 0),
        'flowersAffectedToday', coalesce(today.flowers_affected, 0),
        'regionsToday', coalesce(today.regions, 0),
        'lastActionAt', stats.last_action_at,
        'actions7d', coalesce(stats.actions_7d, 0),
        'plants7d', coalesce(stats.plants_7d, 0),
        'waterings7d', coalesce(stats.waterings_7d, 0),
        'weeds7d', coalesce(stats.weeds_7d, 0),
        'failures7d', coalesce(stats.failures_7d, 0)
      ) order by steward.steward_id)
      from public.community_garden_founding_stewards as steward
      left join lateral (
        select
          count(*) filter (where action.status = 'success') as actions,
          count(*) filter (
            where action.status = 'success' and action.action_type = 'plant'
          ) as plants,
          count(*) filter (
            where action.status = 'success' and action.action_type = 'water'
          ) as waterings,
          count(*) filter (
            where action.status = 'success' and action.action_type = 'weed'
          ) as weeds,
          coalesce(sum(action.affected_count) filter (
            where action.status = 'success' and action.action_type = 'water'
          ), 0) as flowers_affected,
          count(distinct (action.region_x, action.region_y)) filter (
            where action.status = 'success'
          ) as regions
        from public.community_garden_founding_steward_actions as action
        join public.community_garden_founding_steward_runs as run
          on run.run_id = action.run_id
        where action.steward_id = steward.steward_id
          and run.run_date = local_today
      ) as today on true
      left join lateral (
        select
          max(action.created_at) as last_action_at,
          count(*) filter (
            where action.created_at >= now() - interval '7 days'
          ) as actions_7d,
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
              and action.status = 'success' and action.action_type = 'weed'
          ) as weeds_7d,
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

revoke all on function public.get_community_garden_founding_steward_plan_v2(date, smallint)
  from public, anon, authenticated;
grant execute on function public.get_community_garden_founding_steward_plan_v2(date, smallint)
  to service_role;
revoke all on function public.get_community_garden_founding_steward_dashboard_v2()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_founding_steward_dashboard_v2()
  to service_role;

comment on function public.get_community_garden_founding_steward_plan_v2(date, smallint) is
  'Returns a private, session-local action plan for three full-pace Founding Stewards without exposing their keys to players.';
comment on function public.get_community_garden_founding_steward_dashboard_v2() is
  'Returns private aggregate progress toward each Founding Steward daily target without exposing actor or network keys.';

commit;
