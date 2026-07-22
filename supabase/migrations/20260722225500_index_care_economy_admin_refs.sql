create index if not exists community_garden_economy_settings_updated_by_idx
  on public.community_garden_economy_settings (updated_by)
  where updated_by is not null;

create index if not exists community_garden_economy_audit_changed_by_idx
  on public.community_garden_economy_audit (changed_by)
  where changed_by is not null;
