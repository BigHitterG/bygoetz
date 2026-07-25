-- Give every authenticated Basil account one stable Community Garden footprint
-- across browsers and devices. Signed-out visitors retain an anonymous browser
-- footprint whose new flowers remain for at most 24 hours unless that browser
-- later signs in and transfers them to an account.

alter table public.community_garden_roses
  add column if not exists contributor_kind text not null default 'legacy',
  add column if not exists guest_expires_at timestamptz;

alter table public.community_garden_roses
  drop constraint if exists community_garden_roses_contributor_kind_check;
alter table public.community_garden_roses
  add constraint community_garden_roses_contributor_kind_check
  check (contributor_kind in ('legacy', 'guest', 'account'));

create index if not exists community_garden_roses_guest_expiry_idx
  on public.community_garden_roses (guest_expires_at)
  where guest_expires_at is not null and heritage_at is null;
create index if not exists garden_care_receipts_actor_unclaimed_idx
  on public.garden_care_receipts (actor_key, created_at)
  where actor_key is not null and claimed_at is null;
create index if not exists community_garden_heritage_care_actor_idx
  on public.community_garden_heritage_care (actor_key, care_date);

comment on column public.community_garden_roses.contributor_kind is
  'Server-assigned anonymous identity class. Account keys are one-way hashes and never expose an account ID or email.';
comment on column public.community_garden_roses.guest_expires_at is
  'New signed-out contributions return at the first ten-minute ecology update after this time unless transferred to an authenticated account.';

-- The Care economy is intentionally uncapped. These checks remain high
-- technical integer rails rather than player-facing daily limits.
alter table public.community_garden_actor_days
  drop constraint if exists community_garden_actor_days_counts_check;
alter table public.community_garden_actor_days
  add constraint community_garden_actor_days_counts_check
  check (
    mutation_count between 0 and 2000000000
    and meaningful_actions between 0 and 2000000000
    and care_earned between 0 and 2000000000
    and tier_progress between 0 and 19
    and plants_placed between 0 and 2000000000
    and watering_actions between 0 and 2000000000
  );

