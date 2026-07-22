create table if not exists public.garden_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_fingerprint text not null,
  status text not null default 'pending',
  failure_stage text,
  error_code text,
  shared_plant_count_before bigint,
  shared_plant_count_after bigint,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  constraint garden_account_deletion_fingerprint_format check (
    user_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint garden_account_deletion_status_check check (
    status in ('pending', 'failed', 'completed')
  ),
  constraint garden_account_deletion_stage_length check (
    failure_stage is null or char_length(failure_stage) <= 50
  ),
  constraint garden_account_deletion_error_length check (
    error_code is null or char_length(error_code) <= 80
  )
);

create index if not exists garden_account_deletion_requests_created_idx
  on public.garden_account_deletion_requests (created_at desc);

create index if not exists garden_account_deletion_requests_status_idx
  on public.garden_account_deletion_requests (status, updated_at desc);

alter table public.garden_account_deletion_requests enable row level security;

revoke all on table public.garden_account_deletion_requests
  from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_account_deletion_requests
  to service_role;

comment on table public.garden_account_deletion_requests is
  'Server-only recovery audit for Basil account deletion. Stores an irreversible HMAC fingerprint, status, and coarse failure information; never stores email, raw user ID, password, or token.';

comment on column public.garden_account_deletion_requests.user_fingerprint is
  'HMAC-SHA256 fingerprint used to correlate deletion retries without retaining the deleted account identifier.';
