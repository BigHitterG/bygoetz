alter function public.perform_community_garden_watering_cluster(uuid[])
  rename to perform_community_garden_watering_cluster_unchecked;

revoke execute on function public.perform_community_garden_watering_cluster_unchecked(uuid[])
  from public, anon, authenticated, service_role;

create function public.perform_community_garden_watering_cluster(
  p_plant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_ids uuid[];
  connected_count integer;
begin
  select array_agg(candidate.id order by candidate.id)
  into normalized_ids
  from (
    select distinct requested.id
    from unnest(coalesce(p_plant_ids, array[]::uuid[])) as requested(id)
    where requested.id is not null
  ) as candidate;

  if coalesce(cardinality(normalized_ids), 0) < 1
     or cardinality(normalized_ids) > 4 then
    raise exception 'Choose between one and four plants to water.' using errcode = '22023';
  end if;

  with recursive candidates as (
    select id, grid_x, grid_y
    from public.community_garden_roses
    where id = any(normalized_ids)
  ), connected as (
    select id, grid_x, grid_y
    from candidates
    where id = normalized_ids[1]

    union

    select candidate.id, candidate.grid_x, candidate.grid_y
    from candidates as candidate
    join connected as reached
      on candidate.id <> reached.id
     and abs(candidate.grid_x - reached.grid_x) <= 1
     and abs(candidate.grid_y - reached.grid_y) <= 1
  )
  select count(distinct id)::integer
  into connected_count
  from connected;

  if connected_count <> cardinality(normalized_ids) then
    raise exception 'Choose a connected group of nearby flowers.' using errcode = '22023';
  end if;

  return public.perform_community_garden_watering_cluster_unchecked(normalized_ids);
end;
$$;

revoke execute on function public.perform_community_garden_watering_cluster(uuid[])
  from public, anon, authenticated;
grant execute on function public.perform_community_garden_watering_cluster(uuid[])
  to service_role;
