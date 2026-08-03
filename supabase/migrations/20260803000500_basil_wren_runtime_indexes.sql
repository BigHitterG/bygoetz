begin;

create index if not exists basil_agent_traces_decision_idx
  on public.basil_agent_action_traces (decision_id)
  where decision_id is not null;

create index if not exists basil_agent_traces_mission_idx
  on public.basil_agent_action_traces (mission_id)
  where mission_id is not null;

create index if not exists basil_agent_care_ledger_steward_idx
  on public.basil_agent_care_ledger (steward_id);

create index if not exists basil_agent_decisions_founding_action_idx
  on public.basil_agent_decisions (founding_steward_action_id)
  where founding_steward_action_id is not null;

create index if not exists basil_agent_diary_mission_idx
  on public.basil_agent_diary_entries (mission_id)
  where mission_id is not null;

create index if not exists basil_agent_diary_social_story_idx
  on public.basil_agent_diary_entries (social_story_id)
  where social_story_id is not null;

update public.basil_agent_profiles
set public_profile_enabled = true,
    updated_at = now()
where code = 'wren';

commit;
