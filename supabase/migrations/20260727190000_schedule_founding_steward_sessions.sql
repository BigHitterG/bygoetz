begin;

-- Vercel Hobby cron schedules are limited to one daily wake-up. Supabase Cron
-- provides the half-hour steward cadence. Every request carries a fresh,
-- short-lived, single-use token; no shared secret is stored in source or sent
-- to a browser.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.community_garden_founding_steward_ticks (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  claimed_at timestamptz,
  request_id bigint,
  constraint community_garden_founding_steward_ticks_expiry_check
    check (expires_at > created_at)
);

alter table public.community_garden_founding_steward_ticks enable row level security;
revoke all on table public.community_garden_founding_steward_ticks
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.community_garden_founding_steward_ticks to service_role;

create index if not exists community_garden_founding_steward_ticks_expiry_idx
  on public.community_garden_founding_steward_ticks (expires_at);

create or replace function public.claim_community_garden_founding_steward_tick(
  p_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed uuid;
begin
  if auth.role() <> 'service_role' or p_token is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  update public.community_garden_founding_steward_ticks
  set claimed_at = now()
  where token = p_token
    and claimed_at is null
    and expires_at > now()
  returning token into claimed;

  return claimed is not null;
end;
$$;

create or replace function public.dispatch_community_garden_founding_steward_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick_token uuid := gen_random_uuid();
  http_request_id bigint;
begin
  delete from public.community_garden_founding_steward_ticks
  where expires_at < now() - interval '1 day';

  insert into public.community_garden_founding_steward_ticks (token)
  values (tick_token);

  select net.http_post(
    url := 'https://basilcommunitygarden.com/api/cron/basil-frontier',
    body := jsonb_build_object('tickToken', tick_token),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  ) into http_request_id;

  update public.community_garden_founding_steward_ticks
  set request_id = http_request_id
  where token = tick_token;

  return http_request_id;
end;
$$;

revoke all on function public.claim_community_garden_founding_steward_tick(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_community_garden_founding_steward_tick(uuid)
  to service_role;
revoke all on function public.dispatch_community_garden_founding_steward_tick()
  from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'basil-founding-stewards-half-hour';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'basil-founding-stewards-half-hour',
  '*/30 * * * *',
  'select public.dispatch_community_garden_founding_steward_tick();'
);

comment on table public.community_garden_founding_steward_ticks is
  'Private single-use wake-up tokens for Supabase Cron to run invisible Founding Steward sessions.';
comment on function public.claim_community_garden_founding_steward_tick(uuid) is
  'Atomically claims one unexpired Supabase Cron wake-up token; service-role only.';
comment on function public.dispatch_community_garden_founding_steward_tick() is
  'Creates a single-use token and asynchronously wakes the Basil Founding Steward worker.';

commit;
