begin;

-- Wren is a service-owned Basil steward, never a fabricated auth.users row.
alter table public.garden_stewards
  alter column user_id drop not null;

alter table public.garden_stewards
  add column if not exists account_kind text not null default 'human',
  add column if not exists agent_code text,
  add column if not exists founding_steward_id smallint references public.community_garden_founding_stewards(steward_id) on delete set null;

alter table public.garden_stewards
  drop constraint if exists garden_stewards_identity_check;

alter table public.garden_stewards
  add constraint garden_stewards_identity_check check (
    (account_kind = 'human' and user_id is not null and agent_code is null and founding_steward_id is null)
    or
    (account_kind = 'system_agent' and user_id is null and agent_code is not null and founding_steward_id is not null)
  );

alter table public.garden_stewards
  drop constraint if exists garden_stewards_account_kind_check;

alter table public.garden_stewards
  add constraint garden_stewards_account_kind_check
    check (account_kind in ('human', 'system_agent'));

create unique index if not exists garden_stewards_agent_code_unique
  on public.garden_stewards (agent_code)
  where agent_code is not null;

create unique index if not exists garden_stewards_founding_agent_unique
  on public.garden_stewards (founding_steward_id)
  where founding_steward_id is not null;

insert into public.garden_stewards (
  user_id,
  garden_name,
  account_kind,
  agent_code,
  founding_steward_id
)
select null, 'Wren''s Garden', 'system_agent', 'wren', 3
where not exists (
  select 1 from public.garden_stewards where agent_code = 'wren'
);

insert into public.garden_entitlements (
  steward_id,
  product_key,
  provider,
  provider_purchase_id,
  amount_paid_cents,
  currency,
  status
)
select
  steward.id,
  'basil_founding_gardener',
  'basil_system',
  'basil-system-agent-wren',
  0,
  'usd',
  'active'
from public.garden_stewards steward
where steward.agent_code = 'wren'
on conflict (provider, provider_purchase_id) do update set
  steward_id = excluded.steward_id,
  status = 'active',
  updated_at = now();

create table public.basil_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  disclosure_label text not null,
  disclosure_text text not null,
  autonomy_tier smallint not null default 0,
  planner_mode text not null default 'codex_scheduled',
  enabled boolean not null default true,
  public_profile_enabled boolean not null default false,
  garden_steward_id uuid not null unique references public.garden_stewards(id) on delete restrict,
  founding_steward_id smallint not null unique references public.community_garden_founding_stewards(steward_id) on delete restrict,
  appearance_key text not null default 'wren',
  persona_version text not null default 'wren-v1',
  voice_config jsonb not null default '{}'::jsonb,
  public_bio text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basil_agent_profiles_code_check check (code ~ '^[a-z][a-z0-9_-]{2,31}$'),
  constraint basil_agent_profiles_name_check check (char_length(display_name) between 2 and 40),
  constraint basil_agent_profiles_disclosure_label_check check (char_length(disclosure_label) between 4 and 80),
  constraint basil_agent_profiles_disclosure_check check (char_length(disclosure_text) between 20 and 600),
  constraint basil_agent_profiles_autonomy_check check (autonomy_tier between 0 and 3),
  constraint basil_agent_profiles_planner_check check (planner_mode in ('deterministic', 'codex_scheduled', 'external_api')),
  constraint basil_agent_profiles_voice_object check (jsonb_typeof(voice_config) = 'object'),
  constraint basil_agent_profiles_bio_check check (char_length(public_bio) between 20 and 1200)
);

