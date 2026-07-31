create or replace function public.guard_basil_social_manual_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'manual_ready' and old.status is distinct from 'manual_ready' then
    if old.channel not in ('youtube', 'instagram', 'reddit')
      or not exists (
        select 1
        from public.basil_social_stories story
        where story.id = old.story_id
          and story.rank = 1
      )
      or not exists (
        select 1
        from public.basil_social_assets asset
        where asset.story_id = old.story_id
          and asset.kind = 'video'
          and asset.validation_status = 'valid'
      )
    then
      return null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists basil_social_manual_approval_guard
  on public.basil_social_variants;

create trigger basil_social_manual_approval_guard
before update on public.basil_social_variants
for each row execute function public.guard_basil_social_manual_approval();

revoke all on function public.guard_basil_social_manual_approval() from public, anon, authenticated;
grant execute on function public.guard_basil_social_manual_approval() to service_role;

comment on function public.guard_basil_social_manual_approval() is
  'Allows the daily posting queue to receive only the primary validated video adaptations for YouTube, Instagram, and Reddit.';
