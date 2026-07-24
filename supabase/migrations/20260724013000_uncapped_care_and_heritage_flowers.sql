-- Basil's open-ended Care economy keeps every legitimate helpful action
-- rewarding. Public-map safety comes from contributor footprints, regional
-- pressure, and high technical abuse rails rather than a visible reward cap.

alter table public.community_garden_roses
  add column if not exists heritage_at timestamptz;

create index if not exists community_garden_roses_heritage_idx
  on public.community_garden_roses (heritage_at)
  where heritage_at is not null;

comment on column public.community_garden_roses.heritage_at is
  'When set, this community-supported flower is permanent and no longer counts against its contributor''s ordinary 100-flower footprint.';

create table if not exists public.community_garden_heritage_care (
  plant_id uuid not null
    references public.community_garden_roses(id) on delete cascade,
  actor_key text not null
    check (actor_key ~ '^[0-9a-f]{64}$'),
  care_date date not null,
  first_watered_at timestamptz not null default now(),
  primary key (plant_id, actor_key, care_date)
);

create index if not exists community_garden_heritage_care_plant_day_idx
  on public.community_garden_heritage_care (plant_id, care_date);

alter table public.community_garden_heritage_care enable row level security;
revoke all on table public.community_garden_heritage_care
  from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_heritage_care
  to service_role;

comment on table public.community_garden_heritage_care is
  'Server-only, anonymous evidence used to promote well-established community flowers into permanent Heritage Flowers.';

-- Convert existing lifetime progression into the new denomination. This keeps
-- every inventory unlock an existing member had already earned, without
-- changing their spendable Care balance or replaying historical celebrations.
with converted as (
  select
    steward_id,
    greatest(
      lifetime_care,
      case
        when lifetime_care >= 2800 then 165000
        when lifetime_care >= 2500 then 135000
        when lifetime_care >= 2200 then 110000
        when lifetime_care >= 2000 then 90000
        when lifetime_care >= 1800 then 75000
        when lifetime_care >= 1650 then 60000
        when lifetime_care >= 1500 then 50000
        when lifetime_care >= 1400 then 42000
        when lifetime_care >= 1200 then 34000
        when lifetime_care >= 1050 then 28000
        when lifetime_care >= 950 then 23000
        when lifetime_care >= 850 then 19000
        when lifetime_care >= 750 then 15000
        when lifetime_care >= 725 then 13000
        when lifetime_care >= 675 then 11000
        when lifetime_care >= 600 then 9000
        when lifetime_care >= 525 then 7500
        when lifetime_care >= 450 then 6000
        when lifetime_care >= 375 then 4500
        when lifetime_care >= 300 then 3000
        when lifetime_care >= 250 then 2000
        when lifetime_care >= 200 then 1600
        when lifetime_care >= 150 then 1300
        when lifetime_care >= 125 then 1000
        when lifetime_care >= 100 then 750
        when lifetime_care >= 75 then 500
        when lifetime_care >= 50 then 250
        when lifetime_care >= 25 then 100
        else lifetime_care
      end
    )::integer as converted_lifetime
  from public.garden_member_progress
)
update public.garden_member_progress as progress
set
  lifetime_care = converted.converted_lifetime,
  inventory_seen_lifetime_care = converted.converted_lifetime,
  updated_at = now()
from converted
where progress.steward_id = converted.steward_id
  and (
    progress.lifetime_care <> converted.converted_lifetime
    or progress.inventory_seen_lifetime_care <> converted.converted_lifetime
  );

update public.garden_personal_plant_catalog
set
  lifetime_care_required = case plant_type
    when 'rose' then 0
    when 'sunflower' then 0
    when 'lavender' then 0
    when 'daisy' then 100
    when 'tulip' then 250
    when 'wildflowers' then 500
    when 'peony' then 2000
    when 'bee_balm' then 15000
    else lifetime_care_required
  end,
  care_cost = case plant_type
    when 'peony' then 4
    else care_cost
  end,
  updated_at = now()
where active;