create table public.basil_agent_missions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.basil_agent_profiles(id) on delete cascade,
  mission_date date not null,
  run_key text not null,
  objective text not null,
  scope text not null,
  planner_mode text not null,
  planner_version text not null,
  autonomy_tier smallint not null,
  status text not null default 'planned',
  plan jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  truth_basis jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, run_key),
  constraint basil_agent_missions_run_key_check check (char_length(run_key) between 8 and 80),
  constraint basil_agent_missions_objective_check check (char_length(objective) between 3 and 500),
  constraint basil_agent_missions_scope_check check (scope in ('community_garden', 'my_garden', 'mixed')),
  constraint basil_agent_missions_planner_check check (planner_mode in ('deterministic', 'codex_scheduled', 'external_api')),
  constraint basil_agent_missions_autonomy_check check (autonomy_tier between 0 and 3),
  constraint basil_agent_missions_status_check check (status in ('planned', 'validated', 'executing', 'completed', 'partial', 'rejected', 'cancelled')),
  constraint basil_agent_missions_plan_object check (jsonb_typeof(plan) = 'object'),
  constraint basil_agent_missions_constraints_object check (jsonb_typeof(constraints) = 'object'),
  constraint basil_agent_missions_truth_object check (jsonb_typeof(truth_basis) = 'object')
);

create table public.basil_agent_decisions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.basil_agent_missions(id) on delete cascade,
  sequence smallint not null,
  action_type text not null,
  target jsonb not null default '{}'::jsonb,
  rationale text not null,
  expected_outcome text not null,
  policy_status text not null default 'pending',
  policy_reasons jsonb not null default '[]'::jsonb,
  founding_steward_action_id uuid references public.community_garden_founding_steward_actions(action_id) on delete set null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (mission_id, sequence),
  constraint basil_agent_decisions_sequence_check check (sequence between 1 and 500),
  constraint basil_agent_decisions_action_check check (action_type in ('walk', 'plant', 'water', 'weed', 'builder', 'inspect', 'wait')),
  constraint basil_agent_decisions_target_object check (jsonb_typeof(target) = 'object'),
  constraint basil_agent_decisions_rationale_check check (char_length(rationale) between 3 and 1000),
  constraint basil_agent_decisions_outcome_check check (char_length(expected_outcome) between 3 and 1000),
  constraint basil_agent_decisions_policy_check check (policy_status in ('pending', 'allowed', 'rejected')),
  constraint basil_agent_decisions_policy_reasons_array check (jsonb_typeof(policy_reasons) = 'array'),
  constraint basil_agent_decisions_status_check check (status in ('planned', 'queued', 'running', 'completed', 'failed', 'skipped'))
);

create table public.basil_agent_action_traces (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.basil_agent_profiles(id) on delete cascade,
  mission_id uuid references public.basil_agent_missions(id) on delete set null,
  decision_id uuid references public.basil_agent_decisions(id) on delete set null,
  founding_steward_action_id uuid references public.community_garden_founding_steward_actions(action_id) on delete set null,
  action_type text not null,
  scope text not null,
  plant_type text,
  started_at timestamptz not null,
  completed_at timestamptz,
  start_position jsonb not null default '{}'::jsonb,
  movement_path jsonb not null default '[]'::jsonb,
  target jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  snapshot_before jsonb not null default '{}'::jsonb,
  snapshot_after jsonb not null default '{}'::jsonb,
  checkpoints jsonb not null default '[]'::jsonb,
  capture_eligible boolean not null default false,
  replay_status text not null default 'unavailable',
  created_at timestamptz not null default now(),
  constraint basil_agent_traces_action_check check (action_type in ('walk', 'plant', 'water', 'weed', 'builder', 'inspect', 'wait')),
  constraint basil_agent_traces_scope_check check (scope in ('community_garden', 'my_garden')),
  constraint basil_agent_traces_start_object check (jsonb_typeof(start_position) = 'object'),
  constraint basil_agent_traces_path_array check (jsonb_typeof(movement_path) = 'array'),
  constraint basil_agent_traces_target_object check (jsonb_typeof(target) = 'object'),
  constraint basil_agent_traces_result_object check (jsonb_typeof(result) = 'object'),
  constraint basil_agent_traces_before_object check (jsonb_typeof(snapshot_before) = 'object'),
  constraint basil_agent_traces_after_object check (jsonb_typeof(snapshot_after) = 'object'),
  constraint basil_agent_traces_checkpoints_array check (jsonb_typeof(checkpoints) = 'array'),
  constraint basil_agent_traces_replay_check check (replay_status in ('unavailable', 'ready', 'rendered', 'invalid'))
);

