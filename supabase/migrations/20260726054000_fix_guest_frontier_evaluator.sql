begin;

-- Correct the evaluator's local recommendation variable name. The original
-- deployment was atomic and its first evaluation rolled back before this fix.

create or replace function public.evaluate_community_garden_frontier_v2(
  p_evaluation_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  selected_policy public.community_garden_frontier_policy%rowtype;
  evaluation_day date := coalesce(
    p_evaluation_date,
    (statement_timestamp() at time zone 'utc')::date
  );
  evaluation_as_of timestamptz;
  current_world public.community_garden_frontier_world_evaluations%rowtype;
  stage_record record;
  target_record record;
  account_live_value integer;
  guest_live_value integer;
  account_subcells_value integer;
  guest_only_subcells_value integer;
  guest_assist_live_value integer;
  guest_assist_subcells_value integer;
  supported_live_value integer;
  supported_subcells_value integer;
  previous_consecutive integer;
  next_consecutive integer;
  daily_support boolean;
  locally_qualified_value boolean;
  reasons_value jsonb;
  globally_qualified_value boolean;
  capacity_recommendation integer := 0;
  recommendation_budget integer := 0;
  recommended_expansion_value integer := 0;
  recent_land_changes integer := 0;
  qualifying_frontier_count integer := 0;
begin
  base_result := public.evaluate_community_garden_frontier_v1(evaluation_day);

  evaluation_as_of := least(
    statement_timestamp(),
    ((evaluation_day + 1)::timestamp at time zone 'utc')
  );

  select *
  into selected_policy
  from public.community_garden_frontier_policy
  where singleton;

  select *
  into current_world
  from public.community_garden_frontier_world_evaluations
  where evaluation_date = evaluation_day;

  select *
  into stage_record
  from public.get_community_garden_frontier_stage_v2(
    current_world.active_accounts_7d,
    current_world.perimeter_region_count
  );

  globally_qualified_value :=
    current_world.occupancy_percent >= selected_policy.expand_percent
    and current_world.active_accounts_7d >= stage_record.global_required_accounts;

  for target_record in
    select evaluation.*
    from public.community_garden_frontier_region_evaluations as evaluation
    where evaluation.evaluation_date = evaluation_day
    order by evaluation.region_x, evaluation.region_y
  loop
    with source_regions as (
      select source.region_x, source.region_y
      from public.community_garden_regions as source
      where (
        target_record.region_exists
        and source.region_x = target_record.region_x
        and source.region_y = target_record.region_y
      ) or (
        not target_record.region_exists
        and source.land_state in ('founding', 'established')
        and abs(source.region_x - target_record.region_x)
          + abs(source.region_y - target_record.region_y) = 1
      )
    ), healthy_plants as (
      select
        source.region_x as source_region_x,
        source.region_y as source_region_y,
        (
          ((plant.grid_x - source.region_x * 16) / 4) * 4
          + ((plant.grid_y - source.region_y * 16) / 4)
        )::integer as subcell,
        plant.contributor_kind
      from source_regions as source
      join public.community_garden_roses as plant
        on plant.region_x = source.region_x
       and plant.region_y = source.region_y
      where plant.contributor_kind in ('account', 'guest')
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
        )
    ), account_cells as (
      select distinct source_region_x, source_region_y, subcell
      from healthy_plants
      where contributor_kind = 'account'
    ), guest_cells as (
      select distinct source_region_x, source_region_y, subcell
      from healthy_plants
      where contributor_kind = 'guest'
    )
    select
      count(*) filter (where contributor_kind = 'account')::integer,
      count(*) filter (where contributor_kind = 'guest')::integer,
      least(16, (select count(*) from account_cells))::integer,
      least(16, (
        select count(*)
        from guest_cells as guest_cell
        where not exists (
          select 1
          from account_cells as account_cell
          where account_cell.source_region_x = guest_cell.source_region_x
            and account_cell.source_region_y = guest_cell.source_region_y
            and account_cell.subcell = guest_cell.subcell
        )
      ))::integer
    into
      account_live_value,
      guest_live_value,
      account_subcells_value,
      guest_only_subcells_value
    from healthy_plants;

    account_live_value := coalesce(account_live_value, 0);
    guest_live_value := coalesce(guest_live_value, 0);
    account_subcells_value := coalesce(account_subcells_value, 0);
    guest_only_subcells_value := coalesce(guest_only_subcells_value, 0);

    guest_assist_live_value := least(
      ceil(
        guest_live_value::numeric
          * selected_policy.guest_assist_weight_percent / 100
      )::integer,
      ceil(
        selected_policy.supported_live_plants::numeric
          * selected_policy.guest_assist_max_percent / 100
      )::integer
    );
    guest_assist_subcells_value := least(
      guest_only_subcells_value,
      ceil(
        selected_policy.supported_subcells::numeric
          * selected_policy.guest_assist_max_percent / 100
      )::integer
    );
    supported_live_value := least(
      account_live_value + guest_assist_live_value,
      256
    );
    supported_subcells_value := least(
      account_subcells_value + guest_assist_subcells_value,
      16
    );

    daily_support :=
      supported_live_value >= selected_policy.supported_live_plants
      and supported_subcells_value >= selected_policy.supported_subcells
      and target_record.eligible_accounts_7d
        >= stage_record.local_required_accounts
      and target_record.active_days_7d
        >= selected_policy.supported_active_days
      and (
        target_record.land_state in ('founding', 'established')
        or exists (
          select 1
          from public.community_garden_regions as neighbor
          where neighbor.land_state in ('founding', 'established')
            and abs(neighbor.region_x - target_record.region_x)
              + abs(neighbor.region_y - target_record.region_y) = 1
        )
      );

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
    if supported_live_value < selected_policy.supported_live_plants then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs ' || selected_policy.supported_live_plants::text
          || ' supported flowers. Guest Assist can provide up to '
          || ceil(
            selected_policy.supported_live_plants::numeric
              * selected_policy.guest_assist_max_percent / 100
          )::integer::text || '.'
      );
    end if;
    if supported_subcells_value < selected_policy.supported_subcells then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs healthy planting across '
          || selected_policy.supported_subcells::text
          || ' garden sections. Guest Assist can provide up to '
          || ceil(
            selected_policy.supported_subcells::numeric
              * selected_policy.guest_assist_max_percent / 100
          )::integer::text || '.'
      );
    end if;
    if target_record.eligible_accounts_7d
      < stage_record.local_required_accounts
    then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs ' || stage_record.local_required_accounts::text
          || ' distinct account gardener'
          || case when stage_record.local_required_accounts = 1 then '' else 's' end
          || ' during the ' || stage_record.community_stage || ' stage.'
      );
    end if;
    if target_record.active_days_7d < selected_policy.supported_active_days then
      reasons_value := reasons_value || jsonb_build_array(
        'Needs account activity on '
          || selected_policy.supported_active_days::text
          || ' of the last 7 days.'
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

    update public.community_garden_frontier_region_evaluations
    set
      eligible_live_plants = supported_live_value,
      covered_subcells = supported_subcells_value,
      consecutive_support_days = next_consecutive,
      locally_qualified = locally_qualified_value,
      globally_qualified = globally_qualified_value,
      recommended_action = 'none',
      reasons = reasons_value,
      evaluated_at = statement_timestamp(),
      account_live_plants = account_live_value,
      guest_live_plants = guest_live_value,
      guest_assist_live_plants = guest_assist_live_value,
      account_subcells = account_subcells_value,
      guest_assist_subcells = guest_assist_subcells_value,
      required_accounts = stage_record.local_required_accounts
    where evaluation_date = evaluation_day
      and region_x = target_record.region_x
      and region_y = target_record.region_y;
  end loop;

  if globally_qualified_value and current_world.plant_count > 0 then
    capacity_recommendation := greatest(
      ceil(
        current_world.plant_count::numeric
          / (
            selected_policy.effective_region_capacity
            * (selected_policy.target_percent / 100)
          )
      )::integer - current_world.accessible_region_count,
      0
    );
  end if;

  recommendation_budget := capacity_recommendation;
  if stage_record.recommendation_cooldown_days > 0 then
    select count(*)::integer
    into recent_land_changes
    from public.community_garden_region_state_audit as audit
    where audit.created_at >= evaluation_as_of - make_interval(
      days => stage_record.recommendation_cooldown_days
    )
      and audit.next_state in ('frontier', 'established')
      and audit.previous_state is distinct from audit.next_state;
    recommendation_budget := case
      when recent_land_changes > 0 then 0
      else least(capacity_recommendation, 1)
    end;
  end if;

  recommended_expansion_value := least(
    recommendation_budget,
    current_world.perimeter_region_count
  );

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
    when ranked.candidate_rank <= recommended_expansion_value
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

  update public.community_garden_regions as region
  set
    consecutive_support_days = evaluation.consecutive_support_days,
    last_support_date = case
      when evaluation.eligible_live_plants >= selected_policy.supported_live_plants
        and evaluation.covered_subcells >= selected_policy.supported_subcells
        and evaluation.eligible_accounts_7d >= evaluation.required_accounts
        and evaluation.active_days_7d >= selected_policy.supported_active_days
      then evaluation_day
      else region.last_support_date
    end,
    latest_evaluation_date = evaluation_day,
    latest_support = jsonb_build_object(
      'accountLivePlants', evaluation.account_live_plants,
      'guestLivePlants', evaluation.guest_live_plants,
      'guestAssistLivePlants', evaluation.guest_assist_live_plants,
      'eligibleLivePlants', evaluation.eligible_live_plants,
      'accountSubcells', evaluation.account_subcells,
      'guestAssistSubcells', evaluation.guest_assist_subcells,
      'coveredSubcells', evaluation.covered_subcells,
      'eligibleAccounts7d', evaluation.eligible_accounts_7d,
      'requiredAccounts', evaluation.required_accounts,
      'activeDays7d', evaluation.active_days_7d,
      'consecutiveSupportDays', evaluation.consecutive_support_days,
      'communityStage', stage_record.community_stage,
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
    and region.region_y = evaluation.region_y;

  update public.community_garden_frontier_world_evaluations
  set
    evaluated_at = statement_timestamp(),
    policy_version = selected_policy.policy_version,
    required_accounts = stage_record.global_required_accounts,
    globally_qualified = globally_qualified_value,
    qualifying_frontier_regions = qualifying_frontier_count,
    recommended_expansion_count = recommended_expansion_value,
    community_stage = stage_record.community_stage,
    recommendation_cooldown_days =
      stage_record.recommendation_cooldown_days
  where evaluation_date = evaluation_day;

  return base_result || jsonb_build_object(
    'policyVersion', selected_policy.policy_version,
    'communityStage', stage_record.community_stage,
    'requiredAccounts', stage_record.global_required_accounts,
    'globallyQualified', globally_qualified_value,
    'qualifyingFrontierRegions', qualifying_frontier_count,
    'recommendedExpansionCount', recommended_expansion_value,
    'recommendationCooldownDays',
      stage_record.recommendation_cooldown_days,
    'guestAssist', jsonb_build_object(
      'weightPercent', selected_policy.guest_assist_weight_percent,
      'maximumSharePercent', selected_policy.guest_assist_max_percent,
      'countsAsGardener', false
    )
  );
end;
$$;

commit;

