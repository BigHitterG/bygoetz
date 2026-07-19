create table if not exists public.garden_member_progress (
  steward_id uuid primary key references public.garden_stewards(id) on delete cascade,
  care_balance integer not null default 8,
  lifetime_care integer not null default 0,
  plot_level smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_member_progress_care_balance_check check (care_balance >= 0),
  constraint garden_member_progress_lifetime_care_check check (lifetime_care >= 0),
  constraint garden_member_progress_plot_level_check check (plot_level between 1 and 3)
);

alter table public.garden_member_progress enable row level security;
revoke all on table public.garden_member_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_member_progress to service_role;

comment on table public.garden_member_progress is
  'Private Community Garden Membership progression. Care is earned in the anonymous shared garden and spent only in My Garden.';

create table if not exists public.garden_personal_plants (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  grid_x smallint not null,
  grid_y smallint not null,
  plant_type text not null,
  planted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_personal_plants_position_unique unique (steward_id, grid_x, grid_y),
  constraint garden_personal_plants_grid_x_check check (grid_x between 0 and 7),
  constraint garden_personal_plants_grid_y_check check (grid_y between 0 and 6),
  constraint garden_personal_plants_type_check check (
    plant_type in ('rose', 'sunflower', 'lavender')
  )
);

create index if not exists garden_personal_plants_steward_created_idx
  on public.garden_personal_plants (steward_id, created_at);

alter table public.garden_personal_plants enable row level security;
revoke all on table public.garden_personal_plants from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_personal_plants to service_role;

comment on table public.garden_personal_plants is
  'Persistent, private plants placed in a paid member''s My Garden plot. Personal plants do not expire.';

create table if not exists public.garden_personal_upgrades (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  upgrade_type text not null,
  care_cost smallint not null,
  purchased_at timestamptz not null default now(),
  constraint garden_personal_upgrades_unique unique (steward_id, upgrade_type),
  constraint garden_personal_upgrades_type_check check (
    upgrade_type in ('birdhouse', 'bench', 'stone_path', 'sage_shed')
  ),
  constraint garden_personal_upgrades_cost_check check (care_cost between 1 and 100)
);

create index if not exists garden_personal_upgrades_steward_idx
  on public.garden_personal_upgrades (steward_id, purchased_at);

alter table public.garden_personal_upgrades enable row level security;
revoke all on table public.garden_personal_upgrades from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_personal_upgrades to service_role;

comment on table public.garden_personal_upgrades is
  'Persistent, private My Garden customizations purchased with Care earned only through Community Garden actions.';

