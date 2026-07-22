create table public.garden_newsletter_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  steward_id uuid not null unique references public.garden_stewards(id) on delete cascade,
  subscribed boolean not null default false,
  resend_contact_id text,
  subscribed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_newsletter_contact_id_length check (
    resend_contact_id is null or char_length(resend_contact_id) between 1 and 120
  )
);

create table public.garden_newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  title text not null,
  subject text not null,
  preview_text text not null,
  html_body text not null,
  text_body text not null,
  stats jsonb not null,
  status text not null default 'review_ready',
  approval_token_hash text not null unique,
  approval_expires_at timestamptz not null,
  review_email_id text,
  review_email_sent_at timestamptz,
  resend_broadcast_id text unique,
  approved_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_newsletter_period_key_length check (char_length(period_key) between 7 and 40),
  constraint garden_newsletter_title_length check (char_length(title) between 1 and 160),
  constraint garden_newsletter_subject_length check (char_length(subject) between 1 and 180),
  constraint garden_newsletter_preview_length check (char_length(preview_text) between 1 and 240),
  constraint garden_newsletter_html_length check (char_length(html_body) between 1 and 100000),
  constraint garden_newsletter_text_length check (char_length(text_body) between 1 and 30000),
  constraint garden_newsletter_stats_object check (jsonb_typeof(stats) = 'object'),
  constraint garden_newsletter_status_check check (
    status in ('review_ready', 'sending', 'sent', 'failed')
  ),
  constraint garden_newsletter_token_hash_check check (
    approval_token_hash ~ '^[0-9a-f]{64}$'
  )
);

create index garden_newsletter_preferences_subscribed_idx
  on public.garden_newsletter_preferences (updated_at desc)
  where subscribed;

create index garden_newsletter_issues_status_created_idx
  on public.garden_newsletter_issues (status, created_at desc);

alter table public.garden_newsletter_preferences enable row level security;
alter table public.garden_newsletter_issues enable row level security;

revoke all on table public.garden_newsletter_preferences from public, anon, authenticated;
revoke all on table public.garden_newsletter_issues from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_newsletter_preferences to service_role;
grant select, insert, update, delete on table public.garden_newsletter_issues to service_role;

comment on table public.garden_newsletter_preferences is
  'Private, explicit Basil monthly-letter consent. Email addresses remain in Supabase Auth and Resend rather than this table.';
comment on table public.garden_newsletter_issues is
  'Server-only immutable monthly garden snapshots and review/send state. Approval tokens are stored only as SHA-256 hashes.';

create or replace function public.get_basil_newsletter_stats()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'measuredAt', now(),
    'communityFlowers', (select count(*) from public.community_garden_roses),
    'roses', (select count(*) from public.community_garden_roses where plant_type = 'rose'),
    'sunflowers', (select count(*) from public.community_garden_roses where plant_type = 'sunflower'),
    'lavender', (select count(*) from public.community_garden_roses where plant_type = 'lavender'),
    'weeds', (select count(*) from public.community_garden_weeds),
    'gardenMembers', (
      select count(distinct steward_id)
      from public.garden_entitlements
      where status = 'active'
    ),
    'personalGardenFlowers', (select count(*) from public.garden_personal_plants),
    'careSharedThisMonth', (
      select coalesce(sum(greatest(care_delta, 0)), 0)
      from public.garden_care_ledger
      where created_at >= date_trunc('month', now())
    )
  );
$$;

revoke all on function public.get_basil_newsletter_stats() from public, anon, authenticated;
grant execute on function public.get_basil_newsletter_stats() to service_role;

comment on function public.get_basil_newsletter_stats() is
  'Returns aggregate, non-identifying garden statistics for the private monthly newsletter draft job.';
