-- Basil mastery remains the final 1,000,000 lifetime-Care unlock. This release
-- changes only its placement price and name; it does not alter lifetime Care.
update public.garden_personal_element_catalog
set
  display_name = 'Basil Heritage Plant',
  care_cost = 1
where element_type = 'great_basil_topiary';

alter table public.community_garden_roses
  add column if not exists base_absolute_expires_at timestamptz,
  add column if not exists heritage_aura_multiplier smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.community_garden_roses'::regclass
      and conname = 'community_garden_roses_heritage_aura_multiplier_check'
  ) then
    alter table public.community_garden_roses
      add constraint community_garden_roses_heritage_aura_multiplier_check
      check (heritage_aura_multiplier in (1, 2, 4));
  end if;
end;
$$;

comment on column public.community_garden_roses.base_absolute_expires_at is
  'The ordinary maximum-season deadline before nearby Heritage protection.';
comment on column public.community_garden_roses.heritage_aura_multiplier is
  'Strongest non-stacking Heritage maximum-season multiplier: 1, 2, or 4.';

create index if not exists community_garden_roses_heritage_grid_idx
  on public.community_garden_roses (grid_x, grid_y)
  where heritage_at is not null;

update public.community_garden_roses
set base_absolute_expires_at = absolute_expires_at
where heritage_at is null
  and base_absolute_expires_at is null;

create or replace function public.get_community_garden_heritage_aura_multiplier_v1(
  p_grid_x integer,
  p_grid_y integer
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(
    case
      when greatest(
        abs(plant.grid_x - p_grid_x),
        abs(plant.grid_y - p_grid_y)
      ) <= 1 then 4
      when greatest(
        abs(plant.grid_x - p_grid_x),
        abs(plant.grid_y - p_grid_y)
      ) <= 2 then 2
      else 1
    end
  ), 1)::smallint
  from public.community_garden_roses as plant
  where plant.heritage_at is not null
    and plant.grid_x between p_grid_x - 2 and p_grid_x + 2
    and plant.grid_y between p_grid_y - 2 and p_grid_y + 2;
$$;

