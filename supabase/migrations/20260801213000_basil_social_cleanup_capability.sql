alter table public.basil_social_transfer_tokens
  drop constraint basil_social_transfer_purpose_check;

alter table public.basil_social_transfer_tokens
  add constraint basil_social_transfer_purpose_check
  check (purpose in ('upload', 'download', 'notify', 'cleanup'));

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
  if p_purpose not in ('upload', 'download', 'notify', 'cleanup') then
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

revoke all on function public.issue_basil_social_transfer_token(uuid, text)
  from public, anon, authenticated;
grant execute on function public.issue_basil_social_transfer_token(uuid, text)
  to service_role;

comment on constraint basil_social_transfer_purpose_check
  on public.basil_social_transfer_tokens is
  'One-time capabilities may upload, download, notify, or remove the private assets for one Social Studio story.';

