-- A region's pressure state remains useful for spawn balancing, ecology,
-- frontier planning, and map guidance. It must not reject a human planting
-- on an otherwise open, empty tile. The unique tile constraint and the weed
-- guard below remain authoritative for physical availability.
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
    'basil-community-region:'
      || target_region_x::text || ':' || target_region_y::text,
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
    select 1 from public.community_garden_weeds as weed
    where weed.grid_x = new.grid_x and weed.grid_y = new.grid_y
  ) then
    raise exception 'Pull this weed before planting here.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.enforce_community_garden_plant_insert_v1() is
  'Serializes shared-garden inserts and enforces open land, empty tiles, and weed conflicts without rejecting an open tile solely because its region is crowded.';

revoke execute on function public.enforce_community_garden_plant_insert_v1()
  from public, anon, authenticated;
grant execute on function public.enforce_community_garden_plant_insert_v1()
  to service_role;