create table if not exists public.garden_care_receipts (
  token uuid primary key default gen_random_uuid(),
  action_type text not null,
  community_plant_id uuid not null,
  care_value smallint not null,
  claimed_by_steward_id uuid references public.garden_stewards(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  constraint garden_care_receipts_action_check check (
    action_type in ('plant', 'water')
  ),
  constraint garden_care_receipts_value_check check (care_value between 1 and 5),
  constraint garden_care_receipts_claim_check check (
    (claimed_at is null and claimed_by_steward_id is null)
    or (claimed_at is not null and claimed_by_steward_id is not null)
  )
);

create index if not exists garden_care_receipts_unclaimed_expiry_idx
  on public.garden_care_receipts (expires_at)
  where claimed_at is null;

alter table public.garden_care_receipts enable row level security;
revoke all on table public.garden_care_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_care_receipts to service_role;

comment on table public.garden_care_receipts is
  'Short-lived one-use proofs that a Community Garden action occurred. Tokens do not identify the public plant actor.';

create table if not exists public.garden_care_ledger (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  receipt_token uuid not null unique references public.garden_care_receipts(token) on delete restrict,
  action_type text not null,
  care_delta smallint not null,
  created_at timestamptz not null default now(),
  constraint garden_care_ledger_action_check check (
    action_type in ('plant', 'water')
  ),
  constraint garden_care_ledger_delta_check check (care_delta between 0 and 5)
);

create index if not exists garden_care_ledger_steward_created_idx
  on public.garden_care_ledger (steward_id, created_at desc);

alter table public.garden_care_ledger enable row level security;
revoke all on table public.garden_care_ledger from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_care_ledger to service_role;

comment on table public.garden_care_ledger is
  'Private Care awards for paid members. The 20-Care daily earning cap is enforced transactionally.';

create or replace function public.perform_community_garden_planting(
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text
)
returns table (
  plant_id uuid,
  grid_x integer,
  grid_y integer,
  plant_type text,
  planted_at timestamptz,
  last_watered_at timestamptz,
  created_at timestamptz,
  receipt_token uuid,
  care_value integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  planted public.community_garden_roses%rowtype;
  new_receipt uuid;
begin
  select *
  into planted
  from public.plant_community_garden_plant(p_grid_x, p_grid_y, p_plant_type);

  insert into public.garden_care_receipts (
    action_type,
    community_plant_id,
    care_value
  )
  values ('plant', planted.id, 2)
  returning token into new_receipt;

  return query
  select
    planted.id,
    planted.grid_x,
    planted.grid_y,
    planted.plant_type,
    planted.planted_at,
    planted.last_watered_at,
    planted.created_at,
    new_receipt,
    2;
end;
$$;

create or replace function public.perform_community_garden_watering(
  p_plant_id uuid
)
returns table (
  plant_id uuid,
  grid_x integer,
  grid_y integer,
  plant_type text,
  planted_at timestamptz,
  last_watered_at timestamptz,
  created_at timestamptz,
  receipt_token uuid,
  care_value integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_watering public.community_garden_roses%rowtype;
  watered public.community_garden_roses%rowtype;
  new_receipt uuid;
  earned integer := 0;
begin
  if p_plant_id is null then
    raise exception 'A plant id is required.' using errcode = '22023';
  end if;

  select *
  into before_watering
  from public.community_garden_roses
  where id = p_plant_id
  for update;

  if before_watering.id is null then
    raise exception 'That plant is no longer here.' using errcode = 'P0002';
  end if;

  select *
  into watered
  from public.water_community_garden_plant(p_plant_id);

  if before_watering.last_watered_at <= now() - interval '4 hours' then
    insert into public.garden_care_receipts (
      action_type,
      community_plant_id,
      care_value
    )
    values ('water', watered.id, 1)
    returning token into new_receipt;
    earned := 1;
  end if;

  return query
  select
    watered.id,
    watered.grid_x,
    watered.grid_y,
    watered.plant_type,
    watered.planted_at,
    watered.last_watered_at,
    watered.created_at,
    new_receipt,
    earned;
end;
$$;

create or replace function public.claim_garden_care(
  p_steward_id uuid,
  p_receipt_token uuid
)
returns table (
  awarded_care integer,
  care_balance integer,
  lifetime_care integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt public.garden_care_receipts%rowtype;
  earned_today integer;
  award integer;
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
  into earned_today
  from public.garden_care_ledger
  where steward_id = p_steward_id
    and created_at >= date_trunc('day', now());

  award := greatest(0, least(receipt.care_value::integer, 20 - earned_today));

  update public.garden_care_receipts
  set
    claimed_by_steward_id = p_steward_id,
    claimed_at = now()
  where token = receipt.token;

  insert into public.garden_care_ledger (
    steward_id,
    receipt_token,
    action_type,
    care_delta
  )
  values (
    p_steward_id,
    receipt.token,
    receipt.action_type,
    award
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

  return query select award, next_balance, next_lifetime;
end;
$$;

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

  plot_width := case progress.plot_level when 1 then 6 when 2 then 7 else 8 end;
  plot_height := case progress.plot_level when 1 then 5 when 2 then 6 else 7 end;

  if p_grid_x is null or p_grid_y is null
     or p_grid_x < 0 or p_grid_x >= plot_width
     or p_grid_y < 0 or p_grid_y >= plot_height then
    raise exception 'That bed is outside your current garden plot.' using errcode = '22023';
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
    raise exception 'That garden bed is already planted.' using errcode = '23505';
end;
$$;

create or replace function public.uproot_my_garden(
  p_steward_id uuid,
  p_plant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uprooted public.garden_personal_plants%rowtype;
  next_balance integer;
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

  perform 1
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  delete from public.garden_personal_plants
  where id = p_plant_id
    and steward_id = p_steward_id
  returning * into uprooted;

  if uprooted.id is null then
    raise exception 'That plant is no longer in My Garden.' using errcode = 'P0002';
  end if;

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance + 1,
    updated_at = now()
  where steward_id = p_steward_id
  returning garden_member_progress.care_balance into next_balance;

  return jsonb_build_object(
    'uprootedPlantId', uprooted.id,
    'careBalance', next_balance,
    'careReturned', 1
  );
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

  if progress.plot_level >= 3 then
    raise exception 'Your current My Garden plot is fully expanded.' using errcode = '22000';
  end if;

  expansion_cost := case progress.plot_level when 1 then 20 else 50 end;
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
    'width', case next_level when 2 then 7 else 8 end,
    'height', case next_level when 2 then 6 else 7 end
  );
end;
$$;

create or replace function public.purchase_my_garden_upgrade(
  p_steward_id uuid,
  p_upgrade_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress public.garden_member_progress%rowtype;
  upgrade_cost integer;
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

  upgrade_cost := case p_upgrade_type
    when 'birdhouse' then 6
    when 'bench' then 10
    when 'stone_path' then 14
    when 'sage_shed' then 18
    else null
  end;

  if upgrade_cost is null then
    raise exception 'That My Garden upgrade is not available.' using errcode = '22023';
  end if;

  insert into public.garden_member_progress (steward_id)
  values (p_steward_id)
  on conflict (steward_id) do nothing;

  select *
  into progress
  from public.garden_member_progress
  where steward_id = p_steward_id
  for update;

  if exists (
    select 1
    from public.garden_personal_upgrades
    where steward_id = p_steward_id
      and upgrade_type = p_upgrade_type
  ) then
    raise exception 'That upgrade is already part of My Garden.' using errcode = '23505';
  end if;

  if progress.care_balance < upgrade_cost then
    raise exception 'Earn more Care in the Community Garden before adding that upgrade.'
      using errcode = '22000';
  end if;

  insert into public.garden_personal_upgrades (
    steward_id,
    upgrade_type,
    care_cost
  )
  values (
    p_steward_id,
    p_upgrade_type,
    upgrade_cost
  );

  update public.garden_member_progress
  set
    care_balance = garden_member_progress.care_balance - upgrade_cost,
    updated_at = now()
  where steward_id = p_steward_id;

  return jsonb_build_object(
    'upgradeType', p_upgrade_type,
    'careCost', upgrade_cost,
    'careBalance', progress.care_balance - upgrade_cost
  );
end;
$$;

revoke execute on function public.perform_community_garden_planting(integer, integer, text)
  from public, authenticated;
revoke execute on function public.perform_community_garden_watering(uuid)
  from public, authenticated;
grant execute on function public.perform_community_garden_planting(integer, integer, text)
  to anon;
grant execute on function public.perform_community_garden_watering(uuid)
  to anon;

revoke execute on function public.claim_garden_care(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.plant_my_garden(uuid, integer, integer, text)
  from public, anon, authenticated;
revoke execute on function public.uproot_my_garden(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.expand_my_garden(uuid)
  from public, anon, authenticated;
revoke execute on function public.purchase_my_garden_upgrade(uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_garden_care(uuid, uuid)
  to service_role;
grant execute on function public.plant_my_garden(uuid, integer, integer, text)
  to service_role;
grant execute on function public.uproot_my_garden(uuid, uuid)
  to service_role;
grant execute on function public.expand_my_garden(uuid)
  to service_role;
grant execute on function public.purchase_my_garden_upgrade(uuid, text)
  to service_role;

comment on table public.garden_stewards is
  'Private Basil Community Garden Membership accounts. Email and purchase data are never shown in the public garden.';

comment on table public.garden_entitlements is
  'Provider-neutral Community Garden Membership grants. Existing Founding Gardener purchases remain active memberships.';

comment on table public.garden_feedback is
  'Private Garden Member ideas for a human-reviewed Codex upgrade queue. Text is untrusted input and is never public by default.';
