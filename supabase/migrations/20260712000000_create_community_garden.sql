create table if not exists public.community_garden_roses (
  id uuid primary key default gen_random_uuid(),
  grid_x integer not null,
  grid_y integer not null,
  planted_at timestamptz not null default now(),
  last_watered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint community_garden_roses_grid_x_bounds check (grid_x between -2048 and 2047),
  constraint community_garden_roses_grid_y_bounds check (grid_y between -2048 and 2047),
  constraint community_garden_roses_unique_coordinate unique (grid_x, grid_y)
);

create index if not exists community_garden_roses_grid_range_idx
  on public.community_garden_roses (grid_x, grid_y);

create index if not exists community_garden_roses_last_watered_idx
  on public.community_garden_roses (last_watered_at);

alter table public.community_garden_roses enable row level security;

revoke all on table public.community_garden_roses from anon, authenticated;
grant select on table public.community_garden_roses to anon, authenticated, service_role;

drop policy if exists "Community garden roses are publicly readable"
  on public.community_garden_roses;

create policy "Community garden roses are publicly readable"
  on public.community_garden_roses
  for select
  to anon, authenticated
  using (true);

create or replace function public.plant_community_garden_rose(
  p_grid_x integer,
  p_grid_y integer
)
returns setof public.community_garden_roses
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rose public.community_garden_roses%rowtype;
begin
  if p_grid_x is null or p_grid_y is null then
    raise exception 'A garden coordinate is required.' using errcode = '22023';
  end if;

  if p_grid_x not between -2048 and 2047 or p_grid_y not between -2048 and 2047 then
    raise exception 'That coordinate is outside the garden.' using errcode = '22023';
  end if;

  delete from public.community_garden_roses
  where grid_x = p_grid_x
    and grid_y = p_grid_y
    and last_watered_at <= now() - interval '102 hours';

  insert into public.community_garden_roses (grid_x, grid_y)
  values (p_grid_x, p_grid_y)
  on conflict (grid_x, grid_y) do nothing
  returning * into inserted_rose;

  if inserted_rose.id is null then
    raise exception 'That garden spot is already occupied.' using errcode = '23505';
  end if;

  return next inserted_rose;
end;
$$;

create or replace function public.water_community_garden_rose(
  p_rose_id uuid
)
returns setof public.community_garden_roses
language plpgsql
security definer
set search_path = ''
as $$
declare
  watered_rose public.community_garden_roses%rowtype;
begin
  if p_rose_id is null then
    raise exception 'A rose id is required.' using errcode = '22023';
  end if;

  update public.community_garden_roses
  set last_watered_at = now()
  where id = p_rose_id
    and last_watered_at > now() - interval '96 hours'
  returning * into watered_rose;

  if watered_rose.id is null then
    raise exception 'That rose has already returned to the soil.' using errcode = 'P0002';
  end if;

  return next watered_rose;
end;
$$;

create or replace function public.cleanup_community_garden_roses(
  p_min_x integer,
  p_max_x integer,
  p_min_y integer,
  p_max_y integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_min_x is null or p_max_x is null or p_min_y is null or p_max_y is null then
    raise exception 'Chunk bounds are required.' using errcode = '22023';
  end if;

  if p_min_x > p_max_x or p_min_y > p_max_y
     or p_max_x - p_min_x > 64 or p_max_y - p_min_y > 64
     or p_min_x < -2048 or p_max_x > 2047
     or p_min_y < -2048 or p_max_y > 2047 then
    raise exception 'Invalid cleanup bounds.' using errcode = '22023';
  end if;

  with expired as (
    select id
    from public.community_garden_roses
    where grid_x between p_min_x and p_max_x
      and grid_y between p_min_y and p_max_y
      and last_watered_at <= now() - interval '102 hours'
    order by last_watered_at
    limit 128
    for update skip locked
  ), deleted as (
    delete from public.community_garden_roses roses
    using expired
    where roses.id = expired.id
    returning roses.id
  )
  select count(*)::integer into deleted_count from deleted;

  return deleted_count;
end;
$$;

revoke execute on function public.plant_community_garden_rose(integer, integer)
  from public, authenticated;
revoke execute on function public.water_community_garden_rose(uuid)
  from public, authenticated;
revoke execute on function public.cleanup_community_garden_roses(integer, integer, integer, integer)
  from public, authenticated;

grant execute on function public.plant_community_garden_rose(integer, integer)
  to anon;
grant execute on function public.water_community_garden_rose(uuid)
  to anon;
grant execute on function public.cleanup_community_garden_roses(integer, integer, integer, integer)
  to anon;

comment on table public.community_garden_roses is
  'Anonymous shared roses for the By Goetz Community Garden. No visitor identity or ownership is stored.';

