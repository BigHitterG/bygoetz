create table public.basil_launch_sessions (
  launch_session_id uuid primary key,
  first_arrival_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  device_class text not null default 'unknown',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  meta_click_id text,
  referring_domain text,
  original_landing_path text,
  constraint basil_launch_sessions_device_check
    check (device_class in ('phone', 'tablet', 'desktop', 'unknown')),
  constraint basil_launch_sessions_attribution_lengths_check check (
    length(coalesce(utm_source, '')) <= 120
    and length(coalesce(utm_medium, '')) <= 120
    and length(coalesce(utm_campaign, '')) <= 160
    and length(coalesce(utm_content, '')) <= 160
    and length(coalesce(utm_term, '')) <= 160
    and length(coalesce(meta_click_id, '')) <= 255
    and length(coalesce(referring_domain, '')) <= 253
    and length(coalesce(original_landing_path, '')) <= 300
  ),
  constraint basil_launch_sessions_no_email_like_attribution_check check (
    position('@' in coalesce(utm_source, '')) = 0
    and position('@' in coalesce(utm_medium, '')) = 0
    and position('@' in coalesce(utm_campaign, '')) = 0
    and position('@' in coalesce(utm_content, '')) = 0
    and position('@' in coalesce(utm_term, '')) = 0
    and position('@' in coalesce(referring_domain, '')) = 0
    and position('@' in coalesce(original_landing_path, '')) = 0
  )
);

comment on table public.basil_launch_sessions is
  'Private, anonymous first-touch launch attribution. Contains no account identifier, email, raw IP address, payment detail, or garden position.';

create index basil_launch_sessions_first_arrival_idx
  on public.basil_launch_sessions (first_arrival_at desc);
create index basil_launch_sessions_last_seen_idx
  on public.basil_launch_sessions (last_seen_at desc);
create index basil_launch_sessions_campaign_idx
  on public.basil_launch_sessions (utm_campaign, first_arrival_at desc)
  where utm_campaign is not null;

alter table public.basil_launch_sessions enable row level security;
revoke all on table public.basil_launch_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_launch_sessions to service_role;

create table public.basil_funnel_events (
  event_id uuid primary key default gen_random_uuid(),
  launch_session_id uuid not null
    references public.basil_launch_sessions (launch_session_id) on delete cascade,
  event_name text not null,
  occurred_at timestamptz not null default statement_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  source_key text,
  constraint basil_funnel_events_name_check check (event_name in (
    'session_started',
    'garden_loaded',
    'inventory_opened',
    'plant_selected',
    'first_community_plant',
    'third_community_plant',
    'my_garden_entered',
    'first_personal_plant',
    'preview_limit_reached',
    'paywall_viewed',
    'signup_started',
    'verification_sent',
    'verification_completed',
    'checkout_started',
    'checkout_canceled',
    'purchase_completed',
    'garden_restoration_failed',
    'garden_action_failed'
  )),
  constraint basil_funnel_events_metadata_check check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 1024
    and metadata - array['failure_stage', 'error_code']::text[] = '{}'::jsonb
    and length(coalesce(metadata ->> 'failure_stage', '')) <= 80
    and length(coalesce(metadata ->> 'error_code', '')) <= 80
    and position('@' in coalesce(metadata ->> 'failure_stage', '')) = 0
    and position('@' in coalesce(metadata ->> 'error_code', '')) = 0
    and (not metadata ? 'failure_stage' or jsonb_typeof(metadata -> 'failure_stage') = 'string')
    and (not metadata ? 'error_code' or jsonb_typeof(metadata -> 'error_code') = 'string')
  ),
  constraint basil_funnel_events_source_key_check check (
    source_key is null
    or (
      length(source_key) between 1 and 200
      and source_key ~ '^[A-Za-z0-9:_-]+$'
    )
  )
);

comment on table public.basil_funnel_events is
  'Server-validated anonymous Basil launch milestones. Event metadata is allowlisted and cannot contain account, email, token, payment, or free-form text.';

create unique index basil_funnel_events_milestone_once_idx
  on public.basil_funnel_events (launch_session_id, event_name)
  where event_name not in ('garden_restoration_failed', 'garden_action_failed');
create unique index basil_funnel_events_source_key_idx
  on public.basil_funnel_events (source_key)
  where source_key is not null;
create index basil_funnel_events_occurred_idx
  on public.basil_funnel_events (occurred_at desc);
create index basil_funnel_events_name_occurred_idx
  on public.basil_funnel_events (event_name, occurred_at desc);
