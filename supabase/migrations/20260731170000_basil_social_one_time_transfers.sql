create table public.basil_social_transfer_tokens (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.basil_social_stories(id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint basil_social_transfer_purpose_check check (purpose in ('upload', 'download')),
  constraint basil_social_transfer_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint basil_social_transfer_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '30 minutes')
);

create index basil_social_transfer_story_created_idx
  on public.basil_social_transfer_tokens (story_id, created_at desc);
create index basil_social_transfer_expiry_idx
  on public.basil_social_transfer_tokens (expires_at)
  where used_at is null;

alter table public.basil_social_transfer_tokens enable row level security;
revoke all on table public.basil_social_transfer_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.basil_social_transfer_tokens to service_role;

create or replace function public.issue_basil_social_transfer_token(
  p_story_id uuid,
  p_purpose text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  if p_purpose not in ('upload', 'download') then
    raise exception 'Invalid Basil social transfer purpose.';
  end if;
  if not exists (select 1 from public.basil_social_stories where id = p_story_id) then
    raise exception 'Basil Social Studio story not found.';
  end if;
  delete from public.basil_social_transfer_tokens
    where expires_at < now() - interval '1 day'
       or used_at < now() - interval '1 day';
  secret := encode(gen_random_bytes(32), 'hex');
  insert into public.basil_social_transfer_tokens (story_id, purpose, token_hash, expires_at)
  values (p_story_id, p_purpose, encode(digest(secret, 'sha256'), 'hex'), now() + interval '15 minutes');
  return secret;
end;
$$;

create or replace function public.claim_basil_social_transfer_token(
  p_story_id uuid,
  p_purpose text,
  p_token text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  claimed_id uuid;
begin
  if p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update public.basil_social_transfer_tokens
  set used_at = now()
  where story_id = p_story_id
    and purpose = p_purpose
    and token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  returning id into claimed_id;
  return claimed_id is not null;
end;
$$;

create or replace function public.record_basil_social_publication(
  p_variant_id uuid,
  p_published_url text,
  p_external_id text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recorded_id uuid;
begin
  if p_published_url !~ '^https://' or char_length(p_published_url) > 2000 then
    return false;
  end if;
  update public.basil_social_variants
  set status = 'published',
      published_at = now(),
      published_url = p_published_url,
      external_id = nullif(left(coalesce(p_external_id, ''), 300), ''),
      last_error = null,
      updated_at = now()
  where id = p_variant_id
    and status = 'manual_ready'
  returning id into recorded_id;
  return recorded_id is not null;
end;
$$;

revoke all on function public.issue_basil_social_transfer_token(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_basil_social_transfer_token(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_basil_social_publication(uuid, text, text) from public, anon, authenticated;
grant execute on function public.issue_basil_social_transfer_token(uuid, text) to service_role;
grant execute on function public.claim_basil_social_transfer_token(uuid, text, text) to service_role;
grant execute on function public.record_basil_social_publication(uuid, text, text) to service_role;

comment on table public.basil_social_transfer_tokens is
  'Short-lived, one-use capabilities for moving approved Basil social assets without exposing the service key.';
