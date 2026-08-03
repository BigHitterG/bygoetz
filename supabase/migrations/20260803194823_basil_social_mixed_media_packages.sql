create or replace function public.approve_basil_social_story(p_story_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset_kind text;
  v_required_channels text[];
  v_variant_count integer;
  v_updated_count integer;
begin
  select story.asset_kind
  into v_asset_kind
  from public.basil_social_stories as story
  where story.id = p_story_id
    and story.status = 'ready'
    and story.rank between 1 and 3
  for update;

  if not found then
    raise exception 'This bulletin is not ready for approval.' using errcode = 'P0001';
  end if;

  if v_asset_kind = 'video' then
    v_required_channels := array['instagram', 'youtube', 'reddit'];
    if not exists (
      select 1 from public.basil_social_assets as asset
      where asset.story_id = p_story_id and asset.kind = 'video' and asset.validation_status = 'valid'
    ) or not exists (
      select 1 from public.basil_social_assets as asset
      where asset.story_id = p_story_id and asset.kind = 'poster' and asset.validation_status = 'valid'
    ) then
      raise exception 'A validated MP4 and poster are required before approval.' using errcode = 'P0001';
    end if;
  elsif v_asset_kind = 'image' then
    v_required_channels := array['instagram', 'reddit'];
    if not exists (
      select 1 from public.basil_social_assets as asset
      where asset.story_id = p_story_id and asset.kind = 'image' and asset.validation_status = 'valid'
    ) then
      raise exception 'A validated diagram is required before approval.' using errcode = 'P0001';
    end if;
  else
    raise exception 'This bulletin has an unsupported asset type.' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_variant_count
  from public.basil_social_variants as variant
  where variant.story_id = p_story_id
    and variant.channel = any(v_required_channels)
    and variant.status in ('draft', 'failed', 'manual_ready');

  if v_variant_count <> array_length(v_required_channels, 1)
    or exists (
      select 1 from public.basil_social_variants as variant
      where variant.story_id = p_story_id
        and variant.channel = any(v_required_channels)
        and variant.status not in ('draft', 'failed', 'manual_ready')
    )
    or exists (
      select 1 from public.basil_social_variants as variant
      where variant.story_id = p_story_id
        and not (variant.channel = any(v_required_channels))
        and variant.status <> 'published'
    ) then
    raise exception 'The saved channel drafts do not match this content package.' using errcode = 'P0001';
  end if;

  update public.basil_social_variants
  set status = 'manual_ready',
      approved_at = coalesce(approved_at, now()),
      last_error = null,
      updated_at = now()
  where story_id = p_story_id
    and channel = any(v_required_channels)
    and status in ('draft', 'failed', 'manual_ready');

  get diagnostics v_updated_count = row_count;
  return jsonb_build_object('story_id', p_story_id, 'approved', v_updated_count, 'asset_kind', v_asset_kind);
end;
$$;

revoke all on function public.approve_basil_social_story(uuid) from public, anon, authenticated;
grant execute on function public.approve_basil_social_story(uuid) to service_role;
