begin;

-- Covers the ON DELETE SET NULL lookup for audited steward targets. The other
-- steward foreign keys are already covered by the run/steward composite keys.
create index if not exists community_garden_founding_steward_actions_target_idx
  on public.community_garden_founding_steward_actions (target_plant_id)
  where target_plant_id is not null;

commit;
