create table if not exists public.garden_stewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  garden_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_stewards_name_length check (char_length(garden_name) between 3 and 64)
);

alter table public.garden_stewards enable row level security;

revoke all on table public.garden_stewards from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_stewards to service_role;

comment on table public.garden_stewards is
  'Private Basil account records. Accounts use Supabase email authentication; no public profile or player ownership is created.';

create table if not exists public.garden_entitlements (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  product_key text not null default 'basil_founding_gardener',
  provider text not null,
  provider_purchase_id text not null,
  provider_customer_id text,
  provider_payment_id text,
  amount_paid_cents integer,
  currency text,
  status text not null default 'active',
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_entitlements_provider_purchase_unique unique (provider, provider_purchase_id),
  constraint garden_entitlements_product_length check (char_length(product_key) between 3 and 80),
  constraint garden_entitlements_provider_length check (char_length(provider) between 2 and 40),
  constraint garden_entitlements_amount_positive check (
    amount_paid_cents is null or amount_paid_cents >= 0
  ),
  constraint garden_entitlements_currency_format check (
    currency is null or currency ~ '^[a-z]{3}$'
  ),
  constraint garden_entitlements_status_check check (
    status in ('active', 'refunded', 'revoked', 'expired')
  )
);

create index if not exists garden_entitlements_steward_status_idx
  on public.garden_entitlements (steward_id, product_key, status);

alter table public.garden_entitlements enable row level security;

revoke all on table public.garden_entitlements from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_entitlements to service_role;

comment on table public.garden_entitlements is
  'Provider-neutral Basil purchase grants. Stripe is first; verified Steam, Netflix Games, Facebook, or manual grants can attach to the same private account later.';

create table if not exists public.garden_upgrade_candidates (
  key text primary key,
  title text not null,
  category text not null,
  description text not null,
  impact_score integer not null default 3,
  effort_score integer not null default 3,
  privacy_safe boolean not null default true,
  equality_safe boolean not null default true,
  status text not null default 'candidate',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_upgrade_candidates_impact_check check (impact_score between 1 and 5),
  constraint garden_upgrade_candidates_effort_check check (effort_score between 1 and 5),
  constraint garden_upgrade_candidates_status_check check (
    status in ('candidate', 'selected', 'building', 'shipped', 'declined')
  )
);

alter table public.garden_upgrade_candidates enable row level security;

revoke all on table public.garden_upgrade_candidates from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_upgrade_candidates to service_role;

insert into public.garden_upgrade_candidates
  (key, title, category, description, impact_score, effort_score)
values
  ('new_global_plant', 'New plant for everyone', 'plants', 'Release an additional plant through a shared garden update without paid gameplay advantage.', 4, 3),
  ('care_interactions', 'More ways to care', 'care', 'Add a small shared-care interaction that gives visitors a reason to return.', 5, 3),
  ('shareable_coordinates', 'Shareable garden locations', 'exploration', 'Let visitors share a link that opens near a specific garden patch.', 4, 3),
  ('almanac_expansion', 'Expand the Almanac', 'almanac', 'Add useful aggregate garden history and progress without player tracking.', 3, 2),
  ('accessibility', 'Accessibility improvement', 'accessibility', 'Improve controls, contrast, reduced motion, keyboard use, or screen reader context.', 5, 2),
  ('community_milestones', 'Community milestones', 'care', 'Add shared goals that release something for the whole garden.', 5, 3),
  ('since_last_visit', 'Since your last visit', 'almanac', 'Show aggregate changes since the visitor last opened the garden using local state.', 5, 2),
  ('performance', 'Garden performance', 'other', 'Improve loading, rendering, network use, or reliability.', 4, 2)
on conflict (key) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  impact_score = excluded.impact_score,
  effort_score = excluded.effort_score,
  updated_at = now();

comment on table public.garden_upgrade_candidates is
  'A constrained practical backlog for reviewing Basil feedback. Raw feedback must never directly trigger a production deployment.';

create table if not exists public.garden_feedback (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  category text not null,
  message text not null,
  status text not null default 'received',
  matched_candidate_key text references public.garden_upgrade_candidates(key) on delete set null,
  internal_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_feedback_category_check check (
    category in ('plants', 'care', 'exploration', 'almanac', 'accessibility', 'other')
  ),
  constraint garden_feedback_message_length check (char_length(message) between 1 and 280),
  constraint garden_feedback_status_check check (
    status in ('received', 'shortlisted', 'planned', 'shipped', 'declined')
  ),
  constraint garden_feedback_score_check check (internal_score is null or internal_score between 1 and 100)
);

create index if not exists garden_feedback_steward_created_idx
  on public.garden_feedback (steward_id, created_at desc);

create index if not exists garden_feedback_status_created_idx
  on public.garden_feedback (status, created_at desc);

create index if not exists garden_feedback_candidate_idx
  on public.garden_feedback (matched_candidate_key)
  where matched_candidate_key is not null;

alter table public.garden_feedback enable row level security;

revoke all on table public.garden_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_feedback to service_role;

comment on table public.garden_feedback is
  'Private Founding Gardener ideas for a human-reviewed Codex upgrade queue. Text is untrusted input and is never public by default.';
