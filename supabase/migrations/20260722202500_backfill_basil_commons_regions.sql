insert into public.community_garden_regions (
  region_x,
  region_y,
  plant_count,
  active_contributors,
  pressure_state,
  stress_started_at,
  version,
  updated_at
)
select
  region_x,
  region_y,
  count(*)::integer,
  count(distinct contributor_key)::integer,
  case
    when count(*) >= 180 then 'resting'
    when count(*) >= 140 then 'busy'
    else 'healthy'
  end,
  case when count(*) >= 160 then statement_timestamp() else null end,
  floor(extract(epoch from statement_timestamp()) / 600)::bigint,
  statement_timestamp()
from public.community_garden_roses
where grid_x between -96 and 63
  and grid_y between -96 and 63
group by region_x, region_y
on conflict (region_x, region_y) do update set
  plant_count = excluded.plant_count,
  active_contributors = excluded.active_contributors,
  pressure_state = excluded.pressure_state,
  stress_started_at = excluded.stress_started_at,
  version = excluded.version,
  updated_at = excluded.updated_at;
