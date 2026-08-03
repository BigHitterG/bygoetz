begin;

-- Preserve the Wren experiment and its audit history, but remove it from the
-- active Basil product and Social Studio workflow until it is resumed as a
-- separately scoped project.
update public.basil_agent_profiles
set enabled = false,
    public_profile_enabled = false,
    autonomy_tier = 0,
    planner_mode = 'deterministic',
    updated_at = now()
where code = 'wren';

update public.basil_agent_missions
set status = 'cancelled',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
where agent_id = (
  select id
  from public.basil_agent_profiles
  where code = 'wren'
)
and status in ('planned', 'validated', 'executing', 'partial');

update public.basil_agent_decisions as decision
set status = 'skipped'
where decision.status in ('planned', 'queued', 'running')
and exists (
  select 1
  from public.basil_agent_missions as mission
  join public.basil_agent_profiles as profile
    on profile.id = mission.agent_id
  where mission.id = decision.mission_id
    and profile.code = 'wren'
);

drop trigger if exists sync_basil_wren_action_trace_after_write
  on public.community_garden_founding_steward_actions;

commit;
