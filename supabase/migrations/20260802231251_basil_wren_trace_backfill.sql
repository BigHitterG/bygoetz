insert into public.basil_agent_action_traces (
  agent_id,
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
)
select
  profile.id,
  action.action_id,
  action.action_type,
  'community_garden',
  action.created_at,
  action.completed_at,
  jsonb_build_object('gridX', action.grid_x - 2, 'gridY', action.grid_y + 2),
  jsonb_build_array(
    jsonb_build_object('gridX', action.grid_x - 2, 'gridY', action.grid_y + 2, 'phase', 'approach'),
    jsonb_build_object('gridX', action.grid_x, 'gridY', action.grid_y, 'phase', 'action')
  ),
  jsonb_build_object(
    'gridX', action.grid_x,
    'gridY', action.grid_y,
    'regionX', action.region_x,
    'regionY', action.region_y,
    'targetPlantId', action.target_plant_id
  ),
  jsonb_build_object(
    'affectedCount', action.affected_count,
    'careAwarded', action.care_awarded,
    'heritagePlantIds', action.heritage_plant_ids
  ),
  jsonb_build_object('source', 'historical_founding_steward_action', 'actionId', action.action_id),
  jsonb_build_object('source', 'historical_founding_steward_action', 'actionId', action.action_id, 'status', action.status),
  jsonb_build_array(
    jsonb_build_object('name', 'action_completed', 'expected', true, 'actual', true)
  ),
  action.affected_count > 0,
  case when action.affected_count > 0 then 'ready' else 'unavailable' end
from public.community_garden_founding_steward_actions action
join public.basil_agent_profiles profile
  on profile.founding_steward_id = action.steward_id
where action.steward_id = 3
  and action.status = 'success'
  and action.created_at >= now() - interval '30 days'
on conflict (founding_steward_action_id) where founding_steward_action_id is not null do nothing;
