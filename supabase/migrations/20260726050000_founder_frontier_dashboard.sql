begin;

-- Read-only, aggregate data for Basil's private founder dashboard. Browser
-- roles cannot execute this function; the authenticated Next.js route verifies
-- the allowlisted founder account before calling it with the service role.

create index if not exists community_garden_region_state_audit_created_idx
  on public.community_garden_region_state_audit (created_at desc, id desc);

create or replace function public.get_community_garden_frontier_dashboard_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  health_summary jsonb;
  dashboard_evaluation_date date;
  policy_details jsonb := '{}'::jsonb;
  map_bounds jsonb := '{}'::jsonb;
  map_cells jsonb := '[]'::jsonb;
  daily_trends jsonb := '[]'::jsonb;
  recent_state_changes jsonb := '[]'::jsonb;
begin
  health_summary := public.get_community_garden_frontier_health_v1();
  dashboard_evaluation_date := nullif(
    health_summary ->> 'evaluationDate',
    ''
  )::date;

  select jsonb_build_object(
    'effectiveRegionCapacity', policy.effective_region_capacity,
    'preparePercent', policy.prepare_percent,
    'expandPercent', policy.expand_percent,
    'targetPercent', policy.target_percent,
    'supportedLivePlants', policy.supported_live_plants,
    'supportedSubcells', policy.supported_subcells,
    'supportedAccounts', policy.supported_accounts,
    'supportedActiveDays', policy.supported_active_days,
    'supportedConsecutiveDays', policy.supported_consecutive_days,
    'maxRegionsPerActorDay', policy.max_regions_per_actor_day,
    'heritageCapacityPerRegion', policy.heritage_capacity_per_region
  )
  into policy_details
  from public.community_garden_frontier_policy as policy
  where policy.singleton;

  if dashboard_evaluation_date is not null then
    select jsonb_build_object(
      'minX', min(evaluation.region_x),
      'maxX', max(evaluation.region_x),
      'minY', min(evaluation.region_y),
      'maxY', max(evaluation.region_y)
    )
    into map_bounds
    from public.community_garden_frontier_region_evaluations as evaluation
    where evaluation.evaluation_date = dashboard_evaluation_date;

    with heritage_by_region as (
      select
        plant.region_x,
        plant.region_y,
        count(*)::integer as heritage_flowers
      from public.community_garden_roses as plant
      where plant.heritage_at is not null
      group by plant.region_x, plant.region_y
    ), cell_rows as (
      select
        evaluation.region_x,
        evaluation.region_y,
        jsonb_build_object(
          'regionX', evaluation.region_x,
          'regionY', evaluation.region_y,
          'regionExists', evaluation.region_exists,
          'landState', evaluation.land_state,
          'isFounding', coalesce(region.is_founding, false),
          'ringIndex', region.ring_index,
          'plantCount', coalesce(region.plant_count, 0),
          'effectiveCapacity',
            (policy_details ->> 'effectiveRegionCapacity')::integer,
          'occupancyPercent', case
            when (policy_details ->> 'effectiveRegionCapacity')::numeric <= 0
              then 0
            else round(
              100 * coalesce(region.plant_count, 0)::numeric
                / (policy_details ->> 'effectiveRegionCapacity')::numeric,
              1
            )
          end,
          'pressureState', region.pressure_state,
          'eligibleLivePlants', evaluation.eligible_live_plants,
          'coveredSubcells', evaluation.covered_subcells,
          'eligibleAccounts7d', evaluation.eligible_accounts_7d,
          'activeDays7d', evaluation.active_days_7d,
          'consecutiveSupportDays', evaluation.consecutive_support_days,
          'locallyQualified', evaluation.locally_qualified,
          'globallyQualified', evaluation.globally_qualified,
          'recommendedAction', evaluation.recommended_action,
          'reasons', evaluation.reasons,
          'heritageFlowers', coalesce(heritage.heritage_flowers, 0),
          'heritageCapacity', coalesce(region.heritage_capacity, 0),
          'evaluatedAt', evaluation.evaluated_at
        ) as cell
      from public.community_garden_frontier_region_evaluations as evaluation
      left join public.community_garden_regions as region
        on region.region_x = evaluation.region_x
       and region.region_y = evaluation.region_y
      left join heritage_by_region as heritage
        on heritage.region_x = evaluation.region_x
       and heritage.region_y = evaluation.region_y
      where evaluation.evaluation_date = dashboard_evaluation_date
    )
    select coalesce(
      jsonb_agg(cell_rows.cell order by cell_rows.region_y desc, cell_rows.region_x),
      '[]'::jsonb
    )
    into map_cells
    from cell_rows;
  end if;

  with recent as (
    select
      evaluation.evaluation_date,
      jsonb_build_object(
        'date', evaluation.evaluation_date,
        'evaluatedAt', evaluation.evaluated_at,
        'plants', evaluation.plant_count,
        'effectiveCapacity', evaluation.effective_capacity,
        'occupancyPercent', evaluation.occupancy_percent,
        'accessibleRegions', evaluation.accessible_region_count,
        'perimeterRegions', evaluation.perimeter_region_count,
        'activeAccounts7d', evaluation.active_accounts_7d,
        'requiredAccounts', evaluation.required_accounts,
        'globallyQualified', evaluation.globally_qualified,
        'qualifyingFrontierRegions', evaluation.qualifying_frontier_regions,
        'recommendedExpansionCount', evaluation.recommended_expansion_count
      ) as trend
    from public.community_garden_frontier_world_evaluations as evaluation
    order by evaluation.evaluation_date desc
    limit 30
  )
  select coalesce(
    jsonb_agg(recent.trend order by recent.evaluation_date),
    '[]'::jsonb
  )
  into daily_trends
  from recent;

  with recent as (
    select audit.*
    from public.community_garden_region_state_audit as audit
    order by audit.created_at desc, audit.id desc
    limit 20
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', recent.id,
        'regionX', recent.region_x,
        'regionY', recent.region_y,
        'previousState', recent.previous_state,
        'nextState', recent.next_state,
        'reason', recent.reason,
        'createdAt', recent.created_at
      )
      order by recent.created_at desc, recent.id desc
    ),
    '[]'::jsonb
  )
  into recent_state_changes
  from recent;

  return health_summary || jsonb_build_object(
    'policy', coalesce(policy_details, '{}'::jsonb),
    'map', jsonb_build_object(
      'bounds', coalesce(map_bounds, '{}'::jsonb),
      'cells', map_cells
    ),
    'trends', daily_trends,
    'recentStateChanges', recent_state_changes
  );
end;
$$;

revoke execute on function public.get_community_garden_frontier_dashboard_v1()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_frontier_dashboard_v1()
  to service_role;

comment on function public.get_community_garden_frontier_dashboard_v1() is
  'Private aggregate founder dashboard for Basil frontier geography and trends; exposes no player identities.';

commit;
