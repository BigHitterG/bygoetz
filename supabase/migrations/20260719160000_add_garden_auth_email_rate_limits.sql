create table if not exists public.garden_auth_email_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  intent text not null,
  created_at timestamptz not null default now(),
  constraint garden_auth_email_requests_email_hash_check
    check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint garden_auth_email_requests_ip_hash_check
    check (ip_hash ~ '^[0-9a-f]{64}$'),
  constraint garden_auth_email_requests_intent_check
    check (intent in ('signup', 'recovery'))
);

create index if not exists garden_auth_email_requests_email_created_idx
  on public.garden_auth_email_requests (email_hash, created_at desc);

create index if not exists garden_auth_email_requests_ip_created_idx
  on public.garden_auth_email_requests (ip_hash, created_at desc);

alter table public.garden_auth_email_requests enable row level security;

revoke all on table public.garden_auth_email_requests from public, anon, authenticated;
grant select, insert, delete on table public.garden_auth_email_requests to service_role;

comment on table public.garden_auth_email_requests is
  'Hashed, short-lived request records used only to rate-limit Basil account emails. Browser roles have no access.';