create table public.basil_agent_diary_entries (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.basil_agent_profiles(id) on delete cascade,
  mission_id uuid references public.basil_agent_missions(id) on delete set null,
  entry_date date not null,
  episode_number integer not null,
  title text not null,
  summary text not null,
  narration text not null,
  facts jsonb not null default '{}'::jsonb,
  source_action_ids uuid[] not null default '{}'::uuid[],
  social_story_id uuid references public.basil_social_stories(id) on delete set null,
  review_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, episode_number),
  constraint basil_agent_diary_episode_check check (episode_number > 0),
  constraint basil_agent_diary_title_check check (char_length(title) between 1 and 180),
  constraint basil_agent_diary_summary_check check (char_length(summary) between 1 and 1200),
  constraint basil_agent_diary_narration_check check (char_length(narration) between 1 and 4000),
  constraint basil_agent_diary_facts_object check (jsonb_typeof(facts) = 'object'),
  constraint basil_agent_diary_review_check check (review_status in ('draft', 'review_ready', 'approved', 'published', 'archived'))
);

create table public.basil_agent_garden_snapshots (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.basil_agent_profiles(id) on delete cascade,
  scope text not null,
  version bigint not null,
  captured_at timestamptz not null default now(),
  state jsonb not null,
  source_action_ids uuid[] not null default '{}'::uuid[],
  constraint basil_agent_snapshots_scope_check check (scope in ('community_garden', 'my_garden')),
  constraint basil_agent_snapshots_version_check check (version >= 0),
  constraint basil_agent_snapshots_state_object check (jsonb_typeof(state) = 'object'),
  unique (agent_id, scope, version)
);

insert into public.basil_agent_profiles (
  code,
  display_name,
  disclosure_label,
  disclosure_text,
  autonomy_tier,
  planner_mode,
  enabled,
  public_profile_enabled,
  garden_steward_id,
  founding_steward_id,
  appearance_key,
  persona_version,
  voice_config,
  public_bio
)
select
  'wren',
  'Wren',
  'WREN · AI GARDEN STEWARD',
  'Wren is an AI-directed Basil garden steward. Codex selects daily missions; Basil''s server rules validate and log every action.',
  2,
  'codex_scheduled',
  true,
  false,
  steward.id,
  3,
  'wren',
  'wren-v1',
  '{"style":"calm","narrationRequired":false}'::jsonb,
  'Wren is a transparent AI-directed creature living in Basil. Wren tends the shared garden, develops a persistent My Garden, records each decision, and turns verified garden work into a daily field diary.'
from public.garden_stewards steward
where steward.agent_code = 'wren'
on conflict (code) do update set
  display_name = excluded.display_name,
  disclosure_label = excluded.disclosure_label,
  disclosure_text = excluded.disclosure_text,
  autonomy_tier = excluded.autonomy_tier,
  planner_mode = excluded.planner_mode,
  garden_steward_id = excluded.garden_steward_id,
  founding_steward_id = excluded.founding_steward_id,
  appearance_key = excluded.appearance_key,
  persona_version = excluded.persona_version,
  voice_config = excluded.voice_config,
  public_bio = excluded.public_bio,
  updated_at = now();

alter table public.basil_social_stories
  add column if not exists agent_profile_id uuid references public.basil_agent_profiles(id) on delete set null,
  add column if not exists agent_mission_id uuid references public.basil_agent_missions(id) on delete set null,
  add column if not exists autonomy_tier smallint,
  add column if not exists agent_disclosure text,
  add column if not exists content_lane text,
  add column if not exists creative_hypothesis text,
  add column if not exists capture_provenance jsonb not null default '{}'::jsonb;

