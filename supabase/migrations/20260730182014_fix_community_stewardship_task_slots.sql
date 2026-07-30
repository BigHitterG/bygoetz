begin;

-- Integer FOR loops produce an integer value even when the loop variable is
-- declared smallint. Cast the bounded 1..3 slot explicitly before calling the
-- assignment helper.
create or replace function public.ensure_garden_tasks_v1(p_steward_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_number integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_steward_id::text, 8311)
  );
  perform public.ensure_garden_stewardship_profile_v1(p_steward_id);
  for slot_number in 1..3 loop
    perform public.assign_garden_task_v1(p_steward_id, slot_number::smallint);
  end loop;
end;
$$;

-- Cover the foreign-key paths reported by the performance advisor for the
-- Community Stewardship tables introduced in the preceding migration.
create index if not exists garden_community_project_progress_steward_idx
  on public.garden_community_project_progress (steward_id, project_id);

create index if not exists garden_stewardship_accolades_assignment_idx
  on public.garden_stewardship_accolades (assignment_id)
  where assignment_id is not null;

create index if not exists garden_task_assignments_template_idx
  on public.garden_task_assignments (template_key);

commit;
