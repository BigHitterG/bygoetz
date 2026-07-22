create table public.basil_meta_purchase_events (
  event_id text primary key,
  stripe_session_id text not null unique,
  launch_session_id uuid references public.basil_launch_sessions (launch_session_id)
    on delete set null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  response_status integer,
  last_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  sent_at timestamptz,
  constraint basil_meta_purchase_events_event_id_check
    check (event_id ~ '^basil_purchase_[0-9a-f]{32}$'),
  constraint basil_meta_purchase_events_session_check
    check (length(stripe_session_id) between 10 and 255),
  constraint basil_meta_purchase_events_status_check
    check (status in ('pending', 'sending', 'sent', 'failed')),
  constraint basil_meta_purchase_events_attempt_check
    check (attempt_count between 0 and 20),
  constraint basil_meta_purchase_events_response_check
    check (response_status is null or response_status between 100 and 599),
  constraint basil_meta_purchase_events_error_check
    check (
      last_error_code is null
      or (
        length(last_error_code) between 1 and 80
        and last_error_code ~ '^[A-Za-z0-9:_-]+$'
      )
    )
);

comment on table public.basil_meta_purchase_events is
  'Private server-only Meta Purchase delivery ledger. Stores deduplication and delivery state, not access tokens, email addresses, payment details, or Meta response bodies.';

create index basil_meta_purchase_events_updated_idx
  on public.basil_meta_purchase_events (updated_at desc);
create index basil_meta_purchase_events_status_updated_idx
  on public.basil_meta_purchase_events (status, updated_at)
  where status <> 'sent';

alter table public.basil_meta_purchase_events enable row level security;
revoke all on table public.basil_meta_purchase_events from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_meta_purchase_events to service_role;

create or replace function public.claim_basil_meta_purchase_event(
  p_event_id text,
  p_stripe_session_id text,
  p_launch_session_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  insert into public.basil_meta_purchase_events (
    event_id,
    stripe_session_id,
    launch_session_id
  ) values (
    p_event_id,
    p_stripe_session_id,
    p_launch_session_id
  )
  on conflict do nothing;

  update public.basil_meta_purchase_events
  set
    status = 'sending',
    attempt_count = attempt_count + 1,
    updated_at = statement_timestamp(),
    last_error_code = null
  where event_id = p_event_id
    and stripe_session_id = p_stripe_session_id
    and attempt_count < 20
    and (
      status in ('pending', 'failed')
      or (
        status = 'sending'
        and updated_at < statement_timestamp() - interval '5 minutes'
      )
    );

  get diagnostics claimed_count = row_count;
  return claimed_count > 0;
end;
$$;

create or replace function public.finish_basil_meta_purchase_event(
  p_event_id text,
  p_success boolean,
  p_response_status integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.basil_meta_purchase_events
  set
    status = case when p_success then 'sent' else 'failed' end,
    response_status = p_response_status,
    last_error_code = case when p_success then null else p_error_code end,
    sent_at = case when p_success then statement_timestamp() else sent_at end,
    updated_at = statement_timestamp()
  where event_id = p_event_id
    and status = 'sending';
end;
$$;

revoke all on function public.claim_basil_meta_purchase_event(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_basil_meta_purchase_event(text, text, uuid)
  to service_role;

revoke all on function public.finish_basil_meta_purchase_event(text, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.finish_basil_meta_purchase_event(text, boolean, integer, text)
  to service_role;
