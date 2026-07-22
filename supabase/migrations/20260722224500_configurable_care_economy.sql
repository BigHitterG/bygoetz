-- Basil Care economy controls
--
-- Keeps the ecological and watering footprints unchanged while making the
-- daily Care ceiling adjustable from the private admin health panel. The two
-- reward thresholds remain proportional to the ceiling: one-third and
-- two-thirds of the configured daily limit.

create table if not exists public.community_garden_economy_settings (
  setting_key text primary key check (setting_key = 'current'),
  daily_care_limit integer not null check (daily_care_limit between 300 and 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.community_garden_economy_settings (
  setting_key,
  daily_care_limit
) values (
  'current',
  600
) on conflict (setting_key) do nothing;

create table if not exists public.community_garden_economy_audit (
  id bigint generated always as identity primary key,
  previous_daily_care_limit integer not null check (previous_daily_care_limit between 300 and 2000),
  new_daily_care_limit integer not null check (new_daily_care_limit between 300 and 2000),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index if not exists community_garden_economy_audit_changed_idx
  on public.community_garden_economy_audit (changed_at desc);

alter table public.community_garden_economy_settings enable row level security;
alter table public.community_garden_economy_audit enable row level security;

revoke all on table public.community_garden_economy_settings
  from public, anon, authenticated;
revoke all on table public.community_garden_economy_audit
  from public, anon, authenticated;
grant select, insert, update on table public.community_garden_economy_settings
  to service_role;
grant select, insert on table public.community_garden_economy_audit
  to service_role;

alter table public.community_garden_actor_days
  drop constraint if exists community_garden_actor_days_counts_check;
alter table public.community_garden_actor_days
  add constraint community_garden_actor_days_counts_check
  check (
    mutation_count between 0 and 3000
    and meaningful_actions between 0 and 3000
    and care_earned between 0 and 2000
    and tier_progress between 0 and 19
    and plants_placed between 0 and 3000
    and watering_actions between 0 and 3000
  );

create or replace function public.get_community_garden_economy_settings_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dailyCareLimit', settings.daily_care_limit,
    'fullRewardLimit', floor(settings.daily_care_limit::numeric / 3)::integer,
    'moderateRewardLimit', floor(settings.daily_care_limit::numeric * 2 / 3)::integer,
    'moderateActionsRequired', 4,
    'longActionsRequired', 20,
    'updatedAt', settings.updated_at,
    'auditHistory', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'previousDailyCareLimit', recent.previous_daily_care_limit,
          'newDailyCareLimit', recent.new_daily_care_limit,
          'changedAt', recent.changed_at
        ) order by recent.changed_at desc, recent.id desc
      )
      from (
        select
          audit.id,
          audit.previous_daily_care_limit,
          audit.new_daily_care_limit,
          audit.changed_at
        from public.community_garden_economy_audit as audit
        order by audit.changed_at desc, audit.id desc
        limit 10
      ) as recent
    ), '[]'::jsonb)
  )
  from public.community_garden_economy_settings as settings
  where settings.setting_key = 'current'
$$;