create index basil_funnel_events_session_occurred_idx
  on public.basil_funnel_events (launch_session_id, occurred_at desc);

alter table public.basil_funnel_events enable row level security;
revoke all on table public.basil_funnel_events from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_funnel_events to service_role;

create table public.basil_funnel_rate_buckets (
  launch_session_id uuid not null,
  bucket_started_at timestamptz not null,
  event_count integer not null default 0,
  primary key (launch_session_id, bucket_started_at),
  constraint basil_funnel_rate_buckets_count_check
    check (event_count >= 0)
);

comment on table public.basil_funnel_rate_buckets is
  'Short-lived server-only counters limiting anonymous launch analytics submissions to 40 events per session per minute.';

alter table public.basil_funnel_rate_buckets enable row level security;
create index basil_funnel_rate_buckets_started_idx
  on public.basil_funnel_rate_buckets (bucket_started_at);
revoke all on table public.basil_funnel_rate_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_funnel_rate_buckets to service_role;

create table public.basil_funnel_maintenance (
  singleton boolean primary key default true check (singleton),
  last_cleanup_at timestamptz not null default statement_timestamp()
);

insert into public.basil_funnel_maintenance (singleton) values (true)
on conflict (singleton) do nothing;

comment on table public.basil_funnel_maintenance is
  'Server-only daily cleanup marker. Raw anonymous launch sessions and events are retained for 180 days.';

alter table public.basil_funnel_maintenance enable row level security;
revoke all on table public.basil_funnel_maintenance from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_funnel_maintenance to service_role;

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
    'signup_started', 'verification_sent', 'verification_completed',
    'checkout_started', 'checkout_canceled', 'purchase_completed',
    'garden_restoration_failed', 'garden_action_failed'
  ) then
    raise exception 'Unsupported Basil funnel event.' using errcode = '22023';
  end if;

  if p_launch_session_id is null then
    raise exception 'Missing Basil launch session.' using errcode = '22023';
  end if;

  if p_source_key is not null and p_event_name <> 'purchase_completed' then
    raise exception 'A source key is only valid for a purchase milestone.' using errcode = '22023';
  end if;

  if p_event_name not in ('garden_restoration_failed', 'garden_action_failed')
    and event_metadata <> '{}'::jsonb
  then
    raise exception 'Metadata is only valid for failure events.' using errcode = '22023';
  end if;

  if p_source_key is null then
    insert into public.basil_funnel_rate_buckets (
      launch_session_id, bucket_started_at, event_count
    ) values (
      p_launch_session_id, bucket_time, 1
    )
    on conflict (launch_session_id, bucket_started_at) do update
    set event_count = public.basil_funnel_rate_buckets.event_count + 1
    returning event_count into rate_count;

    if rate_count > 40 then
      raise exception 'Basil funnel rate limit reached.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.basil_launch_sessions (
    launch_session_id,
    first_arrival_at,
    device_class,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    meta_click_id,
    referring_domain,
    original_landing_path
  ) values (
    p_launch_session_id,
    event_first_arrival,
    event_device,
    nullif(p_utm_source, ''),
    nullif(p_utm_medium, ''),
    nullif(p_utm_campaign, ''),
    nullif(p_utm_content, ''),
    nullif(p_utm_term, ''),
    nullif(p_meta_click_id, ''),
    nullif(p_referring_domain, ''),
    nullif(p_original_landing_path, '')
  )
  on conflict (launch_session_id) do update
  set
    last_seen_at = statement_timestamp(),
    device_class = case
      when excluded.device_class = 'unknown' then public.basil_launch_sessions.device_class
      else excluded.device_class
    end;

  insert into public.basil_funnel_events (
    event_id,
    launch_session_id,
    event_name,
    metadata,
    source_key
  ) values (
    coalesce(p_event_id, gen_random_uuid()),
    p_launch_session_id,
    p_event_name,
    event_metadata,
    nullif(p_source_key, '')
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
      (7, 'signup_started', 'Signup'),
      (8, 'verification_completed', 'Verified'),
      (9, 'checkout_started', 'Checkout'),
      (10, 'purchase_completed', 'Purchase')
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
    select
      *,
      lag(session_count) over (order by step_order) as previous_count
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

revoke execute on function public.record_basil_funnel_event(
  uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.record_basil_funnel_event(
  uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, jsonb, text
) to service_role;

revoke execute on function public.get_basil_launch_funnel_admin()
  from public, anon, authenticated;
grant execute on function public.get_basil_launch_funnel_admin()
  to service_role;
