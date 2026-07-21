alter table public.basil_funnel_events
  drop constraint basil_funnel_events_name_check;

alter table public.basil_funnel_events
  add constraint basil_funnel_events_name_check check (event_name in (
    'session_started', 'garden_loaded', 'inventory_opened', 'plant_selected',
    'first_community_plant', 'third_community_plant', 'my_garden_entered',
    'first_personal_plant', 'preview_limit_reached', 'paywall_viewed',
    'soft_paywall_viewed', 'soft_paywall_declined', 'preview_continued',
    'hard_paywall_viewed', 'preview_expired', 'signup_started',
    'verification_sent', 'verification_completed', 'checkout_started',
    'checkout_canceled', 'purchase_completed', 'garden_restoration_failed',
    'garden_action_failed'
  ));

create or replace function public.record_basil_funnel_event(
  p_event_id uuid,
  p_launch_session_id uuid,
  p_first_arrival_at timestamptz,
  p_event_name text,
  p_device_class text default 'unknown',
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_meta_click_id text default null,
  p_referring_domain text default null,
  p_original_landing_path text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_source_key text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_device text := case
    when p_device_class in ('phone', 'tablet', 'desktop') then p_device_class
    else 'unknown'
  end;
  event_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  bucket_time timestamptz := date_trunc('minute', statement_timestamp());
  rate_count integer;
  inserted_count integer;
  event_was_inserted boolean := false;
  should_cleanup boolean := false;
  event_first_arrival timestamptz := case
    when p_first_arrival_at between statement_timestamp() - interval '90 days'
      and statement_timestamp() + interval '5 minutes'
    then p_first_arrival_at
    else statement_timestamp()
  end;
begin
  if p_event_name not in (
    'session_started', 'garden_loaded', 'inventory_opened', 'plant_selected',
    'first_community_plant', 'third_community_plant', 'my_garden_entered',
    'first_personal_plant', 'preview_limit_reached', 'paywall_viewed',
    'soft_paywall_viewed', 'soft_paywall_declined', 'preview_continued',
    'hard_paywall_viewed', 'preview_expired', 'signup_started',
    'verification_sent', 'verification_completed', 'checkout_started',
    'checkout_canceled', 'purchase_completed', 'garden_restoration_failed',
    'garden_action_failed'
  ) then
    raise exception 'Unsupported Basil funnel event.' using errcode = '22023';
  end if;

  if p_launch_session_id is null then
    raise exception 'Missing Basil launch session.' using errcode = '22023';
  end if;

  if p_source_key is not null and p_event_name in (
    'garden_restoration_failed', 'garden_action_failed'
  ) then
    raise exception 'A source key is only valid for a milestone.' using errcode = '22023';
  end if;

  if p_event_name not in ('garden_restoration_failed', 'garden_action_failed')
    and event_metadata <> '{}'::jsonb
  then
    raise exception 'Metadata is only valid for failure events.' using errcode = '22023';
  end if;

  if p_source_key is null then
    insert into public.basil_funnel_rate_buckets (
      launch_session_id, bucket_started_at, event_count
    ) values (p_launch_session_id, bucket_time, 1)
    on conflict (launch_session_id, bucket_started_at) do update
    set event_count = public.basil_funnel_rate_buckets.event_count + 1
    returning event_count into rate_count;

    if rate_count > 40 then
      raise exception 'Basil funnel rate limit reached.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.basil_launch_sessions (
    launch_session_id, first_arrival_at, device_class, utm_source, utm_medium,
    utm_campaign, utm_content, utm_term, meta_click_id, referring_domain,
    original_landing_path
  ) values (
    p_launch_session_id, event_first_arrival, event_device,
    nullif(p_utm_source, ''), nullif(p_utm_medium, ''),
    nullif(p_utm_campaign, ''), nullif(p_utm_content, ''),
    nullif(p_utm_term, ''), nullif(p_meta_click_id, ''),
    nullif(p_referring_domain, ''), nullif(p_original_landing_path, '')
  )
  on conflict (launch_session_id) do update
  set
    last_seen_at = statement_timestamp(),
    device_class = case
      when excluded.device_class = 'unknown' then public.basil_launch_sessions.device_class
      else excluded.device_class
    end;

  insert into public.basil_funnel_events (
    event_id, launch_session_id, event_name, metadata, source_key
  ) values (
    coalesce(p_event_id, gen_random_uuid()), p_launch_session_id, p_event_name,
    event_metadata, nullif(p_source_key, '')
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  event_was_inserted := inserted_count > 0;

  update public.basil_funnel_maintenance
  set last_cleanup_at = statement_timestamp()
  where singleton = true
    and last_cleanup_at < statement_timestamp() - interval '1 day';
  get diagnostics inserted_count = row_count;
  should_cleanup := inserted_count > 0;

  if should_cleanup then
    delete from public.basil_funnel_rate_buckets
    where bucket_started_at < statement_timestamp() - interval '2 hours';
    delete from public.basil_launch_sessions
    where last_seen_at < statement_timestamp() - interval '180 days';
  end if;

  return event_was_inserted;
end;
$$;

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

  imported_care := greatest(0, least(coalesce(p_care_balance, 0), 20));

  insert into public.garden_personal_plants (
    steward_id, grid_x, grid_y, plant_type
  )
  select p_steward_id, candidate.grid_x, candidate.grid_y, candidate.plant_type
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
  limit 10
  on conflict (steward_id, grid_x, grid_y) do nothing;

  insert into public.garden_personal_paths (steward_id, grid_x, grid_y)
  select p_steward_id, candidate.grid_x, candidate.grid_y
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

create or replace function public.get_basil_launch_funnel_admin()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with step_names(step_order, event_name, label) as (
    values
      (1, 'session_started', 'Sessions'),
      (2, 'garden_loaded', 'Garden loaded'),
      (3, 'first_community_plant', 'First plant'),
      (4, 'third_community_plant', 'Third plant'),
      (5, 'my_garden_entered', 'My Garden'),
      (6, 'paywall_viewed', 'Paywall'),
      (7, 'checkout_started', 'Checkout'),
      (8, 'purchase_completed', 'Purchase'),
      (9, 'signup_started', 'Account setup'),
      (10, 'verification_completed', 'Verified')
  ),
  recent_events as (
    select event_name, launch_session_id, metadata
    from public.basil_funnel_events
    where occurred_at >= statement_timestamp() - interval '30 days'
  ),
  step_counts as (
    select n.step_order, n.event_name, n.label,
      count(distinct e.launch_session_id)::integer as session_count
    from step_names n left join recent_events e on e.event_name = n.event_name
    group by n.step_order, n.event_name, n.label
  ),
  step_conversions as (
    select *, lag(session_count) over (order by step_order) as previous_count
    from step_counts
  ),
  preview_journey as (
    select jsonb_build_object(
      'softPaywallViews', count(distinct launch_session_id) filter (where event_name = 'soft_paywall_viewed'),
      'softDeclines', count(distinct launch_session_id) filter (where event_name = 'soft_paywall_declined'),
      'continuedAfterDecline', count(distinct launch_session_id) filter (where event_name = 'preview_continued'),
      'hardPaywallViews', count(distinct launch_session_id) filter (where event_name = 'hard_paywall_viewed'),
      'expiredPreviews', count(distinct launch_session_id) filter (where event_name = 'preview_expired')
    ) as data from recent_events
  ),
  devices as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'device', device_class, 'sessions', session_count
    ) order by session_count desc), '[]'::jsonb) as data
    from (
      select device_class, count(*)::integer as session_count
      from public.basil_launch_sessions
      where first_arrival_at >= statement_timestamp() - interval '30 days'
      group by device_class
    ) d
  ),
  attribution as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'source', source_name, 'medium', medium_name, 'campaign', campaign_name,
      'creative', creative_name, 'sessions', session_count, 'purchases', purchase_count
    ) order by session_count desc), '[]'::jsonb) as data
    from (
      select
        coalesce(nullif(s.utm_source, ''), '(direct)') as source_name,
        coalesce(nullif(s.utm_medium, ''), '(none)') as medium_name,
        coalesce(nullif(s.utm_campaign, ''), '(unattributed)') as campaign_name,
        coalesce(nullif(s.utm_content, ''), '(unspecified)') as creative_name,
        count(*)::integer as session_count,
        count(*) filter (where exists (
          select 1 from recent_events e
          where e.launch_session_id = s.launch_session_id
            and e.event_name = 'purchase_completed'
        ))::integer as purchase_count
      from public.basil_launch_sessions s
      where s.first_arrival_at >= statement_timestamp() - interval '30 days'
      group by 1, 2, 3, 4
      order by session_count desc limit 20
    ) a
  ),
  failures as (
    select jsonb_build_object(
      'gardenActions', count(*) filter (where event_name = 'garden_action_failed'),
      'gardenRestorations', count(*) filter (where event_name = 'garden_restoration_failed'),
      'checkoutCanceled', count(*) filter (where event_name = 'checkout_canceled')
    ) as data from recent_events
  )
  select jsonb_build_object(
    'measuredAt', statement_timestamp(), 'windowDays', 30, 'retentionDays', 180,
    'uniqueSessions', (
      select count(*)::integer from public.basil_launch_sessions
      where first_arrival_at >= statement_timestamp() - interval '30 days'
    ),
    'steps', (
      select jsonb_agg(jsonb_build_object(
        'event', event_name, 'label', label, 'sessions', session_count,
        'conversionFromPrevious', case
          when previous_count is null then 100.0
          when previous_count = 0 then 0.0
          else round(100 * session_count::numeric / previous_count, 1)
        end
      ) order by step_order) from step_conversions
    ),
    'previewJourney', preview_journey.data,
    'devices', devices.data, 'attribution', attribution.data,
    'failures', failures.data
  )
  from devices cross join attribution cross join failures cross join preview_journey;
$$;

revoke execute on function public.record_basil_funnel_event(
  uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.record_basil_funnel_event(
  uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text
) to service_role;

revoke execute on function public.import_my_garden_preview(uuid, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_my_garden_preview(uuid, integer, jsonb, jsonb)
  to service_role;

revoke execute on function public.get_basil_launch_funnel_admin()
  from public, anon, authenticated;
grant execute on function public.get_basil_launch_funnel_admin()
  to service_role;
