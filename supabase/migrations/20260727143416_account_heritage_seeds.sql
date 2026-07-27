begin;

-- One explicit lifetime Heritage Seed belongs to each paid Basil account and
-- each private Founding Steward. Public flowers remain anonymous; this table
-- is a private bridge used only by server-side account and action RPCs.
create table public.community_garden_heritage_seeds (
  owner_actor_key text primary key,
  owner_kind text not null,
  user_id uuid unique references auth.users(id) on delete cascade,
  nominated_plant_id uuid unique references public.community_garden_roses(id) on delete set null,
  heritage_plant_id uuid unique references public.community_garden_roses(id),
  available_since timestamptz not null default '1970-01-01 00:00:00+00',
  nominated_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_garden_heritage_seeds_actor_check
    check (owner_actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_heritage_seeds_owner_check
    check (owner_kind in ('member', 'founding_steward')),
  constraint community_garden_heritage_seeds_member_check
    check ((owner_kind = 'member') = (user_id is not null)),
  constraint community_garden_heritage_seeds_nomination_check check (
    nominated_plant_id is null or nominated_at is not null
  ),
  constraint community_garden_heritage_seeds_redeemed_check check (
    redeemed_at is null or heritage_plant_id is not null
  )
);

create index community_garden_heritage_seeds_status_idx
  on public.community_garden_heritage_seeds (owner_kind, redeemed_at, updated_at desc);

alter table public.community_garden_heritage_seeds enable row level security;
revoke all on table public.community_garden_heritage_seeds from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_heritage_seeds to service_role;

insert into public.community_garden_heritage_seeds (owner_actor_key, owner_kind)
select steward.actor_key, 'founding_steward'
from public.community_garden_founding_stewards as steward
on conflict (owner_actor_key) do nothing;

-- Link one already-existing, known-account Heritage Flower when possible.
-- The fifteen pre-policy flowers remain untouched even when no private account
-- mapping exists; they simply remain grandfathered public landmarks.
with known_heritage as (
  select
    mapping.user_id,
    mapping.actor_key,
    plant.id as plant_id,
    plant.heritage_at,
    row_number() over (
      partition by mapping.actor_key
      order by plant.heritage_at, plant.planted_at, plant.id
    ) as account_rank
  from public.community_garden_roses as plant
  join public.community_garden_account_actors as mapping
    on mapping.actor_key = plant.contributor_key
  where plant.heritage_at is not null
)
insert into public.community_garden_heritage_seeds (
  owner_actor_key, owner_kind, user_id,
  nominated_plant_id, heritage_plant_id, nominated_at, redeemed_at
)
select
  actor_key, 'member', user_id,
  plant_id, plant_id, heritage_at, heritage_at
from known_heritage
where account_rank = 1
on conflict (owner_actor_key) do nothing;

create or replace function public.get_community_garden_heritage_seed_v1(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_actor_key text;
  seed public.community_garden_heritage_seeds%rowtype;
  candidates jsonb := '[]'::jsonb;
  heritage_flower jsonb := 'null'::jsonb;
  nominated_flower jsonb := 'null'::jsonb;
begin
  if auth.role() <> 'service_role' or p_user_id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select mapping.actor_key
  into account_actor_key
  from public.community_garden_account_actors as mapping
  join public.garden_stewards as member on member.user_id = mapping.user_id
  join public.garden_entitlements as entitlement
    on entitlement.steward_id = member.id
   and entitlement.product_key = 'basil_founding_gardener'
   and entitlement.status = 'active'
  where mapping.user_id = p_user_id
  order by entitlement.created_at
  limit 1;

  if account_actor_key is null then
    return jsonb_build_object(
      'eligible', false,
      'status', 'unavailable',
      'candidates', '[]'::jsonb
    );
  end if;

  select * into seed
  from public.community_garden_heritage_seeds
  where owner_actor_key = account_actor_key;

  if seed.heritage_plant_id is not null then
    select jsonb_build_object(
      'id', plant.id,
      'plantType', plant.plant_type,
      'gridX', plant.grid_x,
      'gridY', plant.grid_y,
      'plantedAt', plant.planted_at,
      'becameHeritageAt', plant.heritage_at
    )
    into heritage_flower
    from public.community_garden_roses as plant
    where plant.id = seed.heritage_plant_id;
  end if;

  with owned as (
    select
      plant.id,
      plant.plant_type,
      plant.grid_x,
      plant.grid_y,
      plant.planted_at,
      plant.region_x,
      plant.region_y,
      floor(extract(epoch from (statement_timestamp() - plant.planted_at)) / 86400)::integer
        as age_days,
      (
        select count(distinct care.care_date)::integer
        from public.community_garden_heritage_care as care
        where care.plant_id = plant.id
      ) as care_days,
      (
        select count(distinct care.actor_key)::integer
        from public.community_garden_heritage_care as care
        where care.plant_id = plant.id
      ) as gardeners,
      (
        select count(*)::integer
        from public.community_garden_roses as neighbor
        where neighbor.id <> plant.id
          and neighbor.grid_x between plant.grid_x - 2 and plant.grid_x + 2
          and neighbor.grid_y between plant.grid_y - 2 and plant.grid_y + 2
          and neighbor.heritage_at is not null
             or (
               neighbor.id <> plant.id
               and neighbor.grid_x between plant.grid_x - 2 and plant.grid_x + 2
               and neighbor.grid_y between plant.grid_y - 2 and plant.grid_y + 2
               and (neighbor.guest_expires_at is null or neighbor.guest_expires_at > statement_timestamp())
               and (neighbor.succession_at is null or neighbor.succession_at > statement_timestamp())
               and (neighbor.absolute_expires_at is null or neighbor.absolute_expires_at > statement_timestamp())
             )
      ) as neighbors,
      region.land_state,
      region.heritage_capacity,
      (
        select count(*)::integer
        from public.community_garden_roses as established
        where established.region_x = plant.region_x
          and established.region_y = plant.region_y
          and established.heritage_at is not null
      ) as region_heritage_count
    from public.community_garden_roses as plant
    join public.community_garden_regions as region
      on region.region_x = plant.region_x and region.region_y = plant.region_y
    where plant.contributor_key = account_actor_key
      and plant.contributor_kind = 'account'
      and plant.heritage_at is null
      and plant.planted_at >= coalesce(
        seed.available_since,
        '1970-01-01 00:00:00+00'::timestamptz
      )
      and (plant.guest_expires_at is null or plant.guest_expires_at > statement_timestamp())
      and (plant.succession_at is null or plant.succession_at > statement_timestamp())
      and (plant.absolute_expires_at is null or plant.absolute_expires_at > statement_timestamp())
    order by plant.planted_at desc, plant.id
    limit 100
  ), payload as (
    select jsonb_build_object(
      'id', owned.id,
      'plantType', owned.plant_type,
      'gridX', owned.grid_x,
      'gridY', owned.grid_y,
      'plantedAt', owned.planted_at,
      'ageDays', greatest(0, owned.age_days),
      'careDays', owned.care_days,
      'gardeners', owned.gardeners,
      'neighbors', owned.neighbors,
      'regionHeritageCount', owned.region_heritage_count,
      'regionHeritageCapacity', owned.heritage_capacity,
      'nominated', owned.id = seed.nominated_plant_id,
      'criteriaMet',
        owned.age_days >= 5
        and owned.care_days >= 3
        and owned.gardeners >= 3
        and owned.neighbors >= 6
        and owned.land_state in ('founding', 'established')
        and owned.region_heritage_count < owned.heritage_capacity
    ) as value,
    owned.planted_at,
    owned.id
    from owned
  )
  select coalesce(
    jsonb_agg(payload.value order by payload.planted_at desc, payload.id),
    '[]'::jsonb
  )
  into candidates
  from payload;

  select item.value
  into nominated_flower
  from jsonb_array_elements(candidates) as item(value)
  where coalesce((item.value ->> 'nominated')::boolean, false)
  limit 1;
  nominated_flower := coalesce(nominated_flower, 'null'::jsonb);

  return jsonb_build_object(
    'eligible', true,
    'status', case
      when seed.redeemed_at is not null then 'heritage'
      when seed.nominated_plant_id is not null then 'nominated'
      else 'available'
    end,
    'badgeEarned', seed.redeemed_at is not null,
    'nominatedAt', seed.nominated_at,
    'availableSince', coalesce(
      seed.available_since,
      '1970-01-01 00:00:00+00'::timestamptz
    ),
    'redeemedAt', seed.redeemed_at,
    'nominatedFlower', nominated_flower,
    'heritageFlower', heritage_flower,
    'criteria', jsonb_build_object(
      'minimumAgeDays', 5,
      'careDays', 3,
      'gardeners', 3,
      'neighbors', 6,
      'regionalCapacity', 9
    ),
    'candidates', candidates
  );
end;
$$;

create or replace function public.nominate_community_garden_heritage_seed_v1(
  p_user_id uuid,
  p_plant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_actor_key text;
  chosen public.community_garden_roses%rowtype;
  seed public.community_garden_heritage_seeds%rowtype;
  qualifies boolean := false;
  action_time timestamptz := statement_timestamp();
begin
  if auth.role() <> 'service_role' or p_user_id is null or p_plant_id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select mapping.actor_key
  into account_actor_key
  from public.community_garden_account_actors as mapping
  join public.garden_stewards as member on member.user_id = mapping.user_id
  join public.garden_entitlements as entitlement
    on entitlement.steward_id = member.id
   and entitlement.product_key = 'basil_founding_gardener'
   and entitlement.status = 'active'
  where mapping.user_id = p_user_id
  order by entitlement.created_at
  limit 1;

  if account_actor_key is null then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('basil-heritage-seed:' || account_actor_key, 0)
  );

  insert into public.community_garden_heritage_seeds (
    owner_actor_key, owner_kind, user_id
  ) values (
    account_actor_key, 'member', p_user_id
  )
  on conflict (owner_actor_key) do update set
    user_id = excluded.user_id,
    updated_at = action_time;

  select * into seed
  from public.community_garden_heritage_seeds
  where owner_actor_key = account_actor_key
  for update;

  if seed.redeemed_at is not null then
    raise exception 'This account has already grown its lifetime Heritage Flower.'
      using errcode = 'P0001';
  end if;

  if seed.nominated_plant_id is not null then
    if seed.nominated_plant_id = p_plant_id then
      return public.get_community_garden_heritage_seed_v1(p_user_id);
    end if;
    raise exception 'Your Heritage Seed is already growing with its nominated flower.'
      using errcode = 'P0001';
  end if;

  select * into chosen
  from public.community_garden_roses as plant
  where plant.id = p_plant_id
    and plant.contributor_key = account_actor_key
    and plant.contributor_kind = 'account'
    and plant.heritage_at is null
    and plant.planted_at >= seed.available_since
    and (plant.guest_expires_at is null or plant.guest_expires_at > action_time)
    and (plant.succession_at is null or plant.succession_at > action_time)
    and (plant.absolute_expires_at is null or plant.absolute_expires_at > action_time)
  for update;

  if chosen.id is null then
    raise exception 'Choose one of your living Community Garden flowers.'
      using errcode = '22023';
  end if;

  update public.community_garden_heritage_seeds
  set
    nominated_plant_id = chosen.id,
    nominated_at = action_time,
    updated_at = action_time
  where owner_actor_key = account_actor_key;

  select
    chosen.planted_at <= action_time - interval '5 days'
    and (
      select count(distinct care.care_date)
      from public.community_garden_heritage_care as care
      where care.plant_id = chosen.id
    ) >= 3
    and (
      select count(distinct care.actor_key)
      from public.community_garden_heritage_care as care
      where care.plant_id = chosen.id
    ) >= 3
    and (
      select count(*)
      from public.community_garden_roses as neighbor
      where neighbor.id <> chosen.id
        and neighbor.grid_x between chosen.grid_x - 2 and chosen.grid_x + 2
        and neighbor.grid_y between chosen.grid_y - 2 and chosen.grid_y + 2
        and (neighbor.succession_at is null or neighbor.succession_at > action_time)
        and (neighbor.absolute_expires_at is null or neighbor.absolute_expires_at > action_time)
    ) >= 6
  into qualifies;

  if qualifies then
    perform pg_catalog.set_config('basil.helper_actor_key', account_actor_key, true);
    update public.community_garden_roses
    set
      heritage_at = action_time,
      guest_expires_at = null,
      succession_at = null,
      absolute_expires_at = null
    where id = chosen.id and heritage_at is null;
  end if;

  return public.get_community_garden_heritage_seed_v1(p_user_id);
end;
$$;

-- A failed candidate must actually return to earth before the owner can try
-- again. Releasing it advances the eligibility line, so the returned seed can
-- only be placed on a flower planted after that loss.
create or replace function public.release_failed_community_garden_heritage_seed_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.community_garden_heritage_seeds
  set
    nominated_plant_id = null,
    nominated_at = null,
    available_since = statement_timestamp(),
    updated_at = statement_timestamp()
  where nominated_plant_id = old.id
    and redeemed_at is null;
  return old;
end;
$$;

create trigger release_failed_community_garden_heritage_seed
before delete on public.community_garden_roses
for each row execute function public.release_failed_community_garden_heritage_seed_v1();

-- A Founding Steward silently nominates its first available planted flower.
-- If that candidate returns to earth before qualifying, the foreign key clears
-- it and the next planted flower becomes the new candidate.
create or replace function public.nominate_founding_steward_heritage_seed_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.community_garden_heritage_seeds as seed
  set
    nominated_plant_id = new.id,
    nominated_at = new.planted_at,
    updated_at = statement_timestamp()
  where seed.owner_actor_key = new.contributor_key
    and seed.owner_kind = 'founding_steward'
    and seed.redeemed_at is null
    and seed.nominated_plant_id is null
    and new.planted_at >= seed.available_since;
  return new;
end;
$$;

create trigger nominate_founding_steward_heritage_seed
after insert on public.community_garden_roses
for each row execute function public.nominate_founding_steward_heritage_seed_v1();

create or replace function public.enforce_community_garden_heritage_capacity_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_land_state text;
  target_capacity integer;
  current_heritage_count integer;
  seed public.community_garden_heritage_seeds%rowtype;
begin
  if old.heritage_at is not null or new.heritage_at is null then
    return new;
  end if;

  if new.contributor_kind <> 'account' or new.contributor_key is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('basil-heritage-seed:' || new.contributor_key, 0)
  );
  select * into seed
  from public.community_garden_heritage_seeds
  where owner_actor_key = new.contributor_key
  for update;

  if seed.owner_actor_key is null
    or seed.redeemed_at is not null
    or seed.nominated_plant_id is distinct from new.id
  then
    return null;
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'basil-community-heritage:' || new.region_x::text || ':' || new.region_y::text,
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
  into current_heritage_count
  from public.community_garden_roses as plant
  where plant.region_x = new.region_x
    and plant.region_y = new.region_y
    and plant.heritage_at is not null
    and plant.id <> new.id;

  if current_heritage_count >= target_capacity then
    return null;
  end if;

  new.guest_expires_at := null;
  new.succession_at := null;
  new.absolute_expires_at := null;
  return new;
end;
$$;

create or replace function public.record_community_garden_heritage_event_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_event_id uuid;
  helper_key text;
  selected_policy_version text := 'account-heritage-seed-v1';
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

  update public.community_garden_heritage_seeds
  set
    heritage_plant_id = new.id,
    redeemed_at = new.heritage_at,
    updated_at = new.heritage_at
  where owner_actor_key = new.contributor_key
    and nominated_plant_id = new.id
    and redeemed_at is null;

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
    select event.event_id into created_event_id
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

revoke all on function public.get_community_garden_heritage_seed_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_community_garden_heritage_seed_v1(uuid)
  to service_role;
revoke all on function public.nominate_community_garden_heritage_seed_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.nominate_community_garden_heritage_seed_v1(uuid, uuid)
  to service_role;
revoke all on function public.nominate_founding_steward_heritage_seed_v1()
  from public, anon, authenticated;
revoke all on function public.release_failed_community_garden_heritage_seed_v1()
  from public, anon, authenticated;

comment on table public.community_garden_heritage_seeds is
  'Private one-per-owner lifetime Heritage Seed state. Public garden snapshots never expose the owner mapping.';
comment on function public.nominate_community_garden_heritage_seed_v1(uuid, uuid) is
  'Lets an active member explicitly nominate one living Community Garden flower; an already-qualified nomination promotes in the same transaction.';

commit;
