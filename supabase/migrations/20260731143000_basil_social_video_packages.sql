insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'basil-social-assets',
  'basil-social-assets',
  false,
  104857600,
  array['video/mp4', 'image/jpeg', 'image/png', 'audio/wav']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.basil_social_assets (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.basil_social_stories(id) on delete cascade,
  kind text not null,
  bucket_id text not null default 'basil-social-assets',
  object_path text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  duration_ms integer,
  sha256 text not null,
  validation_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  constraint basil_social_asset_kind_check check (kind in ('video', 'poster', 'image', 'audio')),
  constraint basil_social_asset_mime_length check (char_length(mime_type) between 3 and 120),
  constraint basil_social_asset_path_length check (char_length(object_path) between 3 and 700),
  constraint basil_social_asset_size_check check (byte_size between 1 and 104857600),
  constraint basil_social_asset_width_check check (width is null or width between 1 and 7680),
  constraint basil_social_asset_height_check check (height is null or height between 1 and 7680),
  constraint basil_social_asset_duration_check check (duration_ms is null or duration_ms between 1 and 600000),
  constraint basil_social_asset_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint basil_social_asset_validation_check check (validation_status in ('pending', 'valid', 'invalid')),
  constraint basil_social_asset_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.basil_social_feedback (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references public.basil_social_digests(id) on delete cascade,
  story_id uuid not null references public.basil_social_stories(id) on delete cascade,
  feedback text not null,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint basil_social_feedback_length check (char_length(feedback) between 2 and 2000),
  constraint basil_social_feedback_status_check check (status in ('queued', 'resolved', 'dismissed'))
);

create index basil_social_assets_story_kind_idx
  on public.basil_social_assets (story_id, kind, created_at desc);
create index basil_social_feedback_digest_story_idx
  on public.basil_social_feedback (digest_id, story_id, created_at desc);

alter table public.basil_social_assets enable row level security;
alter table public.basil_social_feedback enable row level security;

revoke all on table public.basil_social_assets from public, anon, authenticated;
revoke all on table public.basil_social_feedback from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_social_assets to service_role;
grant select, insert, update, delete on table public.basil_social_feedback to service_role;

comment on table public.basil_social_assets is
  'Private validated video packages and poster assets for token-gated Basil Social Studio review.';
comment on table public.basil_social_feedback is
  'Creator revision requests captured from the private Social Studio review flow.';
