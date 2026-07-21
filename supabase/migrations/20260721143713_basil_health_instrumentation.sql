create table if not exists public.community_garden_session_health (
  actor_key text primary key,
  device_class text not null default 'unknown',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pulse_count integer not null default 0,
  action_success_count integer not null default 0,
  action_failure_count integer not null default 0,
  last_action_at timestamptz,
  last_error_code text,
  constraint community_garden_session_health_actor_key_check
    check (actor_key ~ '^[0-9a-f]{64}$'),
  constraint community_garden_session_health_device_class_check
    check (device_class in ('phone', 'tablet', 'desktop', 'unknown')),
  constraint community_garden_session_health_counts_check
    check (
      pulse_count >= 0
      and action_success_count >= 0
      and action_failure_count >= 0
    )
);

create index if not exists community_garden_session_health_last_seen_idx
  on public.community_garden_session_health (last_seen_at desc);

alter table public.community_garden_session_health enable row level security;
revoke all on table public.community_garden_session_health
  from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_session_health
  to service_role;

comment on table public.community_garden_session_health is
  'Server-only coarse activity for anonymous Basil browser sessions. Stores an HMAC session key and device class, never a raw IP address, email, coordinate, or public identity.';

create table if not exists public.community_garden_health_buckets (
  bucket_started_at timestamptz not null,
  device_class text not null,
  session_starts integer not null default 0,
  pulse_count integer not null default 0,
  snapshot_count integer not null default 0,
  snapshot_failure_count integer not null default 0,
  action_count integer not null default 0,
  action_failure_count integer not null default 0,
  total_snapshot_duration_ms bigint not null default 0,
  max_snapshot_duration_ms integer not null default 0,
  total_action_duration_ms bigint not null default 0,
  max_action_duration_ms integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket_started_at, device_class),
  constraint community_garden_health_buckets_device_class_check
    check (device_class in ('phone', 'tablet', 'desktop', 'unknown')),
  constraint community_garden_health_buckets_counts_check
    check (
      session_starts >= 0
      and pulse_count >= 0
      and snapshot_count >= 0
      and snapshot_failure_count >= 0
      and action_count >= 0
      and action_failure_count >= 0
      and total_snapshot_duration_ms >= 0
      and max_snapshot_duration_ms >= 0
      and total_action_duration_ms >= 0
      and max_action_duration_ms >= 0
    )
);

alter table public.community_garden_health_buckets enable row level security;
revoke all on table public.community_garden_health_buckets
  from public, anon, authenticated;
grant select, insert, update, delete on table public.community_garden_health_buckets
  to service_role;

comment on table public.community_garden_health_buckets is
  'Server-only minute aggregates for Basil availability and latency. Does not contain account identity, raw IP addresses, garden coordinates, or action payloads.';