create or replace function public.refresh_community_garden_heritage_aura_v1(
  p_plant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.community_garden_roses%rowtype;
  selected_multiplier smallint;
  selected_base_expiry timestamptz;
begin
  select * into selected
  from public.community_garden_roses
  where id = p_plant_id
  for update;

  if not found or selected.heritage_at is not null then
    return;
  end if;

  selected_multiplier := public.get_community_garden_heritage_aura_multiplier_v1(
    selected.grid_x,
    selected.grid_y
  );
  selected_base_expiry := coalesce(
    selected.base_absolute_expires_at,
    selected.absolute_expires_at
  );

  update public.community_garden_roses
  set
    base_absolute_expires_at = selected_base_expiry,
    heritage_aura_multiplier = selected_multiplier,
    absolute_expires_at = case
      when selected_base_expiry is null then null
      else selected.planted_at
        + (selected_base_expiry - selected.planted_at) * selected_multiplier
    end
  where id = selected.id;
end;
$$;

create or replace function public.extend_community_garden_heritage_aura_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.heritage_at is not null or new.heritage_at is null then
    return new;
  end if;

  update public.community_garden_roses as plant
  set
    base_absolute_expires_at = coalesce(
      plant.base_absolute_expires_at,
      plant.absolute_expires_at
    ),
    heritage_aura_multiplier = greatest(
      plant.heritage_aura_multiplier,
      case
        when greatest(
          abs(plant.grid_x - new.grid_x),
          abs(plant.grid_y - new.grid_y)
        ) <= 1 then 4
        else 2
      end
    )::smallint,
    absolute_expires_at = case
      when coalesce(
        plant.base_absolute_expires_at,
        plant.absolute_expires_at
      ) is null then null
      else plant.planted_at + (
        coalesce(
          plant.base_absolute_expires_at,
          plant.absolute_expires_at
        ) - plant.planted_at
      ) * greatest(
        plant.heritage_aura_multiplier,
        case
          when greatest(
            abs(plant.grid_x - new.grid_x),
            abs(plant.grid_y - new.grid_y)
          ) <= 1 then 4
          else 2
        end
      )
    end
  where plant.heritage_at is null
    and plant.grid_x between new.grid_x - 2 and new.grid_x + 2
    and plant.grid_y between new.grid_y - 2 and new.grid_y + 2;

  return new;
end;
$$;

drop trigger if exists extend_community_garden_heritage_aura
  on public.community_garden_roses;
create trigger extend_community_garden_heritage_aura
after update of heritage_at on public.community_garden_roses
for each row execute function public.extend_community_garden_heritage_aura_v1();

-- Backfill the strongest nearby protection without changing Heritage Flowers
-- themselves. Heritage flowers already have no ordinary maximum-season end.
do $$
declare
  candidate record;
begin
  for candidate in
    select id
    from public.community_garden_roses
    where heritage_at is null
    order by id
  loop
    perform public.refresh_community_garden_heritage_aura_v1(candidate.id);
  end loop;
end;
$$;

create or replace function public.enrich_community_garden_action_plants_v1(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  enriched_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  enriched_plants jsonb;
  enriched_plant jsonb;
begin
  if jsonb_typeof(enriched_payload -> 'plants') = 'array' then
    select coalesce(jsonb_agg(
      case
        when plant.id is null then item.value
        else item.value || jsonb_build_object(
          'heritage_at', plant.heritage_at,
          'absolute_expires_at', plant.absolute_expires_at,
          'heritage_aura_multiplier', plant.heritage_aura_multiplier
        )
      end
      order by item.ordinality
    ), '[]'::jsonb)
    into enriched_plants
    from jsonb_array_elements(enriched_payload -> 'plants')
      with ordinality as item(value, ordinality)
    left join public.community_garden_roses as plant
      on plant.id::text = item.value ->> 'id';

    enriched_payload := jsonb_set(
      enriched_payload,
      '{plants}',
      enriched_plants,
      true
    );
  end if;

  if jsonb_typeof(enriched_payload -> 'plant') = 'object' then
    select case
      when plant.id is null then enriched_payload -> 'plant'
      else enriched_payload -> 'plant' || jsonb_build_object(
        'heritage_at', plant.heritage_at,
        'absolute_expires_at', plant.absolute_expires_at,
        'heritage_aura_multiplier', plant.heritage_aura_multiplier
      )
    end
    into enriched_plant
    from (select enriched_payload -> 'plant' as value) as item
    left join public.community_garden_roses as plant
      on plant.id::text = item.value ->> 'id';

    enriched_payload := jsonb_set(
      enriched_payload,
      '{plant}',
      coalesce(enriched_plant, enriched_payload -> 'plant'),
      true
    );
  end if;

  return enriched_payload;
end;
$$;

create or replace function public.perform_idempotent_community_garden_action_v10(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
  p_is_guest boolean,
  p_action_type text,
  p_grid_x integer default null,
  p_grid_y integer default null,
  p_plant_type text default null,
  p_plant_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_payload jsonb;
  planted_id uuid;
begin
  result_payload := public.perform_idempotent_community_garden_action_v9(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_is_guest,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );

  if p_action_type = 'plant' then
    planted_id := nullif(result_payload #>> '{plant,id}', '')::uuid;
    if planted_id is not null then
      perform public.refresh_community_garden_heritage_aura_v1(planted_id);
    end if;
  end if;

  result_payload := public.enrich_community_garden_action_plants_v1(
    result_payload
  );

  update public.community_garden_actions
  set response_payload = result_payload
  where action_id = p_action_id and status = 'completed';

  return result_payload;
end;
$$;

revoke all on function public.get_community_garden_heritage_aura_multiplier_v1(
  integer, integer
) from public, anon, authenticated;
revoke all on function public.refresh_community_garden_heritage_aura_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.enrich_community_garden_action_plants_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.perform_idempotent_community_garden_action_v10(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.perform_idempotent_community_garden_action_v10(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) to service_role;