update public.garden_personal_element_catalog
set
  lifetime_care_required = case element_type
    when 'stone_paver' then 0
    when 'birdhouse' then 0
    when 'bench' then 0
    when 'gravel_tile' then 750
    when 'brick_paver' then 1000
    when 'clay_pot' then 1300
    when 'hedge' then 1600
    when 'fern' then 3000
    when 'hydrangea' then 4500
    when 'wheelbarrow' then 6000
    when 'wooden_planter' then 7500
    when 'bird_feeder' then 9000
    when 'rustic_bench' then 11000
    when 'trellis' then 13000
    when 'butterfly_bush' then 19000
    when 'pollinator_sign' then 23000
    when 'butterfly_house' then 28000
    when 'beehive' then 34000
    when 'rose_trellis' then 42000
    when 'reeds' then 50000
    when 'lily_pads' then 60000
    when 'birdbath' then 75000
    when 'stone_basin' then 90000
    when 'willow_tree' then 110000
    when 'fountain' then 135000
    when 'small_pond' then 165000
    else lifetime_care_required
  end,
  care_cost = case element_type
    when 'fern' then 25
    when 'hydrangea' then 40
    when 'wheelbarrow' then 50
    when 'wooden_planter' then 75
    when 'bird_feeder' then 100
    when 'rustic_bench' then 125
    when 'trellis' then 200
    when 'butterfly_bush' then 60
    when 'pollinator_sign' then 100
    when 'butterfly_house' then 150
    when 'beehive' then 250
    when 'rose_trellis' then 400
    when 'reeds' then 10
    when 'lily_pads' then 15
    when 'birdbath' then 250
    when 'stone_basin' then 500
    when 'willow_tree' then 800
    when 'fountain' then 1500
    when 'small_pond' then 2500
    else care_cost
  end,
  updated_at = now()
where active;

-- Raise only technical safety rails. The measured strong-player burst was
-- about 84 accepted actions/minute; 150/minute leaves ample legitimate room.
do $$
declare
  definition text;
  original text;
begin
  select pg_get_functiondef(
    'public.perform_idempotent_community_garden_action_v3(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(definition, 'actor_day.mutation_count >= 3000', 'actor_day.mutation_count >= 30000');
  definition := replace(definition, 'network_day.mutation_count >= 12000', 'network_day.mutation_count >= 120000');
  definition := replace(
    definition,
    'actor_recent_count >= 60 or network_recent_count >= 600',
    'actor_recent_count >= 150 or network_recent_count >= 1500'
  );
  definition := replace(
    definition,
    'where contributor_key = p_actor_key',
    'where contributor_key = p_actor_key and heritage_at is null'
  );
  if definition = original then
    raise exception 'Basil v3 action policy could not be upgraded safely.';
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
    'public.perform_idempotent_community_garden_action_v4(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(
    definition,
    'where contributor_key = p_actor_key',
    'where contributor_key = p_actor_key and heritage_at is null'
  );
  if definition = original then
    raise exception 'Basil v4 footprint policy could not be upgraded safely.';
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
    'public.perform_idempotent_community_garden_water_v1(uuid,text,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(definition, 'actor_day.mutation_count >= 3000', 'actor_day.mutation_count >= 30000');
  definition := replace(definition, 'network_day.mutation_count >= 12000', 'network_day.mutation_count >= 120000');
  definition := replace(
    definition,
    'actor_recent_count >= 60 or network_recent_count >= 600',
    'actor_recent_count >= 150 or network_recent_count >= 1500'
  );
  if definition = original then
    raise exception 'Basil watering safety rails could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

-- Heritage flowers never expire during snapshots, and the canonical payload
-- exposes the promotion timestamp to every client.
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
    E'where grid_x between -96 and 63 and grid_y between -96 and 63\n    and (',
    E'where grid_x between -96 and 63 and grid_y between -96 and 63\n    and heritage_at is null\n    and ('
  );
  definition := replace(
    definition,
    '''last_watered_at'', last_watered_at, ''created_at'', created_at',
    '''last_watered_at'', last_watered_at, ''created_at'', created_at, ''heritage_at'', heritage_at'
  );
  if definition = original then
    raise exception 'Basil snapshot heritage policy could not be upgraded safely.';
  end if;
  execute definition;
end;
$$;

