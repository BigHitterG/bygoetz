-- Rare Garden Worms are a server-authoritative planting bonus. The action UUID
-- deterministically selects roughly one in 64 accepted planting actions, which
-- makes retries idempotent and keeps the client from asserting the reward.

create or replace function public.perform_idempotent_community_garden_action_v7(
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
  activity_day date := (statement_timestamp() at time zone 'utc')::date;
  daily_care_limit integer := 600;
  daily_care_earned integer := 0;
  existing_care_award integer := 0;
  worm_bonus integer := 0;
  is_garden_worm boolean := false;
begin
  result_payload := public.perform_idempotent_community_garden_action_v6(
    p_action_id,
    p_actor_key,
    p_network_key,
    p_action_type,
    p_grid_x,
    p_grid_y,
    p_plant_type,
    p_plant_ids
  );

  -- A completed retry already contains its final reward payload.
  if coalesce((result_payload #>> '{contribution,gardenWorm}')::boolean, false) then
    return result_payload;
  end if;

  is_garden_worm :=
    p_action_type = 'plant'
    and jsonb_typeof(result_payload -> 'contribution') = 'object'
    and coalesce((result_payload #>> '{contribution,careValue}')::integer, 0) > 0
    and mod(
      pg_catalog.get_byte(
        pg_catalog.decode(
          pg_catalog.substr(pg_catalog.replace(p_action_id::text, '-', ''), 1, 2),
          'hex'
        ),
        0
      ),
      64
    ) = 0;

  if not is_garden_worm then
    return result_payload;
  end if;

  select coalesce(max(settings.daily_care_limit), 600)::integer
  into daily_care_limit
  from public.community_garden_economy_settings as settings
  where settings.setting_key = 'current';

  select coalesce(actor_day.care_earned, 0)
  into daily_care_earned
  from public.community_garden_actor_days as actor_day
  where actor_day.actor_key = p_actor_key
    and actor_day.activity_date = activity_day
  for update;

  existing_care_award :=
    coalesce((result_payload #>> '{contribution,careValue}')::integer, 0);
  worm_bonus := least(2, greatest(0, daily_care_limit - daily_care_earned));

  if worm_bonus <= 0 then
    return result_payload;
  end if;

  update public.garden_care_receipts
  set care_value = care_value + worm_bonus
  where action_id = p_action_id
    and claimed_at is null;

  update public.community_garden_actor_days
  set care_earned = care_earned + worm_bonus
  where actor_key = p_actor_key
    and activity_date = activity_day;

  result_payload := jsonb_set(
    result_payload,
    '{contribution,careValue}',
    to_jsonb(existing_care_award + worm_bonus),
    true
  );
  result_payload := jsonb_set(
    result_payload,
    '{contribution,dailyCareEarned}',
    to_jsonb(daily_care_earned + worm_bonus),
    true
  );

  result_payload := jsonb_set(
    result_payload,
    '{contribution,gardenWorm}',
    'true'::jsonb,
    true
  );

  update public.community_garden_actions
  set response_payload = result_payload
  where action_id = p_action_id
    and status = 'completed';

  return result_payload;
end;
$$;

revoke execute on function public.perform_idempotent_community_garden_action_v7(
  uuid, text, text, text, integer, integer, text, uuid[]
) from public, anon, authenticated;

grant execute on function public.perform_idempotent_community_garden_action_v7(
  uuid, text, text, text, integer, integer, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_action_v7(
  uuid, text, text, text, integer, integer, text, uuid[]
) is 'Processes Basil garden actions and awards an idempotent one-in-64 Garden Worm planting bonus.';
