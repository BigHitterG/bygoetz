insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'basil-social-evergreen',
  'basil-social-evergreen',
  false,
  104857600,
  array['video/mp4', 'image/jpeg', 'image/png', 'application/json']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.basil_social_evergreen_collections (
  id uuid primary key default gen_random_uuid(),
  collection_key text not null unique,
  collection_type text not null,
  title text not null,
  species_slug text,
  scientific_name text,
  source_story_id uuid references public.basil_social_stories(id) on delete set null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basil_social_evergreen_collection_key_check
    check (collection_key ~ '^[a-z0-9][a-z0-9/_-]{2,159}$'),
  constraint basil_social_evergreen_collection_type_check
    check (collection_type in ('botanical_lifecycle', 'diagram', 'game_mechanic')),
  constraint basil_social_evergreen_collection_title_check
    check (char_length(title) between 1 and 180),
  constraint basil_social_evergreen_collection_manifest_check
    check (jsonb_typeof(manifest) = 'object')
);

create table public.basil_social_evergreen_assets (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.basil_social_evergreen_collections(id) on delete cascade,
  asset_key text not null,
  asset_role text not null,
  version integer not null default 1,
  is_current boolean not null default true,
  stage_index integer,
  stage_key text,
  bucket_id text not null default 'basil-social-evergreen',
  object_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  sha256 text not null,
  width integer,
  height integer,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (collection_id, asset_key, version),
  unique (bucket_id, object_path),
  constraint basil_social_evergreen_asset_key_check
    check (asset_key ~ '^[a-z0-9][a-z0-9._-]{1,119}$'),
  constraint basil_social_evergreen_asset_role_check
    check (asset_role in (
      'keyframe', 'alternate_keyframe', 'final_video', 'poster', 'diagram',
      'species_profile', 'production_manifest', 'caption_timing'
    )),
  constraint basil_social_evergreen_asset_version_check check (version between 1 and 10000),
  constraint basil_social_evergreen_stage_index_check check (stage_index is null or stage_index between 0 and 100),
  constraint basil_social_evergreen_asset_path_check check (char_length(object_path) between 3 and 700),
  constraint basil_social_evergreen_asset_filename_check check (char_length(original_filename) between 1 and 255),
  constraint basil_social_evergreen_asset_mime_check check (char_length(mime_type) between 3 and 120),
  constraint basil_social_evergreen_asset_size_check check (byte_size between 1 and 104857600),
  constraint basil_social_evergreen_asset_sha_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint basil_social_evergreen_asset_width_check check (width is null or width between 1 and 7680),
  constraint basil_social_evergreen_asset_height_check check (height is null or height between 1 and 7680),
  constraint basil_social_evergreen_asset_duration_check check (duration_ms is null or duration_ms between 1 and 900000),
  constraint basil_social_evergreen_asset_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create unique index basil_social_evergreen_assets_current_idx
  on public.basil_social_evergreen_assets (collection_id, asset_key)
  where is_current;
create index basil_social_evergreen_assets_collection_stage_idx
  on public.basil_social_evergreen_assets (collection_id, stage_index, asset_role, created_at);

create table public.basil_social_evergreen_transfer_tokens (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.basil_social_evergreen_collections(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  max_uploads integer not null,
  used_count integer not null default 0,
  exhausted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint basil_social_evergreen_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint basil_social_evergreen_token_count_check check (max_uploads between 1 and 100),
  constraint basil_social_evergreen_token_used_check check (used_count between 0 and max_uploads)
);

create index basil_social_evergreen_transfer_tokens_lookup_idx
  on public.basil_social_evergreen_transfer_tokens (collection_id, expires_at desc)
  where exhausted_at is null;

alter table public.basil_social_evergreen_collections enable row level security;
alter table public.basil_social_evergreen_assets enable row level security;
alter table public.basil_social_evergreen_transfer_tokens enable row level security;

revoke all on table public.basil_social_evergreen_collections from public, anon, authenticated;
revoke all on table public.basil_social_evergreen_assets from public, anon, authenticated;
revoke all on table public.basil_social_evergreen_transfer_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_social_evergreen_collections to service_role;
grant select, insert, update, delete on table public.basil_social_evergreen_assets to service_role;
grant select, insert, update, delete on table public.basil_social_evergreen_transfer_tokens to service_role;

create or replace function public.issue_basil_social_evergreen_transfer_token(
  p_collection_id uuid,
  p_max_uploads integer
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  if p_max_uploads not between 1 and 100 then
    raise exception 'Evergreen upload count must be between 1 and 100.';
  end if;
  if not exists (
    select 1 from public.basil_social_evergreen_collections where id = p_collection_id
  ) then
    raise exception 'Evergreen collection not found.';
  end if;
  delete from public.basil_social_evergreen_transfer_tokens
  where expires_at < now() - interval '1 day'
     or exhausted_at < now() - interval '1 day';
  secret := encode(gen_random_bytes(32), 'hex');
  insert into public.basil_social_evergreen_transfer_tokens (
    collection_id, token_hash, expires_at, max_uploads
  ) values (
    p_collection_id,
    encode(digest(secret, 'sha256'), 'hex'),
    now() + interval '30 minutes',
    p_max_uploads
  );
  return secret;
end;
$$;

create or replace function public.claim_basil_social_evergreen_transfer_token(
  p_collection_id uuid,
  p_token text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  claimed_id uuid;
begin
  update public.basil_social_evergreen_transfer_tokens
  set used_count = used_count + 1,
      exhausted_at = case when used_count + 1 >= max_uploads then now() else null end
  where collection_id = p_collection_id
    and token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and expires_at > now()
    and exhausted_at is null
    and used_count < max_uploads
  returning id into claimed_id;
  return claimed_id is not null;
end;
$$;

revoke all on function public.issue_basil_social_evergreen_transfer_token(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_basil_social_evergreen_transfer_token(uuid, text)
  from public, anon, authenticated;
grant execute on function public.issue_basil_social_evergreen_transfer_token(uuid, integer)
  to service_role;
grant execute on function public.claim_basil_social_evergreen_transfer_token(uuid, text)
  to service_role;

comment on table public.basil_social_evergreen_collections is
  'Private durable collections for reusable Basil lifecycle source media and finished social assets.';
comment on table public.basil_social_evergreen_assets is
  'Immutable content-addressed evergreen keyframes, manifests, diagrams, posters, and final videos.';
comment on table public.basil_social_evergreen_transfer_tokens is
  'Short-lived, collection-scoped upload capabilities for Codex scheduled tasks without local service keys.';

