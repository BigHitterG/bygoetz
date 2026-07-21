alter table public.garden_pending_purchases
  add column if not exists garden_saved_at timestamptz,
  add column if not exists handoff_issued_at timestamptz;

comment on column public.garden_pending_purchases.garden_saved_at is
  'Set only after the paid entitlement and guest My Garden preview are transactionally persisted.';

comment on column public.garden_pending_purchases.handoff_issued_at is
  'Most recent one-time same-browser session handoff issued after the purchased email was verified.';

create or replace function public.get_basil_account_status_by_email(
  p_email text
)
returns table (
  user_id uuid,
  email_confirmed boolean,
  has_membership boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    users.id,
    users.email_confirmed_at is not null,
    exists (
      select 1
      from public.garden_stewards stewards
      join public.garden_entitlements entitlements
        on entitlements.steward_id = stewards.id
      where stewards.user_id = users.id
        and entitlements.product_key = 'basil_founding_gardener'
        and entitlements.status = 'active'
    )
  from auth.users users
  where lower(users.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_basil_account_status_by_email(text)
  from public, anon, authenticated;
grant execute on function public.get_basil_account_status_by_email(text)
  to service_role;

create or replace function public.import_my_garden_preview(
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
  preview_item jsonb;
  desired_x integer;
  desired_y integer;
  destination_x integer;
  destination_y integer;
  candidate_type text;
  expansion_count integer;
  right_expansions integer;
  down_expansions integer;
  left_expansions integer;
  up_expansions integer;
  garden_min_x integer;
  garden_min_y integer;
  garden_max_x integer;
  garden_max_y integer;
begin
  if not exists (
    select 1 from public.garden_entitlements
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

  select * into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  if progress.preview_imported_at is not null then
    return false;
  end if;

  expansion_count := greatest(0, progress.plot_level - 1);
  right_expansions := floor((expansion_count + 3)::numeric / 4)::integer;
  down_expansions := floor((expansion_count + 2)::numeric / 4)::integer;
  left_expansions := floor((expansion_count + 1)::numeric / 4)::integer;
  up_expansions := floor(expansion_count::numeric / 4)::integer;
  garden_min_x := -left_expansions * 4;
  garden_min_y := -up_expansions * 4;
  garden_max_x := 11 + right_expansions * 4;
  garden_max_y := 15 + down_expansions * 4;

  for preview_item in
    select item
    from jsonb_array_elements(coalesce(p_plants, '[]'::jsonb))
      with ordinality as preview(item, ordinal)
    limit 10
  loop
    if (preview_item ->> 'gridX') !~ '^[0-9]+$'
       or (preview_item ->> 'gridY') !~ '^[0-9]+$'
       or (preview_item ->> 'gridX')::integer not between 0 and 11
       or (preview_item ->> 'gridY')::integer not between 0 and 15
       or preview_item ->> 'plantType' not in ('rose', 'sunflower', 'lavender') then
      continue;
    end if;

    desired_x := (preview_item ->> 'gridX')::integer;
    desired_y := (preview_item ->> 'gridY')::integer;
    candidate_type := preview_item ->> 'plantType';

    select available.grid_x, available.grid_y
      into destination_x, destination_y
    from (
      select x as grid_x, y as grid_y
      from generate_series(garden_min_x, garden_max_x) as x
      cross join generate_series(garden_min_y, garden_max_y) as y
    ) as available
    where not exists (
      select 1 from public.garden_personal_plants plants
      where plants.steward_id = p_steward_id
        and plants.grid_x = available.grid_x
        and plants.grid_y = available.grid_y
    )
      and not exists (
        select 1 from public.garden_personal_paths paths
        where paths.steward_id = p_steward_id
          and paths.grid_x = available.grid_x
          and paths.grid_y = available.grid_y
      )
      and not exists (
        select 1 from public.garden_personal_elements elements
        where elements.steward_id = p_steward_id
          and elements.grid_x = available.grid_x
          and elements.grid_y = available.grid_y
      )
    order by
      case when available.grid_x = desired_x and available.grid_y = desired_y then 0 else 1 end,
      abs(available.grid_x - desired_x) + abs(available.grid_y - desired_y),
      available.grid_y,
      available.grid_x
    limit 1;

    if found then
      insert into public.garden_personal_plants (
        steward_id, grid_x, grid_y, plant_type
      ) values (
        p_steward_id, destination_x, destination_y, candidate_type
      );
    end if;
  end loop;

  for preview_item in
    select item
    from jsonb_array_elements(coalesce(p_paths, '[]'::jsonb))
      with ordinality as preview(item, ordinal)
    limit 64
  loop
    if (preview_item ->> 'gridX') !~ '^[0-9]+$'
       or (preview_item ->> 'gridY') !~ '^[0-9]+$'
       or (preview_item ->> 'gridX')::integer not between 0 and 11
       or (preview_item ->> 'gridY')::integer not between 0 and 15 then
      continue;
    end if;

    desired_x := (preview_item ->> 'gridX')::integer;
    desired_y := (preview_item ->> 'gridY')::integer;

    if exists (
      select 1 from public.garden_personal_paths paths
      where paths.steward_id = p_steward_id
        and paths.grid_x = desired_x
        and paths.grid_y = desired_y
    ) then
      continue;
    end if;

    select available.grid_x, available.grid_y
      into destination_x, destination_y
    from (
      select x as grid_x, y as grid_y
      from generate_series(garden_min_x, garden_max_x) as x
      cross join generate_series(garden_min_y, garden_max_y) as y
    ) as available
    where not exists (
      select 1 from public.garden_personal_plants plants
      where plants.steward_id = p_steward_id
        and plants.grid_x = available.grid_x
        and plants.grid_y = available.grid_y
    )
      and not exists (
        select 1 from public.garden_personal_paths paths
        where paths.steward_id = p_steward_id
          and paths.grid_x = available.grid_x
          and paths.grid_y = available.grid_y
      )
      and not exists (
        select 1 from public.garden_personal_elements elements
        where elements.steward_id = p_steward_id
          and elements.grid_x = available.grid_x
          and elements.grid_y = available.grid_y
      )
    order by
      case when available.grid_x = desired_x and available.grid_y = desired_y then 0 else 1 end,
      abs(available.grid_x - desired_x) + abs(available.grid_y - desired_y),
      available.grid_y,
      available.grid_x
    limit 1;

    if found then
      insert into public.garden_personal_paths (steward_id, grid_x, grid_y)
      values (p_steward_id, destination_x, destination_y);
    end if;
  end loop;

  imported_care := greatest(0, least(coalesce(p_care_balance, 0), 20));

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

revoke execute on function public.import_my_garden_preview(uuid, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_my_garden_preview(uuid, integer, jsonb, jsonb)
  to service_role;

create or replace function public.finalize_basil_pending_purchase(
  p_pending_id uuid,
  p_user_id uuid,
  p_garden_name text,
  p_provider_purchase_id text,
  p_provider_customer_id text,
  p_provider_payment_id text,
  p_amount_paid_cents integer,
  p_currency text,
  p_purchased_at timestamptz
)
returns table (
  steward_id uuid,
  preview_imported boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending public.garden_pending_purchases%rowtype;
  steward public.garden_stewards%rowtype;
  imported boolean;
begin
  select * into pending
  from public.garden_pending_purchases
  where id = p_pending_id
  for update;

  if pending.id is null
     or pending.claimed_user_id is distinct from p_user_id
     or pending.stripe_session_id is distinct from p_provider_purchase_id
     or pending.paid_at is null then
    raise exception 'The paid Basil checkout could not be matched to its account.'
      using errcode = '42501';
  end if;

  insert into public.garden_stewards (user_id, garden_name, updated_at)
  values (p_user_id, p_garden_name, now())
  on conflict (user_id) do update
    set updated_at = excluded.updated_at
  returning * into steward;

  insert into public.garden_entitlements (
    steward_id,
    product_key,
    provider,
    provider_purchase_id,
    provider_customer_id,
    provider_payment_id,
    amount_paid_cents,
    currency,
    status,
    purchased_at,
    updated_at
  ) values (
    steward.id,
    'basil_founding_gardener',
    'stripe',
    p_provider_purchase_id,
    p_provider_customer_id,
    p_provider_payment_id,
    p_amount_paid_cents,
    p_currency,
    'active',
    p_purchased_at,
    now()
  )
  on conflict (provider, provider_purchase_id) do update
    set
      status = 'active',
      updated_at = excluded.updated_at;

  select public.import_my_garden_preview(
    steward.id,
    (pending.preview ->> 'careBalance')::integer,
    pending.preview -> 'plants',
    pending.preview -> 'paths'
  ) into imported;

  update public.garden_pending_purchases
  set
    status = 'paid',
    garden_saved_at = coalesce(garden_saved_at, now()),
    last_error = null,
    updated_at = now()
  where id = pending.id;

  return query select steward.id, imported;
end;
$$;

revoke all on function public.finalize_basil_pending_purchase(
  uuid, uuid, text, text, text, text, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.finalize_basil_pending_purchase(
  uuid, uuid, text, text, text, text, integer, text, timestamptz
) to service_role;