create or replace function public.record_community_garden_health(
  p_event_type text,
  p_device_class text default 'unknown',
  p_actor_key text default null,
  p_duration_ms integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_device text := case
    when p_device_class in ('phone', 'tablet', 'desktop') then p_device_class
    else 'unknown'
  end;
  event_duration integer := greatest(0, least(coalesce(p_duration_ms, 0), 120000));
  event_error text := left(nullif(trim(coalesce(p_error_code, '')), ''), 80);
  bucket_time timestamptz := date_trunc('minute', statement_timestamp());
  inserted_sessions integer := 0;
begin
  if p_event_type not in (
    'pulse',
    'snapshot_ok',
    'snapshot_error',
    'action_ok',
    'action_error'
  ) then
    raise exception 'Unsupported Basil health event.' using errcode = '22023';
  end if;

  if p_actor_key is not null and p_actor_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Basil health session.' using errcode = '22023';
  end if;

  if p_actor_key is not null then
    insert into public.community_garden_session_health (
      actor_key,
      device_class
    )
    values (
      p_actor_key,
      event_device
    )
    on conflict (actor_key) do nothing;

    get diagnostics inserted_sessions = row_count;

    update public.community_garden_session_health
    set
      device_class = event_device,
      last_seen_at = statement_timestamp(),
      pulse_count = pulse_count + case when p_event_type = 'pulse' then 1 else 0 end,
      action_success_count = action_success_count
        + case when p_event_type = 'action_ok' then 1 else 0 end,
      action_failure_count = action_failure_count
        + case when p_event_type = 'action_error' then 1 else 0 end,
      last_action_at = case
        when p_event_type in ('action_ok', 'action_error') then statement_timestamp()
        else last_action_at
      end,
      last_error_code = case
        when p_event_type = 'action_error' then event_error
        else last_error_code
      end
    where actor_key = p_actor_key;
  end if;

  insert into public.community_garden_health_buckets (
    bucket_started_at,
    device_class,
    session_starts,
    pulse_count,
    snapshot_count,
    snapshot_failure_count,
    action_count,
    action_failure_count,
    total_snapshot_duration_ms,
    max_snapshot_duration_ms,
    total_action_duration_ms,
    max_action_duration_ms
  )
  values (
    bucket_time,
    event_device,
    inserted_sessions,
    case when p_event_type = 'pulse' then 1 else 0 end,
    case when p_event_type in ('snapshot_ok', 'snapshot_error') then 1 else 0 end,
    case when p_event_type = 'snapshot_error' then 1 else 0 end,
    case when p_event_type in ('action_ok', 'action_error') then 1 else 0 end,
    case when p_event_type = 'action_error' then 1 else 0 end,
    case when p_event_type in ('snapshot_ok', 'snapshot_error') then event_duration else 0 end,
    case when p_event_type in ('snapshot_ok', 'snapshot_error') then event_duration else 0 end,
    case when p_event_type in ('action_ok', 'action_error') then event_duration else 0 end,
    case when p_event_type in ('action_ok', 'action_error') then event_duration else 0 end
  )
  on conflict (bucket_started_at, device_class) do update
  set
    session_starts = public.community_garden_health_buckets.session_starts
      + excluded.session_starts,
    pulse_count = public.community_garden_health_buckets.pulse_count
      + excluded.pulse_count,
    snapshot_count = public.community_garden_health_buckets.snapshot_count
      + excluded.snapshot_count,
    snapshot_failure_count = public.community_garden_health_buckets.snapshot_failure_count
      + excluded.snapshot_failure_count,
    action_count = public.community_garden_health_buckets.action_count
      + excluded.action_count,
    action_failure_count = public.community_garden_health_buckets.action_failure_count
      + excluded.action_failure_count,
    total_snapshot_duration_ms = public.community_garden_health_buckets.total_snapshot_duration_ms
      + excluded.total_snapshot_duration_ms,
    max_snapshot_duration_ms = greatest(
      public.community_garden_health_buckets.max_snapshot_duration_ms,
      excluded.max_snapshot_duration_ms
    ),
    total_action_duration_ms = public.community_garden_health_buckets.total_action_duration_ms
      + excluded.total_action_duration_ms,
    max_action_duration_ms = greatest(
      public.community_garden_health_buckets.max_action_duration_ms,
      excluded.max_action_duration_ms
    ),
    updated_at = statement_timestamp();
end;
$$;

create or replace function public.get_community_garden_admin_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with session_summary as (
    select
      count(*) filter (
        where last_seen_at >= statement_timestamp() - interval '5 minutes'
      )::integer as active_5m,
      count(*) filter (
        where last_seen_at >= statement_timestamp() - interval '15 minutes'
      )::integer as active_15m,
      count(*) filter (
        where first_seen_at >= statement_timestamp() - interval '24 hours'
      )::integer as new_24h,
      count(*) filter (
        where last_seen_at >= statement_timestamp() - interval '15 minutes'
          and device_class = 'phone'
      )::integer as phones_15m,
      count(*) filter (
        where last_seen_at >= statement_timestamp() - interval '15 minutes'
          and device_class = 'tablet'
      )::integer as tablets_15m,
      count(*) filter (
        where last_seen_at >= statement_timestamp() - interval '15 minutes'
          and device_class = 'desktop'
      )::integer as desktops_15m
    from public.community_garden_session_health
  ),
  recent_health as (
    select
      coalesce(sum(action_count), 0)::integer as actions_10m,
      coalesce(sum(action_failure_count), 0)::integer as action_failures_10m,
      coalesce(sum(total_action_duration_ms), 0)::bigint as action_duration_10m,
      coalesce(max(max_action_duration_ms), 0)::integer as max_action_ms_10m,
      coalesce(sum(snapshot_count), 0)::integer as snapshots_10m,
      coalesce(sum(snapshot_failure_count), 0)::integer as snapshot_failures_10m,
      coalesce(sum(total_snapshot_duration_ms), 0)::bigint as snapshot_duration_10m,
      coalesce(max(max_snapshot_duration_ms), 0)::integer as max_snapshot_ms_10m
    from public.community_garden_health_buckets
    where bucket_started_at >= date_trunc('minute', statement_timestamp()) - interval '9 minutes'
  ),
  latest_snapshot as (
    select
      version,
      generated_at,
      next_refresh_at,
      plant_count,
      pg_column_size(payload)::integer as payload_bytes
    from public.community_garden_snapshots
    order by version desc
    limit 1
  ),
  recent_errors as (
    select max(bucket_started_at) as last_error_at
    from public.community_garden_health_buckets
    where action_failure_count > 0 or snapshot_failure_count > 0
  ),
  measured as (
    select
      session_summary.*,
      recent_health.*,
      latest_snapshot.version as snapshot_version,
      latest_snapshot.generated_at as snapshot_generated_at,
      latest_snapshot.next_refresh_at as snapshot_next_refresh_at,
      latest_snapshot.plant_count,
      latest_snapshot.payload_bytes,
      recent_errors.last_error_at,
      case
        when recent_health.actions_10m > 0 then
          round(
            (recent_health.action_duration_10m::numeric / recent_health.actions_10m),
            0
          )::integer
        else 0
      end as average_action_ms,
      case
        when recent_health.snapshots_10m > 0 then
          round(
            (recent_health.snapshot_duration_10m::numeric / recent_health.snapshots_10m),
            0
          )::integer
        else 0
      end as average_snapshot_ms,
      case
        when recent_health.actions_10m > 0 then
          round(
            100 * (
              1 - recent_health.action_failures_10m::numeric
                / recent_health.actions_10m
            ),
            1
          )
        else 100.0
      end as action_success_percent
    from session_summary
    cross join recent_health
    left join latest_snapshot on true
    cross join recent_errors
  )
  select jsonb_build_object(
    'measuredAt', statement_timestamp(),
    'status', case
      when action_success_percent < 85
        or average_action_ms >= 5000
        or snapshot_failures_10m >= 3
        or snapshot_generated_at < statement_timestamp() - interval '20 minutes'
      then 'degraded'
      when action_success_percent < 95
        or average_action_ms >= 2500
        or snapshot_failures_10m > 0
        or snapshot_generated_at < statement_timestamp() - interval '12 minutes'
      then 'elevated'
      else 'healthy'
    end,
    'activeUsers5m', active_5m,
    'activeUsers15m', active_15m,
    'newSessions24h', new_24h,
    'devices15m', jsonb_build_object(
      'phone', phones_15m,
      'tablet', tablets_15m,
      'desktop', desktops_15m
    ),
    'actions10m', actions_10m,
    'actionFailures10m', action_failures_10m,
    'actionSuccessPercent', action_success_percent,
    'averageActionMs', average_action_ms,
    'maxActionMs', max_action_ms_10m,
    'snapshots10m', snapshots_10m,
    'snapshotFailures10m', snapshot_failures_10m,
    'averageSnapshotMs', average_snapshot_ms,
    'maxSnapshotMs', max_snapshot_ms_10m,
    'lastErrorAt', last_error_at,
    'snapshot', jsonb_build_object(
      'version', snapshot_version,
      'generatedAt', snapshot_generated_at,
      'nextRefreshAt', snapshot_next_refresh_at,
      'plantCount', plant_count,
      'payloadBytes', payload_bytes
    )
  )
  from measured;
$$;

revoke execute on function public.record_community_garden_health(
  text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.record_community_garden_health(
  text, text, text, integer, text
) to service_role;

revoke execute on function public.get_community_garden_admin_health()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_admin_health()
  to service_role;