create or replace function public.update_community_garden_economy_settings_v1(
  p_daily_care_limit integer,
  p_updated_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_limit integer;
begin
  if p_daily_care_limit is null or p_daily_care_limit not between 300 and 2000 then
    raise exception 'Choose a daily Care limit from 300 to 2000.' using errcode = '22023';
  end if;
  if p_updated_by is null then
    raise exception 'A verified administrator is required.' using errcode = '42501';
  end if;

  select daily_care_limit into previous_limit
  from public.community_garden_economy_settings
  where setting_key = 'current'
  for update;

  if previous_limit is null then
    raise exception 'The Care economy settings are unavailable.' using errcode = 'P0002';
  end if;

  if previous_limit <> p_daily_care_limit then
    update public.community_garden_economy_settings
    set
      daily_care_limit = p_daily_care_limit,
      updated_at = statement_timestamp(),
      updated_by = p_updated_by
    where setting_key = 'current';

    insert into public.community_garden_economy_audit (
      previous_daily_care_limit,
      new_daily_care_limit,
      changed_by
    ) values (
      previous_limit,
      p_daily_care_limit,
      p_updated_by
    );
  end if;

  return public.get_community_garden_economy_settings_v1();
end;
$$;

-- Version 6 preserves the already-tested action implementations. It maps the
-- configured Care curve onto the legacy 100 / 200 / 300 curve for the duration
-- of the transaction, then restores the real accumulated Care before commit.
-- The actor-day advisory lock makes that temporary representation invisible to
-- other actions from the same gardener, and any failure rolls it back.
create or replace function public.perform_idempotent_community_garden_action_v6(
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
  result_payload jsonb;
  daily_care_limit integer;
  actual_care integer;
  legacy_care integer;
  care_award integer := 0;
  activity_day date := (statement_timestamp() at time zone 'utc')::date;
begin
  if p_action_id is null
    or p_actor_key is null
    or p_actor_key !~ '^[0-9a-f]{64}$'
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

  select coalesce(max(settings.daily_care_limit), 600)::integer
  into daily_care_limit
  from public.community_garden_economy_settings as settings
  where settings.setting_key = 'current';

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

  actual_care := actor_day.care_earned;
  if actual_care >= daily_care_limit then
    raise exception 'You have given this garden a full day of Care. Come grow with us again tomorrow.' using errcode = 'P0001';
  end if;

  legacy_care := floor(actual_care::numeric * 300 / daily_care_limit)::integer;
  update public.community_garden_actor_days
  set care_earned = legacy_care
  where actor_key = p_actor_key and activity_date = activity_day;

  result_payload := public.perform_idempotent_community_garden_action_v5(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );

  care_award := coalesce((result_payload #>> '{contribution,careValue}')::integer, 0);
  update public.community_garden_actor_days
  set care_earned = least(daily_care_limit, actual_care + care_award)
  where actor_key = p_actor_key and activity_date = activity_day;

  if jsonb_typeof(result_payload -> 'contribution') = 'object' then
    result_payload := jsonb_set(
      result_payload,
      '{contribution,dailyCareEarned}',
      to_jsonb(least(daily_care_limit, actual_care + care_award)),
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,dailyCareLimit}',
      to_jsonb(daily_care_limit),
      true
    );
  end if;

  update public.community_garden_actions
  set response_payload = result_payload
  where action_id = p_action_id and status = 'completed';

  return result_payload;
end;
$$;

create or replace function public.get_community_garden_commons_health()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'careCap', settings.daily_care_limit,
    'mutationCap', 3000,
    'activeContributorsToday', (
      select count(*) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date
    ),
    'contributorsAtCareCap', (
      select count(*) from public.community_garden_actor_days
      where activity_date = (statement_timestamp() at time zone 'utc')::date
        and care_earned >= settings.daily_care_limit
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
  from public.community_garden_economy_settings as settings
  where settings.setting_key = 'current'
$$;

revoke execute on function public.get_community_garden_economy_settings_v1()
  from public, anon, authenticated;
revoke execute on function public.update_community_garden_economy_settings_v1(integer, uuid)
  from public, anon, authenticated;
revoke execute on function public.perform_idempotent_community_garden_action_v6(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.get_community_garden_economy_settings_v1()
  to service_role;
grant execute on function public.update_community_garden_economy_settings_v1(integer, uuid)
  to service_role;
grant execute on function public.perform_idempotent_community_garden_action_v6(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;

comment on table public.community_garden_economy_settings is
  'Server-only Basil Care economy settings. The public API exposes only the active numeric rhythm.';
comment on table public.community_garden_economy_audit is
  'Private audit history for administrator Care economy changes.';
comment on function public.perform_idempotent_community_garden_action_v6(
  uuid, text, text, text, integer, integer, text, uuid[]
) is 'Processes authoritative garden actions against the configurable proportional daily Care curve.';
