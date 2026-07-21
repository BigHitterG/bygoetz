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
    select
      step_names.step_order,
      step_names.event_name,
      step_names.label,
      count(distinct recent_events.launch_session_id)::integer as session_count
    from step_names
    left join recent_events on recent_events.event_name = step_names.event_name
    group by step_names.step_order, step_names.event_name, step_names.label
  ),
  step_conversions as (
    select *, lag(session_count) over (order by step_order) as previous_count
    from step_counts
  ),
  devices as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'device', device_class,
      'sessions', session_count
    ) order by session_count desc), '[]'::jsonb) as data
    from (
      select device_class, count(*)::integer as session_count
      from public.basil_launch_sessions
      where first_arrival_at >= statement_timestamp() - interval '30 days'
      group by device_class
    ) grouped_devices
  ),
  attribution as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'source', source_name,
      'medium', medium_name,
      'campaign', campaign_name,
      'creative', creative_name,
      'sessions', session_count,
      'purchases', purchase_count
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
      order by session_count desc
      limit 20
    ) grouped_attribution
  ),
  failures as (
    select jsonb_build_object(
      'gardenActions', count(*) filter (where event_name = 'garden_action_failed'),
      'gardenRestorations', count(*) filter (where event_name = 'garden_restoration_failed'),
      'checkoutCanceled', count(*) filter (where event_name = 'checkout_canceled')
    ) as data
    from recent_events
  )
  select jsonb_build_object(
    'measuredAt', statement_timestamp(),
    'windowDays', 30,
    'retentionDays', 180,
    'uniqueSessions', (
      select count(*)::integer
      from public.basil_launch_sessions
      where first_arrival_at >= statement_timestamp() - interval '30 days'
    ),
    'steps', (
      select jsonb_agg(jsonb_build_object(
        'event', event_name,
        'label', label,
        'sessions', session_count,
        'conversionFromPrevious', case
          when previous_count is null then 100.0
          when previous_count = 0 then 0.0
          else round(100 * session_count::numeric / previous_count, 1)
        end
      ) order by step_order)
      from step_conversions
    ),
    'devices', devices.data,
    'attribution', attribution.data,
    'failures', failures.data
  )
  from devices cross join attribution cross join failures;
$$;

revoke execute on function public.get_basil_launch_funnel_admin()
  from public, anon, authenticated;
grant execute on function public.get_basil_launch_funnel_admin()
  to service_role;
