alter table public.community_garden_roses
  add column if not exists plant_type text not null default 'rose';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_garden_roses_plant_type_check'
      and conrelid = 'public.community_garden_roses'::regclass
  ) then
    alter table public.community_garden_roses
      add constraint community_garden_roses_plant_type_check
      check (plant_type in ('rose', 'sunflower', 'lavender'));
  end if;
end;
$$;

create index if not exists community_garden_roses_plant_type_idx
  on public.community_garden_roses (plant_type);

create or replace function public.plant_community_garden_plant(
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text
)
returns setof public.community_garden_roses
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_plant public.community_garden_roses%rowtype;
begin
  if p_grid_x is null or p_grid_y is null then
    raise exception 'A garden coordinate is required.' using errcode = '22023';
  end if;

  if p_grid_x not between -2048 and 2047 or p_grid_y not between -2048 and 2047 then
    raise exception 'That coordinate is outside the garden.' using errcode = '22023';
  end if;

  if p_plant_type is null or p_plant_type not in ('rose', 'sunflower', 'lavender') then
    raise exception 'That plant is not available in the garden.' using errcode = '22023';
  end if;

  delete from public.community_garden_roses
  where grid_x = p_grid_x
    and grid_y = p_grid_y
    and last_watered_at <= now() - case plant_type
      when 'sunflower' then interval '66 hours'
      when 'lavender' then interval '168 hours'
      else interval '102 hours'
    end;

  insert into public.community_garden_roses (grid_x, grid_y, plant_type)
  values (p_grid_x, p_grid_y, p_plant_type)
  on conflict (grid_x, grid_y) do nothing
  returning * into inserted_plant;

  if inserted_plant.id is null then
    raise exception 'That garden spot is already occupied.' using errcode = '23505';
  end if;

  return next inserted_plant;
end;
$$;

create or replace function public.water_community_garden_plant(
  p_plant_id uuid
)
returns setof public.community_garden_roses
language plpgsql
security definer
set search_path = ''
as $$
declare
  watered_plant public.community_garden_roses%rowtype;
begin
  if p_plant_id is null then
    raise exception 'A plant id is required.' using errcode = '22023';
  end if;

  update public.community_garden_roses
  set last_watered_at = now()
  where id = p_plant_id
    and last_watered_at > now() - case plant_type
      when 'sunflower' then interval '58 hours'
      when 'lavender' then interval '156 hours'
      else interval '96 hours'
    end
  returning * into watered_plant;

  if watered_plant.id is null then
    raise exception 'That plant has already returned to the soil.' using errcode = 'P0002';
  end if;

  return next watered_plant;
end;
$$;

create or replace function public.cleanup_community_garden_plants(
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
      and last_watered_at <= now() - case plant_type
        when 'sunflower' then interval '66 hours'
        when 'lavender' then interval '168 hours'
        else interval '102 hours'
      end
    order by last_watered_at
    limit 128
    for update skip locked
  ), deleted as (
    delete from public.community_garden_roses plants
    using expired
    where plants.id = expired.id
    returning plants.id
  )
  select count(*)::integer into deleted_count from deleted;

  return deleted_count;
end;
$$;

create or replace function public.plant_community_garden_rose(
  p_grid_x integer,
  p_grid_y integer
)
returns setof public.community_garden_roses
language sql
security definer
set search_path = ''
as $$
  select * from public.plant_community_garden_plant(p_grid_x, p_grid_y, 'rose');
$$;

create or replace function public.water_community_garden_rose(
  p_rose_id uuid
)
returns setof public.community_garden_roses
language sql
security definer
set search_path = ''
as $$
  select * from public.water_community_garden_plant(p_rose_id);
$$;

create or replace function public.cleanup_community_garden_roses(
  p_min_x integer,
  p_max_x integer,
  p_min_y integer,
  p_max_y integer
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.cleanup_community_garden_plants(p_min_x, p_max_x, p_min_y, p_max_y);
$$;

revoke execute on function public.plant_community_garden_plant(integer, integer, text)
  from public, authenticated;
revoke execute on function public.water_community_garden_plant(uuid)
  from public, authenticated;
revoke execute on function public.cleanup_community_garden_plants(integer, integer, integer, integer)
  from public, authenticated;

grant execute on function public.plant_community_garden_plant(integer, integer, text)
  to anon;
grant execute on function public.water_community_garden_plant(uuid)
  to anon;
grant execute on function public.cleanup_community_garden_plants(integer, integer, integer, integer)
  to anon;

comment on table public.community_garden_roses is
  'Anonymous shared plants for the By Goetz Community Garden. Existing roses remain roses; no visitor identity or ownership is stored.';

