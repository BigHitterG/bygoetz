-- Heritage now emerges naturally from normal Community Garden care. Players
-- never choose a candidate: the first one of their flowers to complete every
-- Heritage condition becomes their single lifetime Heritage Flower.

drop trigger if exists guard_community_garden_heritage_nomination
  on public.community_garden_heritage_seeds;
drop trigger if exists release_failed_community_garden_heritage_seed
  on public.community_garden_roses;
drop trigger if exists nominate_founding_steward_heritage_seed
  on public.community_garden_roses;

-- Discard pending manual choices without touching successful or grandfathered
-- Heritage Flowers. No live flower is deleted or otherwise altered here.
update public.community_garden_heritage_seeds
set
  nominated_plant_id = null,
  nominated_at = null,
  updated_at = statement_timestamp()
where redeemed_at is null;

create or replace function public.get_community_garden_heritage_seed_v3(
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
  heritage_flower jsonb := 'null'::jsonb;
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
      'badgeEarned', false,
      'heritageFlower', null
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

  return jsonb_build_object(
    'eligible', true,
    'status', case
      when seed.heritage_plant_id is not null then 'heritage'
      else 'growing'
    end,
    'badgeEarned', seed.heritage_plant_id is not null,
    'redeemedAt', seed.redeemed_at,
    'heritageFlower', coalesce(heritage_flower, 'null'::jsonb),
    'criteria', jsonb_build_object(
      'minimumAgeDays', 5,
      'careDays', 3,
      'gardeners', 3,
      'neighbors', 6,
      'regionalCapacity', 9
    )
  );
end;
$$;

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
  member_user_id uuid;
  seed_owner_kind text;
  seed public.community_garden_heritage_seeds%rowtype;
begin
  if old.heritage_at is not null or new.heritage_at is null then
    return new;
  end if;

  if new.contributor_kind <> 'account' or new.contributor_key is null then
    return null;
  end if;

  -- Only active paid members and the three private Founding Stewards can grow
  -- a personal lifetime Heritage Flower.
  select mapping.user_id
  into member_user_id
  from public.community_garden_account_actors as mapping
  join public.garden_stewards as member on member.user_id = mapping.user_id
  join public.garden_entitlements as entitlement
    on entitlement.steward_id = member.id
   and entitlement.product_key = 'basil_founding_gardener'
   and entitlement.status = 'active'
  where mapping.actor_key = new.contributor_key
  order by entitlement.created_at
  limit 1;

  if member_user_id is not null then
    seed_owner_kind := 'member';
  elsif exists (
    select 1
    from public.community_garden_founding_stewards as steward
    where steward.actor_key = new.contributor_key and steward.enabled
  ) then
    seed_owner_kind := 'founding_steward';
  else
    return null;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('basil-heritage-seed:' || new.contributor_key, 0)
  );

  insert into public.community_garden_heritage_seeds (
    owner_actor_key, owner_kind, user_id
  ) values (
    new.contributor_key, seed_owner_kind, member_user_id
  )
  on conflict (owner_actor_key) do update set
    user_id = coalesce(
      public.community_garden_heritage_seeds.user_id,
      excluded.user_id
    ),
    updated_at = statement_timestamp();

  select * into seed
  from public.community_garden_heritage_seeds
  where owner_actor_key = new.contributor_key
  for update;

  if seed.redeemed_at is not null then
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

  -- The qualifying water action naturally chooses this flower. Recording the
  -- candidate and redemption in the same transaction prevents double winners.
  update public.community_garden_heritage_seeds
  set
    nominated_plant_id = new.id,
    nominated_at = new.heritage_at,
    updated_at = new.heritage_at
  where owner_actor_key = new.contributor_key
    and redeemed_at is null;

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
  selected_policy_version text := 'account-heritage-natural-v1';
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

drop function if exists public.nominate_community_garden_heritage_seed_v1(uuid, uuid);
drop function if exists public.guard_community_garden_heritage_nomination_v1();
drop function if exists public.release_failed_community_garden_heritage_seed_v1();
drop function if exists public.nominate_founding_steward_heritage_seed_v1();

revoke all on function public.get_community_garden_heritage_seed_v3(uuid)
  from public, anon, authenticated;
grant execute on function public.get_community_garden_heritage_seed_v3(uuid)
  to service_role;
revoke all on function public.enforce_community_garden_heritage_capacity_v1()
  from public, anon, authenticated;
revoke all on function public.record_community_garden_heritage_event_v1()
  from public, anon, authenticated;

comment on function public.get_community_garden_heritage_seed_v3(uuid) is
  'Returns only natural Heritage status for an active member; it never exposes or accepts candidate selection.';
comment on table public.community_garden_heritage_seeds is
  'Private one-per-account lifetime Heritage state. Automatic promotion records its qualifying flower transactionally; no player nomination is exposed.';
