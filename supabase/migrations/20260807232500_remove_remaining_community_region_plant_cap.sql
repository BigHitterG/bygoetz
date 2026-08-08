-- Planting on an empty tile must not be rejected solely because the surrounding
-- 16x16 region is crowded. A previous repair removed this policy from the
-- insert trigger, but the legacy v3 action function still performed the same
-- 180-row check before reaching that trigger. Every newer action RPC delegates
-- through v3, so remove that remaining gate from the authoritative action path.
do $$
declare
  definition text;
  original text;
  blocked_clause constant text := E'    select count(*)::integer into region_count\n'
    || E'    from public.community_garden_roses\n'
    || E'    where region_x = floor(p_grid_x::numeric / 16)::smallint\n'
    || E'      and region_y = floor(p_grid_y::numeric / 16)::smallint;\n'
    || E'    if region_count >= 180 then\n'
    || E'      raise exception ''This patch is resting. Choose a nearby open part of the garden.'' using errcode = ''P0001'';\n'
    || E'    end if;\n\n';
begin
  select pg_get_functiondef(
    'public.perform_idempotent_community_garden_action_v3(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure
  ) into definition;
  original := definition;
  definition := replace(definition, blocked_clause, '');

  if definition = original
    or definition like '%This patch is resting. Choose a nearby open part of the garden.%'
  then
    raise exception 'Could not safely remove the remaining Community Garden region planting cap.';
  end if;

  execute definition;
end;
$$;

-- Keep the insert boundary explicit and self-contained. Open land, weeds, and
-- the unique tile constraint still protect physical availability; density does
-- not make an otherwise empty square unplantable.
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
    'basil-community-region:' || target_region_x::text || ':' || target_region_y::text,
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

  if exists (
    select 1
    from public.community_garden_weeds as weed
    where weed.grid_x = new.grid_x
      and weed.grid_y = new.grid_y
  ) then
    raise exception 'Pull this weed before planting here.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.enforce_community_garden_plant_insert_v1() is
  'Serializes Community Garden inserts and enforces open land and weed conflicts without rejecting an empty tile because its region is crowded.';

revoke execute on function public.enforce_community_garden_plant_insert_v1()
  from public, anon, authenticated;
grant execute on function public.enforce_community_garden_plant_insert_v1()
  to service_role;
