create table if not exists public.garden_personal_paths (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  grid_x integer not null check (grid_x between 0 and 19),
  grid_y integer not null check (grid_y between 0 and 23),
  created_at timestamptz not null default now(),
  constraint garden_personal_paths_unique unique (steward_id, grid_x, grid_y)
);

create index if not exists garden_personal_paths_steward_idx
  on public.garden_personal_paths (steward_id, grid_y, grid_x);

alter table public.garden_personal_paths enable row level security;
revoke all on table public.garden_personal_paths from public, anon, authenticated;
grant select, insert, delete on table public.garden_personal_paths to service_role;

comment on table public.garden_personal_paths is
  'Free, persistent path tiles placed inside a paid member''s current My Garden fence.';

create or replace function public.toggle_my_garden_path(
  p_steward_id uuid,
  p_grid_x integer,
  p_grid_y integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  plot_width integer;
  plot_height integer;
  removed_count integer;
begin
  if not exists (
    select 1
    from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener'
      and status = 'active'
  ) then
    raise exception 'An active Garden Membership is required.' using errcode = '42501';
  end if;

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id)
  on conflict (steward_id) do nothing;

  select *
  into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  plot_width := case
    progress.plot_level
    when 1 then 12
    when 2 then 16
    when 3 then 16
    else 20
  end;
  plot_height := case
    progress.plot_level
    when 1 then 16
    when 2 then 16
    when 3 then 20
    when 4 then 20
    else 24
  end;

  if p_grid_x is null or p_grid_y is null
     or p_grid_x < 0 or p_grid_x >= plot_width
     or p_grid_y < 0 or p_grid_y >= plot_height then
    raise exception 'That spot is outside your current fenced garden.' using errcode = '22023';
  end if;

  delete from public.garden_personal_paths
  where steward_id = p_steward_id
    and grid_x = p_grid_x
    and grid_y = p_grid_y;

  get diagnostics removed_count = row_count;
  if removed_count > 0 then
    return false;
  end if;

  insert into public.garden_personal_paths (steward_id, grid_x, grid_y)
  values (p_steward_id, p_grid_x, p_grid_y);
  return true;
end;
$$;

revoke execute on function public.toggle_my_garden_path(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.toggle_my_garden_path(uuid, integer, integer)
  to service_role;
