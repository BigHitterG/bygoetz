-- One in 64 community plants is a stable special flower. The bucket is
-- derived from the UUID's first byte, matching isSpecialWateringFlower()
-- in the browser without trusting the browser to award the bonus.

create or replace function public.perform_community_garden_watering_cluster(
  p_plant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_ids uuid[];
  candidate_id uuid;
  before_watering public.community_garden_roses%rowtype;
  watered public.community_garden_roses%rowtype;
  watered_plants jsonb := '[]'::jsonb;
  care_plant_id uuid;
  care_value integer := 1;
  special_flower boolean := false;
  new_receipt uuid;
  action_time timestamptz := statement_timestamp();
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

  foreach candidate_id in array normalized_ids
  loop
    select *
    into before_watering
    from public.community_garden_roses
    where id = candidate_id
    for update;

    if not found then
      continue;
    end if;

    update public.community_garden_roses
    set last_watered_at = action_time
    where id = candidate_id
      and last_watered_at > action_time - case plant_type
        when 'sunflower' then interval '58 hours'
        when 'lavender' then interval '156 hours'
        else interval '96 hours'
      end
    returning * into watered;

    if not found then
      continue;
    end if;

    watered_plants := watered_plants || jsonb_build_array(jsonb_build_object(
      'id', watered.id,
      'grid_x', watered.grid_x,
      'grid_y', watered.grid_y,
      'plant_type', watered.plant_type,
      'planted_at', watered.planted_at,
      'last_watered_at', watered.last_watered_at,
      'created_at', watered.created_at
    ));

    if before_watering.last_watered_at <= action_time - interval '4 hours' then
      if care_plant_id is null then
        care_plant_id := watered.id;
      end if;
      if mod(
        pg_catalog.get_byte(
          pg_catalog.decode(pg_catalog.substr(watered.id::text, 1, 2), 'hex'),
          0
        ),
        64
      ) = 0 then
        special_flower := true;
      end if;
    end if;
  end loop;

  if jsonb_array_length(watered_plants) = 0 then
    raise exception 'Those plants have already returned to the soil.' using errcode = 'P0002';
  end if;

  if care_plant_id is not null then
    care_value := case when special_flower then 3 else 1 end;
    insert into public.garden_care_receipts (
      action_type,
      community_plant_id,
      care_value
    )
    values ('water', care_plant_id, care_value)
    returning token into new_receipt;
  end if;

  return jsonb_build_object(
    'plant', watered_plants -> 0,
    'plants', watered_plants,
    'contribution',
      case
        when new_receipt is not null
        then jsonb_build_object(
          'action', 'water',
          'receiptToken', new_receipt,
          'careValue', care_value,
          'specialFlower', special_flower
        )
        else null
      end
  );
end;
$$;

create or replace function public.claim_garden_care(
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
  already_awarded_today boolean;
  award integer;
  phase text;
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

  select exists (
    select 1
    from public.garden_care_ledger as ledger
    where ledger.steward_id = p_steward_id
      and ledger.created_at >= date_trunc('day', statement_timestamp())
      and ledger.care_delta > 0
  )
  into already_awarded_today;

  award := (case when already_awarded_today then 1 else 4 end)
    + greatest(0, receipt.care_value::integer - 1);
  phase := case when already_awarded_today then 'standard' else 'daily' end;

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
  select award, next_balance, next_lifetime, phase, 0, 1;
end;
$$;

revoke execute on function public.perform_community_garden_watering_cluster(uuid[])
  from public, anon, authenticated;
revoke execute on function public.claim_garden_care(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.perform_community_garden_watering_cluster(uuid[])
  to service_role;
grant execute on function public.claim_garden_care(uuid, uuid)
  to service_role;
