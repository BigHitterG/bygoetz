alter table public.garden_member_progress
  add column if not exists preview_imported_at timestamptz;

comment on column public.garden_member_progress.preview_imported_at is
  'Marks the one-time post-purchase handoff of temporary guest Care, plants, and paths.';

create function public.import_my_garden_preview(
  p_steward_id uuid,
  p_care_balance integer,
  p_plants jsonb,
  p_paths jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  imported_care integer;
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

  if jsonb_typeof(coalesce(p_plants, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_paths, '[]'::jsonb)) <> 'array' then
    raise exception 'The garden preview is not valid.' using errcode = '22023';
  end if;

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id)
  on conflict (steward_id) do nothing;

  select *
  into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  if progress.preview_imported_at is not null then
    return false;
  end if;

  imported_care := greatest(0, least(coalesce(p_care_balance, 0), 20));

  insert into public.garden_personal_plants (
    steward_id,
    grid_x,
    grid_y,
    plant_type
  )
  select
    p_steward_id,
    candidate.grid_x,
    candidate.grid_y,
    candidate.plant_type
  from (
    select distinct on (grid_x, grid_y)
      (item ->> 'gridX')::integer as grid_x,
      (item ->> 'gridY')::integer as grid_y,
      item ->> 'plantType' as plant_type,
      ordinal
    from jsonb_array_elements(coalesce(p_plants, '[]'::jsonb))
      with ordinality as plant(item, ordinal)
    where (item ->> 'gridX') ~ '^[0-9]+$'
      and (item ->> 'gridY') ~ '^[0-9]+$'
      and (item ->> 'gridX')::integer between 0 and 11
      and (item ->> 'gridY')::integer between 0 and 15
      and item ->> 'plantType' in ('rose', 'sunflower', 'lavender')
    order by grid_x, grid_y, ordinal
  ) as candidate
  order by candidate.ordinal
  limit 3
  on conflict (steward_id, grid_x, grid_y) do nothing;

  insert into public.garden_personal_paths (
    steward_id,
    grid_x,
    grid_y
  )
  select
    p_steward_id,
    candidate.grid_x,
    candidate.grid_y
  from (
    select distinct on (grid_x, grid_y)
      (item ->> 'gridX')::integer as grid_x,
      (item ->> 'gridY')::integer as grid_y,
      ordinal
    from jsonb_array_elements(coalesce(p_paths, '[]'::jsonb))
      with ordinality as path(item, ordinal)
    where (item ->> 'gridX') ~ '^[0-9]+$'
      and (item ->> 'gridY') ~ '^[0-9]+$'
      and (item ->> 'gridX')::integer between 0 and 11
      and (item ->> 'gridY')::integer between 0 and 15
    order by grid_x, grid_y, ordinal
  ) as candidate
  order by candidate.ordinal
  limit 64
  on conflict (steward_id, grid_x, grid_y) do nothing;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + imported_care,
    lifetime_care = garden_member_progress.lifetime_care + imported_care,
    preview_imported_at = now(),
    updated_at = now()
  where steward_id = p_steward_id;

  return true;
end;
$$;

revoke execute on function public.import_my_garden_preview(
  uuid,
  integer,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.import_my_garden_preview(
  uuid,
  integer,
  jsonb,
  jsonb
) to service_role;
