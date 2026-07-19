alter table public.garden_care_ledger
  add column if not exists earning_phase text not null default 'quick';

update public.garden_care_ledger
set earning_phase = 'steady'
where care_delta = 0;

alter table public.garden_care_ledger
  drop constraint if exists garden_care_ledger_earning_phase_check;

alter table public.garden_care_ledger
  add constraint garden_care_ledger_earning_phase_check
  check (earning_phase in ('quick', 'steady'));

comment on table public.garden_care_ledger is
  'Private Care awards for paid members. The first 20 daily Care is quick; every four eligible actions after that awards one steady Care.';

drop function if exists public.claim_garden_care(uuid, uuid);

create function public.claim_garden_care(
  p_steward_id uuid,
  p_receipt_token uuid
)
returns table (
  awarded_care integer,
  care_balance integer,
  lifetime_care integer,
  earning_phase text,
  steady_progress integer,
  steady_actions_required integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.garden_care_receipts%rowtype;
  quick_care_today integer;
  steady_actions_today integer;
  award integer;
  phase text;
  progress integer;
  next_balance integer;
  next_lifetime integer;
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

  perform 1
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  select *
  into receipt
  from public.garden_care_receipts
  where token = p_receipt_token
    and claimed_at is null
    and expires_at > now()
  for update;

  if receipt.token is null then
    raise exception 'That Care receipt has expired or was already claimed.' using errcode = 'P0002';
  end if;

  select coalesce(sum(care_delta), 0)::integer
  into quick_care_today
  from public.garden_care_ledger as ledger
  where ledger.steward_id = p_steward_id
    and ledger.created_at >= date_trunc('day', now())
    and ledger.earning_phase = 'quick';

  if quick_care_today < 20 then
    phase := 'quick';
    progress := 0;
    award := greatest(
      0,
      least(receipt.care_value::integer, 20 - quick_care_today)
    );
  else
    phase := 'steady';

    select count(*)::integer
    into steady_actions_today
    from public.garden_care_ledger as ledger
    where ledger.steward_id = p_steward_id
      and ledger.created_at >= date_trunc('day', now())
      and ledger.earning_phase = 'steady';

    progress := (steady_actions_today + 1) % 4;
    award := case when progress = 0 then 1 else 0 end;
  end if;

  update public.garden_care_receipts
  set
    claimed_by_steward_id = p_steward_id,
    claimed_at = now()
  where token = receipt.token;

  insert into public.garden_care_ledger (
    steward_id,
    receipt_token,
    action_type,
    care_delta,
    earning_phase
  )
  values (
    p_steward_id,
    receipt.token,
    receipt.action_type,
    award,
    phase
  );

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + award,
    lifetime_care = garden_member_progress.lifetime_care + award,
    updated_at = now()
  where steward_id = p_steward_id
  returning
    garden_member_progress.care_balance,
    garden_member_progress.lifetime_care
  into next_balance, next_lifetime;

  return query
  select award, next_balance, next_lifetime, phase, progress, 4;
end;
$$;

revoke execute on function public.claim_garden_care(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_garden_care(uuid, uuid)
  to service_role;

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_x_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_x_check
  check (grid_x between 0 and 19);

alter table public.garden_personal_plants
  drop constraint if exists garden_personal_plants_grid_y_check;

alter table public.garden_personal_plants
  add constraint garden_personal_plants_grid_y_check
  check (grid_y between 0 and 23);

create or replace function public.plant_my_garden(
  p_steward_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  planted public.garden_personal_plants%rowtype;
  plot_width integer;
  plot_height integer;
  plant_cost integer := 2;
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

  if p_plant_type is null or p_plant_type not in ('rose', 'sunflower', 'lavender') then
    raise exception 'That plant is not available in My Garden.' using errcode = '22023';
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

  if progress.care_balance < plant_cost then
    raise exception 'Earn more Care in the Community Garden before planting here.' using errcode = '22000';
  end if;

  insert into public.garden_personal_plants (
    steward_id,
    grid_x,
    grid_y,
    plant_type
  )
  values (
    p_steward_id,
    p_grid_x,
    p_grid_y,
    p_plant_type
  )
  returning * into planted;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - plant_cost,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'plant', to_jsonb(planted),
    'careBalance', progress.care_balance - plant_cost
  );
exception
  when unique_violation then
    raise exception 'That garden spot is already planted.' using errcode = '23505';
end;
$$;

create or replace function public.expand_my_garden(
  p_steward_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  expansion_cost integer;
  next_level integer;
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

  if progress.plot_level >= 5 then
    raise exception 'Your current My Garden property is fully expanded.' using errcode = '22000';
  end if;

  expansion_cost := case
    progress.plot_level
    when 1 then 30
    when 2 then 50
    when 3 then 75
    else 100
  end;
  next_level := progress.plot_level + 1;

  if progress.care_balance < expansion_cost then
    raise exception 'Earn more Care in the Community Garden before expanding.' using errcode = '22000';
  end if;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - expansion_cost,
    plot_level = next_level,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'careBalance', progress.care_balance - expansion_cost,
    'plotLevel', next_level,
    'width', case
      next_level
      when 2 then 16
      when 3 then 16
      else 20
    end,
    'height', case
      next_level
      when 2 then 16
      when 3 then 20
      when 4 then 20
      else 24
    end
  );
end;
$$;

revoke execute on function public.plant_my_garden(uuid, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.expand_my_garden(uuid)
  from public, anon, authenticated;
grant execute on function public.plant_my_garden(uuid, integer, integer, text)
  to service_role;
grant execute on function public.expand_my_garden(uuid)
  to service_role;

comment on table public.garden_personal_plants is
  'Persistent, private plants placed anywhere inside a paid member''s fenced My Garden property. Personal plants do not expire.';