alter table public.basil_social_stories
  add constraint basil_social_story_autonomy_check check (autonomy_tier is null or autonomy_tier between 0 and 3),
  add constraint basil_social_story_disclosure_check check (agent_disclosure is null or char_length(agent_disclosure) between 4 and 600),
  add constraint basil_social_story_lane_check check (content_lane is null or content_lane in ('agent_diary', 'field_footage', 'experiment', 'garden_status', 'founder_context')),
  add constraint basil_social_story_hypothesis_check check (creative_hypothesis is null or char_length(creative_hypothesis) between 3 and 1000),
  add constraint basil_social_story_capture_object check (jsonb_typeof(capture_provenance) = 'object');

alter table public.basil_social_metrics
  add column if not exists chose_to_view_rate numeric(7,4),
  add column if not exists average_percentage_viewed numeric(7,3),
  add column if not exists completion_rate numeric(7,4),
  add column if not exists replay_rate numeric(7,4),
  add column if not exists profile_actions bigint not null default 0,
  add column if not exists game_starts bigint not null default 0,
  add column if not exists first_flowers_planted bigint not null default 0,
  add column if not exists follower_delta bigint not null default 0;

alter table public.basil_social_metrics
  add constraint basil_social_metric_rate_check check (
    (chose_to_view_rate is null or chose_to_view_rate between 0 and 1)
    and (average_percentage_viewed is null or average_percentage_viewed between 0 and 1000)
    and (completion_rate is null or completion_rate between 0 and 1)
    and (replay_rate is null or replay_rate between 0 and 10)
  ),
  add constraint basil_social_metric_agent_funnel_check check (
    profile_actions >= 0 and game_starts >= 0 and first_flowers_planted >= 0
  );

create index basil_agent_missions_agent_date_idx
  on public.basil_agent_missions (agent_id, mission_date desc, created_at desc);
create index basil_agent_decisions_mission_sequence_idx
  on public.basil_agent_decisions (mission_id, sequence);
create index basil_agent_traces_agent_started_idx
  on public.basil_agent_action_traces (agent_id, started_at desc);
create index basil_agent_traces_capture_idx
  on public.basil_agent_action_traces (capture_eligible, started_at desc)
  where capture_eligible;
create unique index basil_agent_traces_founding_action_unique
  on public.basil_agent_action_traces (founding_steward_action_id)
  where founding_steward_action_id is not null;
create index basil_agent_diary_agent_date_idx
  on public.basil_agent_diary_entries (agent_id, entry_date desc);
create index basil_agent_snapshots_agent_scope_idx
  on public.basil_agent_garden_snapshots (agent_id, scope, version desc);

alter table public.basil_agent_profiles enable row level security;
alter table public.basil_agent_missions enable row level security;
alter table public.basil_agent_decisions enable row level security;
alter table public.basil_agent_action_traces enable row level security;
alter table public.basil_agent_diary_entries enable row level security;
alter table public.basil_agent_garden_snapshots enable row level security;

revoke all on table public.basil_agent_profiles from public, anon, authenticated;
revoke all on table public.basil_agent_missions from public, anon, authenticated;
revoke all on table public.basil_agent_decisions from public, anon, authenticated;
revoke all on table public.basil_agent_action_traces from public, anon, authenticated;
revoke all on table public.basil_agent_diary_entries from public, anon, authenticated;
revoke all on table public.basil_agent_garden_snapshots from public, anon, authenticated;

grant select, insert, update, delete on table public.basil_agent_profiles to service_role;
grant select, insert, update, delete on table public.basil_agent_missions to service_role;
grant select, insert, update, delete on table public.basil_agent_decisions to service_role;
grant select, insert, update, delete on table public.basil_agent_action_traces to service_role;
grant select, insert, update, delete on table public.basil_agent_diary_entries to service_role;
grant select, insert, update, delete on table public.basil_agent_garden_snapshots to service_role;

create or replace function public.sync_basil_wren_action_trace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_agent_id uuid;
  resolved_mission_id uuid;
