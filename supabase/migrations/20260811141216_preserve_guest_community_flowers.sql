-- Signed-out gardeners already share the same bounded newest-flower footprint
-- as members. Keep their flowers in the ordinary ecology instead of applying
-- an unrelated 24-hour hard deletion.

select pg_advisory_xact_lock(
  pg_catalog.hashtextextended('basil-community-garden-snapshot', 0)
);

create or replace function public.perform_idempotent_community_garden_action_v9(
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
  if p_is_guest is null then
    raise exception 'This garden identity could not be verified.' using errcode = '22023';
  end if;

  result_payload := public.perform_idempotent_community_garden_action_v8(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );

  if p_action_type = 'plant' then
    planted_id := nullif(result_payload #>> '{plant,id}', '')::uuid;
    if planted_id is not null then
      update public.community_garden_roses
      set
        contributor_kind = case when p_is_guest then 'guest' else 'account' end,
        guest_expires_at = null
      where id = planted_id
        and contributor_key = p_actor_key
        and heritage_at is null;
    end if;
  end if;

  return result_payload;
end;
$$;

revoke all on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_action_v9(
  uuid, text, text, boolean, text, integer, integer, text, uuid[]
) is 'Processes account or guest Basil actions. Both identities use bounded contributor footprints and the ordinary flower lifecycle; signing in reconciles a browser footprint to the account.';

-- Rescue every guest flower that has not already been physically removed.
-- This includes flowers whose former timestamp has passed but whose next
-- ten-minute cleanup round has not yet run.
update public.community_garden_roses
set guest_expires_at = null
where contributor_kind = 'guest'
  and guest_expires_at is not null;

-- The column remains for migration compatibility, but the canonical ecology
-- must no longer treat it as a deletion signal.
do $$
declare
  definition text;
  upgraded text;
begin
  select pg_get_functiondef(
    'public.get_or_create_community_garden_snapshot()'::regprocedure
  ) into definition;

  upgraded := replace(
    definition,
    E'      or guest_expires_at <= statement_timestamp()\n',
    ''
  );

  if upgraded = definition
    or upgraded like '%guest_expires_at <= statement_timestamp()%'
  then
    raise exception 'Basil snapshot guest-preservation policy could not be installed safely.';
  end if;

  execute upgraded;
end;
$$;

drop index if exists public.community_garden_roses_guest_expiry_idx;

comment on column public.community_garden_roses.guest_expires_at is
  'Legacy compatibility field. Guest flowers use the ordinary bounded footprint and ecological lifecycle, so active rows keep this null.';

delete from public.community_garden_snapshots;