create or replace function public.reconcile_community_garden_actor_v1(
  p_guest_actor_key text,
  p_account_actor_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved_plants integer := 0;
  ordinary_count integer := 0;
  overflow_count integer := 0;
  next_snapshot_at timestamptz := to_timestamp(
    (floor(extract(epoch from statement_timestamp()) / 600) + 1) * 600
  );
begin
  if p_guest_actor_key is null
    or p_account_actor_key is null
    or p_guest_actor_key !~ '^[0-9a-f]{64}$'
    or p_account_actor_key !~ '^[0-9a-f]{64}$'
  then
    raise exception 'This garden identity could not be verified.' using errcode = '22023';
  end if;

  if p_guest_actor_key = p_account_actor_key then
    return jsonb_build_object('movedPlants', 0, 'ordinaryFootprint', 0);
  end if;

  -- Lock both identities in deterministic order so two tabs can reconcile the
  -- same account without double-counting daily totals or racing footprint order.
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'basil-community-actor:' || least(p_guest_actor_key, p_account_actor_key),
      0
    )
  );
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'basil-community-actor:' || greatest(p_guest_actor_key, p_account_actor_key),
      0
    )
  );

  -- Most authenticated requests have nothing left to transfer. Keep that hot
  -- path to indexed existence checks rather than recounting the account.
  if not exists (
      select 1 from public.community_garden_roses
      where contributor_key = p_guest_actor_key limit 1
    )
    and not exists (
      select 1 from public.community_garden_actor_days
      where actor_key = p_guest_actor_key limit 1
    )
    and not exists (
      select 1 from public.community_garden_watering_history
      where actor_key = p_guest_actor_key limit 1
    )
    and not exists (
      select 1 from public.community_garden_heritage_care
      where actor_key = p_guest_actor_key limit 1
    )
    and not exists (
      select 1 from public.community_garden_watering_claims
      where actor_key = p_guest_actor_key limit 1
    )
    and not exists (
      select 1 from public.garden_care_receipts
      where actor_key = p_guest_actor_key and claimed_at is null limit 1
    )
    and not exists (
      select 1 from public.community_garden_actions
      where actor_key = p_guest_actor_key limit 1
    )
  then
    return jsonb_build_object('movedPlants', 0, 'ordinaryFootprint', 0);
  end if;

  insert into public.community_garden_actor_days (
    actor_key,
    activity_date,
    mutation_count,
    meaningful_actions,
    care_earned,
    tier_progress,
    plants_placed,
    watering_actions,
    first_action_at,
    last_action_at,
    created_at
  )
  select
    p_account_actor_key,
    activity_date,
    mutation_count,
    meaningful_actions,
    care_earned,
    tier_progress,
    plants_placed,
    watering_actions,
    first_action_at,
    last_action_at,
    created_at
  from public.community_garden_actor_days
  where actor_key = p_guest_actor_key
  on conflict (actor_key, activity_date) do update set
    mutation_count = least(
      2000000000,
      public.community_garden_actor_days.mutation_count::bigint
        + excluded.mutation_count
    )::integer,
    meaningful_actions = least(
      2000000000,
      public.community_garden_actor_days.meaningful_actions::bigint
        + excluded.meaningful_actions
    )::integer,
    care_earned = least(
      2000000000,
      public.community_garden_actor_days.care_earned::bigint
        + excluded.care_earned
    )::integer,
    tier_progress = greatest(
      public.community_garden_actor_days.tier_progress,
      excluded.tier_progress
    ),
    plants_placed = least(
      2000000000,
      public.community_garden_actor_days.plants_placed::bigint
        + excluded.plants_placed
    )::integer,
    watering_actions = least(
      2000000000,
      public.community_garden_actor_days.watering_actions::bigint
        + excluded.watering_actions
    )::integer,
    first_action_at = least(
      public.community_garden_actor_days.first_action_at,
      excluded.first_action_at
    ),
    last_action_at = greatest(
      public.community_garden_actor_days.last_action_at,
      excluded.last_action_at
    ),
    created_at = least(
      public.community_garden_actor_days.created_at,
      excluded.created_at
    );

  delete from public.community_garden_actor_days
  where actor_key = p_guest_actor_key;

  insert into public.community_garden_watering_history (
    actor_key, plant_id, last_rewarded_at, action_id
  )
  select
    p_account_actor_key, plant_id, last_rewarded_at, action_id
  from public.community_garden_watering_history
  where actor_key = p_guest_actor_key
  on conflict (actor_key, plant_id) do update set
    last_rewarded_at = greatest(
      public.community_garden_watering_history.last_rewarded_at,
      excluded.last_rewarded_at
    ),
    action_id = case
      when excluded.last_rewarded_at
        >= public.community_garden_watering_history.last_rewarded_at
        then excluded.action_id
      else public.community_garden_watering_history.action_id
    end;

  delete from public.community_garden_watering_history
  where actor_key = p_guest_actor_key;

  insert into public.community_garden_heritage_care (
    plant_id, actor_key, care_date, first_watered_at
  )
  select
    plant_id, p_account_actor_key, care_date, first_watered_at
  from public.community_garden_heritage_care
  where actor_key = p_guest_actor_key
  on conflict (plant_id, actor_key, care_date) do update set
    first_watered_at = least(
      public.community_garden_heritage_care.first_watered_at,
      excluded.first_watered_at
    );

  delete from public.community_garden_heritage_care
  where actor_key = p_guest_actor_key;

  update public.community_garden_watering_claims
  set actor_key = p_account_actor_key
  where actor_key = p_guest_actor_key;

  update public.garden_care_receipts
  set actor_key = p_account_actor_key
  where actor_key = p_guest_actor_key;

  update public.community_garden_actions
  set actor_key = p_account_actor_key
  where actor_key = p_guest_actor_key;

  update public.community_garden_roses
  set
    contributor_key = p_account_actor_key,
    contributor_kind = 'account',
    guest_expires_at = null
  where contributor_key = p_guest_actor_key;
  get diagnostics moved_plants = row_count;

  select count(*)::integer
  into ordinary_count
  from public.community_garden_roses
  where contributor_key = p_account_actor_key
    and heritage_at is null;

  overflow_count := greatest(ordinary_count - 100, 0);

  with ranked_footprint as (
    select
      id,
      row_number() over (order by created_at, id) as footprint_rank
    from public.community_garden_roses
    where contributor_key = p_account_actor_key
      and heritage_at is null
  )
  update public.community_garden_roses as plants
  set succession_at = case
    when ranked_footprint.footprint_rank <= overflow_count
      then coalesce(plants.succession_at, next_snapshot_at)
    else null
  end
  from ranked_footprint
  where plants.id = ranked_footprint.id
    and plants.succession_at is distinct from case
      when ranked_footprint.footprint_rank <= overflow_count
        then coalesce(plants.succession_at, next_snapshot_at)
      else null
    end;

  return jsonb_build_object(
    'movedPlants', moved_plants,
    'ordinaryFootprint', ordinary_count,
    'scheduledOverflow', overflow_count
  );