begin
  if new.steward_id <> 3 or new.status <> 'success' then
    return new;
  end if;

  select profile.id
    into resolved_agent_id
  from public.basil_agent_profiles profile
  where profile.code = 'wren' and profile.enabled
  limit 1;

  if resolved_agent_id is null then
    return new;
  end if;

  select mission.id
    into resolved_mission_id
  from public.basil_agent_missions mission
  where mission.agent_id = resolved_agent_id
    and mission.mission_date = (new.created_at at time zone 'America/Chicago')::date
    and mission.status in ('validated', 'executing', 'completed', 'partial')
  order by mission.created_at desc
  limit 1;

  insert into public.basil_agent_action_traces (
    agent_id,
    mission_id,
    founding_steward_action_id,
    action_type,
    scope,
    started_at,
    completed_at,
    start_position,
    movement_path,
    target,
    result,
    snapshot_before,
    snapshot_after,
    checkpoints,
    capture_eligible,
    replay_status
  ) values (
    resolved_agent_id,
    resolved_mission_id,
    new.action_id,
    new.action_type,
    'community_garden',
    new.created_at,
    new.completed_at,
    jsonb_build_object('gridX', new.grid_x - 2, 'gridY', new.grid_y + 2),
    jsonb_build_array(
      jsonb_build_object('gridX', new.grid_x - 2, 'gridY', new.grid_y + 2, 'phase', 'approach'),
      jsonb_build_object('gridX', new.grid_x, 'gridY', new.grid_y, 'phase', 'action')
    ),
    jsonb_build_object(
      'gridX', new.grid_x,
      'gridY', new.grid_y,
      'regionX', new.region_x,
      'regionY', new.region_y,
      'targetPlantId', new.target_plant_id
    ),
    jsonb_build_object(
      'affectedCount', new.affected_count,
      'careAwarded', new.care_awarded,
      'heritagePlantIds', new.heritage_plant_ids
    ),
    jsonb_build_object('source', 'founding_steward_action', 'actionId', new.action_id),
    jsonb_build_object('source', 'founding_steward_action', 'actionId', new.action_id, 'status', new.status),
    jsonb_build_array(
      jsonb_build_object('name', 'action_completed', 'expected', true, 'actual', true)
    ),
    new.affected_count > 0,
    case when new.affected_count > 0 then 'ready' else 'unavailable' end
  )
  on conflict (founding_steward_action_id) where founding_steward_action_id is not null do update set
    mission_id = coalesce(excluded.mission_id, public.basil_agent_action_traces.mission_id),
    completed_at = excluded.completed_at,
    result = excluded.result,
    snapshot_after = excluded.snapshot_after,
    checkpoints = excluded.checkpoints,
    capture_eligible = excluded.capture_eligible,
    replay_status = excluded.replay_status;

  return new;
end;
$$;

drop trigger if exists sync_basil_wren_action_trace_after_write
  on public.community_garden_founding_steward_actions;

create trigger sync_basil_wren_action_trace_after_write
after insert or update of status, affected_count, care_awarded, heritage_plant_ids
on public.community_garden_founding_steward_actions
for each row execute function public.sync_basil_wren_action_trace();

revoke all on function public.sync_basil_wren_action_trace() from public, anon, authenticated;
grant execute on function public.sync_basil_wren_action_trace() to service_role;

comment on table public.basil_agent_profiles is
  'Private identities and autonomy disclosures for Basil system agents. No browser receives service credentials.';
comment on table public.basil_agent_missions is
  'Codex-scheduled or future external-planner missions. Basil policy validation remains authoritative.';
comment on table public.basil_agent_decisions is
  'Auditable proposed decisions. Narration cannot directly execute an action.';
comment on table public.basil_agent_action_traces is
  'Replay-safe provenance for real system-agent actions and social capture.';
comment on table public.basil_agent_diary_entries is
  'Evidence-backed agent narration and episode continuity.';
comment on table public.basil_agent_garden_snapshots is
  'Private versioned snapshots used for before/after validation and deterministic replay.';

commit;
