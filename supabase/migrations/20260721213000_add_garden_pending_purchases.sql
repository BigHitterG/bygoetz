create table if not exists public.garden_pending_purchases (
  id uuid primary key default gen_random_uuid(),
  claim_token_hash text not null unique,
  launch_session_id uuid,
  preview jsonb not null default '{"careBalance":0,"plants":[],"paths":[]}'::jsonb,
  stripe_session_id text unique,
  stripe_customer_id text,
  stripe_payment_id text,
  buyer_email text,
  status text not null default 'checkout_created',
  paid_at timestamptz,
  activation_started_at timestamptz,
  activation_sent_at timestamptz,
  claimed_user_id uuid references auth.users(id) on delete set null,
  last_error text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_pending_purchases_claim_hash_format check (
    claim_token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint garden_pending_purchases_preview_object check (
    jsonb_typeof(preview) = 'object' and pg_column_size(preview) <= 16384
  ),
  constraint garden_pending_purchases_status_check check (
    status in ('checkout_created', 'paid', 'activating', 'activation_sent', 'claimed', 'failed')
  ),
  constraint garden_pending_purchases_email_length check (
    buyer_email is null or char_length(buyer_email) between 3 and 254
  ),
  constraint garden_pending_purchases_error_length check (
    last_error is null or char_length(last_error) <= 500
  )
);

create index if not exists garden_pending_purchases_created_idx
  on public.garden_pending_purchases (created_at desc);

create index if not exists garden_pending_purchases_status_expires_idx
  on public.garden_pending_purchases (status, expires_at);

create index if not exists garden_pending_purchases_launch_idx
  on public.garden_pending_purchases (launch_session_id)
  where launch_session_id is not null;

alter table public.garden_pending_purchases enable row level security;

revoke all on table public.garden_pending_purchases from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_pending_purchases to service_role;

comment on table public.garden_pending_purchases is
  'Server-only, short-lived Basil checkout handoff. Preserves a guest My Garden preview before Stripe and makes post-payment restoration independent of browser storage.';

comment on column public.garden_pending_purchases.buyer_email is
  'Private Stripe checkout email used only to provision the purchased Basil account; never exposed through public database grants.';