create or replace function public.perform_idempotent_community_garden_action_v8(
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
  actual_care integer := 0;
  care_award integer := 0;
  worm_bonus integer := 0;
  is_garden_worm boolean := false;
  candidate_id uuid;
  promoted_id uuid;
  heritage_ids uuid[] := array[]::uuid[];
  action_time timestamptz := statement_timestamp();
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
    if previous_action.status = 'completed'
      and previous_action.response_payload is not null
    then
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

  actual_care := actor_day.care_earned;

  -- Reuse the established, transactional action validators while presenting
  -- them with a non-tapered reward position. The first helpful action still
  -- receives +4; every later helpful action receives its full base reward.
  update public.community_garden_actor_days
  set care_earned = case when actual_care = 0 then 0 else 1 end,
      tier_progress = 0
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

  care_award := coalesce(
    (result_payload #>> '{contribution,careValue}')::integer,
    0
  );

  is_garden_worm :=
    p_action_type = 'plant'
    and jsonb_typeof(result_payload -> 'contribution') = 'object'
    and care_award > 0
    and mod(
      pg_catalog.get_byte(
        pg_catalog.decode(
          pg_catalog.substr(pg_catalog.replace(p_action_id::text, '-', ''), 1, 2),
          'hex'
        ),
        0
      ),
      64
    ) = 0;

  if is_garden_worm then
    worm_bonus := 2;
    update public.garden_care_receipts
    set care_value = care_value + worm_bonus
    where action_id = p_action_id
      and claimed_at is null;
    care_award := care_award + worm_bonus;
    result_payload := jsonb_set(
      result_payload,
      '{contribution,gardenWorm}',
      'true'::jsonb,
      true
    );
  end if;

  update public.community_garden_actor_days
  set
    care_earned = actual_care + care_award,
    tier_progress = 0
  where actor_key = p_actor_key and activity_date = activity_day;

  if jsonb_typeof(result_payload -> 'contribution') = 'object' then
    result_payload := jsonb_set(
      result_payload,
      '{contribution,careValue}',
      to_jsonb(care_award),
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,dailyCareEarned}',
      to_jsonb(actual_care + care_award),
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,dailyCareLimit}',
      'null'::jsonb,
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,earningPhase}',
      to_jsonb(case when actual_care = 0 then 'daily' else 'open' end),
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,tierProgress}',
      '0'::jsonb,
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,actionsRequired}',
      '1'::jsonb,
      true
    );
    result_payload := jsonb_set(
      result_payload,
      '{contribution,carePolicy}',
      '"uncapped"'::jsonb,
      true
    );
  end if;

  if p_action_type = 'water' then
    for candidate_id in
      select distinct value::uuid
      from jsonb_array_elements_text(
        coalesce(result_payload -> 'wateringClaimedPlantIds', '[]'::jsonb)
      ) as claimed(value)
    loop
      insert into public.community_garden_heritage_care (
        plant_id, actor_key, care_date, first_watered_at
      ) values (
        candidate_id, p_actor_key, activity_day, action_time
      )
      on conflict (plant_id, actor_key, care_date) do nothing;

      promoted_id := null;
      update public.community_garden_roses as plant
      set
        heritage_at = action_time,
        succession_at = null,
        absolute_expires_at = null
      where plant.id = candidate_id
        and plant.heritage_at is null
        and plant.planted_at <= action_time - interval '5 days'
        and (
          select count(distinct evidence.care_date)
          from public.community_garden_heritage_care as evidence
          where evidence.plant_id = plant.id
        ) >= 3
        and (
          select count(distinct evidence.actor_key)
          from public.community_garden_heritage_care as evidence
          where evidence.plant_id = plant.id
        ) >= 3
        and (
          select count(*)
          from public.community_garden_roses as neighbor
          where neighbor.id <> plant.id
            and neighbor.grid_x between plant.grid_x - 2 and plant.grid_x + 2
            and neighbor.grid_y between plant.grid_y - 2 and plant.grid_y + 2
            and (neighbor.succession_at is null or neighbor.succession_at > action_time)
            and (neighbor.absolute_expires_at is null or neighbor.absolute_expires_at > action_time)
        ) >= 6
      returning plant.id into promoted_id;

      if promoted_id is not null then
        heritage_ids := array_append(heritage_ids, promoted_id);
      end if;
    end loop;
  end if;

  result_payload := jsonb_set(
    result_payload,
    '{heritagePlantIds}',
    to_jsonb(heritage_ids),
    true
  );

  update public.community_garden_actions
  set response_payload = result_payload
  where action_id = p_action_id
    and status = 'completed';

  return result_payload;
end;
$$;

revoke execute on function public.perform_idempotent_community_garden_action_v8(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_action_v8(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_action_v8(
  uuid, text, text, text, integer, integer, text, uuid[]
) is 'Processes Basil actions with open-ended Care rewards, rare Garden Worm bonuses, and server-authoritative Heritage Flower promotion.';

-- Force the next read to regenerate the canonical payload with heritage data.
delete from public.community_garden_snapshots;
