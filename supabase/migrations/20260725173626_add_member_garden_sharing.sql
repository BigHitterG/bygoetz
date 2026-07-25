create table public.garden_public_snapshots (
  id uuid primary key default gen_random_uuid(),
  share_token text not null unique,
  steward_id uuid not null
    references public.garden_stewards(id)
    on delete cascade,
  scope text not null,
  storage_path text not null unique,
  image_width integer not null default 1200,
  image_height integer not null default 630,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint garden_public_snapshots_token_check
    check (
      char_length(share_token) between 20 and 64
      and share_token ~ '^[A-Za-z0-9_-]+$'
    ),
  constraint garden_public_snapshots_scope_check
    check (scope in ('whole', 'current')),
  constraint garden_public_snapshots_dimensions_check
    check (
      image_width between 320 and 2400
      and image_height between 240 and 2400
    )
);

create index garden_public_snapshots_steward_created_idx
  on public.garden_public_snapshots (steward_id, created_at desc);

create index garden_public_snapshots_active_created_idx
  on public.garden_public_snapshots (created_at desc)
  where revoked_at is null;

alter table public.garden_public_snapshots enable row level security;

revoke all on table public.garden_public_snapshots
  from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_public_snapshots
  to service_role;

comment on table public.garden_public_snapshots is
  'Private ownership records for immutable, anonymous My Garden social snapshots. Public reads are mediated by token-aware server routes.';
comment on column public.garden_public_snapshots.share_token is
  'Random unguessable public locator containing no user or account identifier.';
comment on column public.garden_public_snapshots.storage_path is
  'Private Supabase Storage object path; never exposed directly to clients.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'basil-garden-shares',
  'basil-garden-shares',
  false,
  2500000,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
