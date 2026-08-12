create table if not exists public.garden_house_accolades (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  display_key text not null,
  category text not null,
  title text not null,
  description text not null,
  tier smallint not null default 0,
  progress integer not null default 0,
  target integer not null default 0,
  earned_at timestamptz,
  updated_at timestamptz not null default now(),
  inspected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key (steward_id, display_key),
  constraint garden_house_accolades_display_key_check check (
    display_key in (
      'stewardship',
      'tasks',
      'habitats',
      'heritage',
      'collections',
      'calendar',
      'property',
      'community',
      'worms'
    )
  ),
  constraint garden_house_accolades_category_check check (
    category in ('service', 'nature', 'collection', 'history', 'community')
  ),
  constraint garden_house_accolades_nonnegative_check check (
    tier >= 0 and progress >= 0 and target >= 0
  ),
  constraint garden_house_accolades_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists garden_house_accolades_updated_idx
  on public.garden_house_accolades (steward_id, updated_at desc);

alter table public.garden_house_accolades enable row level security;

revoke all on table public.garden_house_accolades from public, anon, authenticated;
grant select, insert, update, delete on table public.garden_house_accolades to service_role;

comment on table public.garden_house_accolades is
  'Server-maintained, normalized Hall of Growth displays for each Basil steward.';
comment on column public.garden_house_accolades.metadata is
  'Display-specific supporting statistics. Read and written only by trusted server routes.';