end;
$$;

revoke execute on function public.reconcile_community_garden_actor_v1(text, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_community_garden_actor_v1(text, text)
  to service_role;

comment on function public.reconcile_community_garden_actor_v1(text, text) is
  'Idempotently transfers one anonymous browser actor into a private one-way account actor, merges cooldown and Care evidence, and normalizes the account newest-100 ordinary flower footprint.';

-- Guest flowers cannot become Heritage Flowers. Account transfer preserves
-- planted_at and care evidence, so a transferred flower can still qualify later.
do $$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef(
    'public.perform_idempotent_community_garden_action_v8(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(
    definition,
    E'and plant.heritage_at is null\n        and plant.planted_at',
    E'and plant.heritage_at is null\n        and plant.contributor_kind <> ''guest''\n        and plant.planted_at'
  );
  definition := replace(
    definition,
    E'heritage_at = action_time,\n        succession_at = null,',
    E'heritage_at = action_time,\n        guest_expires_at = null,\n        succession_at = null,'
  );
  if definition = original
    or definition not like '%plant.contributor_kind <> ''guest''%'
    or definition not like '%guest_expires_at = null%'
  then
    raise exception 'Basil Heritage eligibility could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

-- Expired guest flowers stop being valid watering targets immediately, even
-- before the next public snapshot performs their bounded cleanup.
do $$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef(
    'public.perform_idempotent_community_garden_water_v1(uuid,text,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(
    definition,
    E'and (absolute_expires_at is null or absolute_expires_at > action_time)\n      and (succession_at',
    E'and (absolute_expires_at is null or absolute_expires_at > action_time)\n      and (guest_expires_at is null or guest_expires_at > action_time)\n      and (succession_at'
  );
  if definition = original
    or definition not like '%guest_expires_at is null or guest_expires_at > action_time%'
  then
    raise exception 'Basil watering guest-expiry policy could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

do $$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef(
    'public.get_community_garden_watering_status_v1(text,integer,integer,integer,integer)'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(
    definition,
    E'and (plant.absolute_expires_at is null or plant.absolute_expires_at > checked_at)\n    and (plant.succession_at',
    E'and (plant.absolute_expires_at is null or plant.absolute_expires_at > checked_at)\n    and (plant.guest_expires_at is null or plant.guest_expires_at > checked_at)\n    and (plant.succession_at'
  );
  if definition = original
    or definition not like '%plant.guest_expires_at is null or plant.guest_expires_at > checked_at%'
  then
    raise exception 'Basil watering-status guest-expiry policy could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

-- v9 keeps the established action transaction and adds only the identity-class
-- policy to the newly planted row. Existing flowers are deliberately
-- grandfathered until their browser is reconciled to an account.
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
  action_time timestamptz := statement_timestamp();
begin
  if p_is_guest is null then
    raise exception 'This garden identity could not be verified.' using errcode = '22023';
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
        contributor_kind = case when p_is_guest then 'guest' else 'account' end,
        guest_expires_at = case
          when p_is_guest then action_time + interval '24 hours'
          else null
        end
      where id = planted_id
        and contributor_key = p_actor_key
        and heritage_at is null;
    end if;
  end if;

  return result_payload;
end;
$$;

revoke execute on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) is 'Processes account-wide or temporary guest Basil actions. New guest flowers receive a 24-hour expiry; account flowers share one stable newest-100 footprint across devices.';

-- The canonical snapshot removes expired guests at the normal ten-minute
-- garden update. Heritage rows remain protected by the existing outer guard.
do $$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef(
    'public.get_or_create_community_garden_snapshot()'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(
    definition,
    E'or absolute_expires_at <= statement_timestamp()\n      or last_watered_at',
    E'or absolute_expires_at <= statement_timestamp()\n      or guest_expires_at <= statement_timestamp()\n      or last_watered_at'
  );
  if definition = original
    or definition not like '%guest_expires_at <= statement_timestamp()%'
  then
    raise exception 'Basil snapshot guest-expiry policy could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

delete from public.community_garden_snapshots;
