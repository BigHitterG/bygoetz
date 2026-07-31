alter table public.basil_social_feedback
  alter column story_id drop not null;

comment on column public.basil_social_feedback.story_id is
  'Null means the creator feedback applies to the full daily three-video package.';

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
          and story.rank between 1 and 3
          and story.status = 'ready'
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

revoke all on function public.guard_basil_social_manual_approval() from public, anon, authenticated;
grant execute on function public.guard_basil_social_manual_approval() to service_role;

comment on function public.guard_basil_social_manual_approval() is
  'Allows only the three validated daily videos and their YouTube, Instagram, and Reddit adaptations into the posting queue.';
