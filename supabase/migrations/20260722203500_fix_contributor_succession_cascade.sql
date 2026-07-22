-- Keep the contributor footprint focused on the newest 100 live plants.
-- v3 correctly made old contributions eligible for succession, but it selected
-- `live_count - 100` additional rows on every action without accounting for
-- rows already scheduled. v4 normalizes the final footprint in the same
-- transaction so repeated planting cannot create a cascading removal.

create or replace function public.perform_idempotent_community_garden_action_v4(
  p_action_id uuid,
  p_actor_key text,
  p_network_key text,
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
  contributor_count integer;
  succession_count integer;
  next_snapshot_at timestamptz := to_timestamp(
    (floor(extract(epoch from statement_timestamp()) / 600) + 1) * 600
  );
begin
  result_payload := public.perform_idempotent_community_garden_action_v3(
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
    select count(*)::integer
    into contributor_count
    from public.community_garden_roses
    where contributor_key = p_actor_key;

    succession_count := greatest(contributor_count - 100, 0);

    with ranked_footprint as (
      select
        id,
        row_number() over (order by created_at, id) as footprint_rank
      from public.community_garden_roses
      where contributor_key = p_actor_key
    )
    update public.community_garden_roses as plants
    set succession_at = case
      when ranked_footprint.footprint_rank <= succession_count
        then coalesce(plants.succession_at, next_snapshot_at)
      else null
    end
    from ranked_footprint
    where plants.id = ranked_footprint.id
      and plants.succession_at is distinct from case
        when ranked_footprint.footprint_rank <= succession_count
          then coalesce(plants.succession_at, next_snapshot_at)
        else null
      end;
  end if;

  return result_payload;
end;
$$;

revoke execute on function public.perform_idempotent_community_garden_action_v4(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.perform_idempotent_community_garden_action_v4(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_action_v4(
  uuid, text, text, text, integer, integer, text, uuid[]
) is 'Processes a server-authoritative garden action and preserves only the exact oldest overflow above a contributor newest-100 footprint for the next ecology round.';
