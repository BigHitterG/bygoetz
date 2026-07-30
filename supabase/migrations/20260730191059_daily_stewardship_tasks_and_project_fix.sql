-- Keep Community Stewardship to three calm daily task slots, and permanently
-- record the project-id ambiguity repair that was first applied as a live
-- production hotfix.

create or replace function public.assign_garden_task_v1(
  p_steward_id uuid,
  p_slot smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen public.garden_task_templates%rowtype;
  assignment_id uuid;
begin
  if p_slot not between 1 and 3 or exists (
    select 1
    from public.garden_task_assignments assignment
    where assignment.steward_id = p_steward_id
      and assignment.slot = p_slot
      and assignment.status = 'active'
  ) then
    return null;
  end if;

  select template.* into chosen
  from public.garden_task_templates template
  where template.active
    and (p_slot <> 1 or template.slot_group = 'basic')
    and (p_slot <> 2 or template.slot_group in ('basic', 'community'))
    and not exists (
      select 1
      from public.garden_task_assignments current_assignment
      where current_assignment.steward_id = p_steward_id
        and current_assignment.status = 'active'
        and current_assignment.template_key = template.template_key
    )
    and (template.metric <> 'active_days' or not exists (
      select 1
      from public.garden_task_assignments current_assignment
      join public.garden_task_templates other
        on other.template_key = current_assignment.template_key
      where current_assignment.steward_id = p_steward_id
        and current_assignment.status = 'active'
        and other.metric = 'active_days'
    ))
    and (template.conditional_key is distinct from 'weeds' or (
      select count(*)
      from public.community_garden_weeds weed
      where weed.expires_at > now()
    ) >= template.target)
    and (template.conditional_key is distinct from 'other_flowers' or (
      select count(*)
      from public.community_garden_roses rose
      where rose.contributor_kind = 'account'
        and rose.heritage_at is null
    ) >= template.target)
    and (template.conditional_key is distinct from 'growth_ring' or exists (
      select 1
      from public.community_garden_regions region
      where region.land_state in ('founding', 'established')
    ))
    and (template.conditional_key is distinct from 'diverse_patch' or (
      select count(distinct rose.plant_type)
      from public.community_garden_roses rose
    ) >= 3)
  order by
    exists (
      select 1
      from public.garden_task_assignments recent_assignment
      where recent_assignment.steward_id = p_steward_id
        and recent_assignment.template_key = template.template_key
        and recent_assignment.completed_at > now() - interval '48 hours'
    ),
    md5(
      p_steward_id::text || ':' || p_slot::text || ':' ||
      coalesce((
        select profile.tasks_completed::text
        from public.garden_stewardship_profiles profile
        where profile.steward_id = p_steward_id
      ), '0') || ':' || template.template_key
    )
  limit 1;

  if chosen.template_key is null then
    return null;
  end if;

  insert into public.garden_task_assignments (
    steward_id,
    slot,
    template_key,
    target,
    state
  ) values (
    p_steward_id,
    p_slot,
    chosen.template_key,
    chosen.target,
    jsonb_build_object('values', '[]'::jsonb)
  )
  returning id into assignment_id;

  return assignment_id;
end;
$$;

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
    if not exists (
      select 1
      from public.garden_task_assignments assignment
      where assignment.steward_id = p_steward_id
        and assignment.slot = slot_number
        and (
          assignment.status = 'active'
          or (
            assignment.status = 'completed'
            and assignment.completed_at >= current_date::timestamptz
            and assignment.completed_at < (current_date + 1)::timestamptz
          )
        )
    ) then
      perform public.assign_garden_task_v1(p_steward_id, slot_number::smallint);
    end if;
  end loop;
end;
$$;

create or replace function public.record_garden_stewardship_action_v1(
  p_action_id uuid,
  p_actor_key text,
  p_action_type text,
  p_grid_x integer,
  p_grid_y integer,
  p_plant_type text,
  p_plant_ids uuid[],
  p_result jsonb,
  p_guidance_zone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_steward_id uuid;
  inserted_count integer;
  anchor_x integer := p_grid_x;
  anchor_y integer := p_grid_y;
  region_x smallint;
  region_y smallint;
  affected integer := 0;
  other_affected integer := 0;
  patch_varieties integer := 0;
  patch_plants integer := 0;
  assignment record;
  values_json jsonb;
  next_state jsonb;
  next_progress integer;
  current_project_id uuid;
  current_project public.garden_community_projects%rowtype;
begin
  if p_action_type not in ('plant', 'water', 'weed') then
    return null;
  end if;

  select steward.id into resolved_steward_id
  from public.community_garden_account_actors mapping
  join public.garden_stewards steward on steward.user_id = mapping.user_id
  join public.garden_entitlements entitlement
    on entitlement.steward_id = steward.id
    and entitlement.product_key = 'basil_founding_gardener'
    and entitlement.status = 'active'
  where mapping.actor_key = p_actor_key
  limit 1;

  if resolved_steward_id is null then
    return null;
  end if;

  perform public.ensure_garden_tasks_v1(resolved_steward_id);

  if anchor_x is null or anchor_y is null then
    select rose.grid_x, rose.grid_y into anchor_x, anchor_y
    from jsonb_array_elements(coalesce(p_result -> 'plants', '[]'::jsonb)) item
    join public.community_garden_roses rose on rose.id::text = item ->> 'id'
    limit 1;
  end if;

  if anchor_x is not null and anchor_y is not null then
    region_x := floor(anchor_x::numeric / 16)::smallint;
    region_y := floor(anchor_y::numeric / 16)::smallint;
    select count(*), count(distinct rose.plant_type)
      into patch_plants, patch_varieties
    from public.community_garden_roses rose
    where rose.grid_x between anchor_x - 2 and anchor_x + 2
      and rose.grid_y between anchor_y - 2 and anchor_y + 2
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now());
  end if;

  affected := case
    when p_action_type = 'weed' then 1
    else jsonb_array_length(coalesce(p_result -> 'plants', '[]'::jsonb))
  end;

  if p_action_type = 'water' then
    select count(*)::integer into other_affected
    from jsonb_array_elements(coalesce(p_result -> 'plants', '[]'::jsonb)) item
    join public.community_garden_roses rose on rose.id::text = item ->> 'id'
    where rose.contributor_key <> p_actor_key;
  end if;

  insert into public.garden_stewardship_action_events (
    action_id,
    steward_id,
    action_type,
    region_x,
    region_y,
    guidance_zone,
    affected_count,
    other_affected_count
  ) values (
    p_action_id,
    resolved_steward_id,
    p_action_type,
    region_x,
    region_y,
    p_guidance_zone,
    affected,
    other_affected
  )
  on conflict (action_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return public.get_garden_stewardship_summary_v1(resolved_steward_id);
  end if;

  insert into public.garden_stewardship_active_days (steward_id, activity_date)
  values (resolved_steward_id, current_date)
  on conflict do nothing;

  for assignment in
    select assignment_row.*, template.metric, template.category,
      template.title, template.description
    from public.garden_task_assignments assignment_row
    join public.garden_task_templates template
      on template.template_key = assignment_row.template_key
    where assignment_row.steward_id = resolved_steward_id
      and assignment_row.status = 'active'
    order by assignment_row.slot
    for update of assignment_row
  loop
    next_progress := assignment.progress;
    next_state := assignment.state;
    values_json := coalesce(assignment.state -> 'values', '[]'::jsonb);

    if assignment.metric = 'plant_count' and p_action_type = 'plant' then
      next_progress := next_progress + greatest(1, affected);
    elsif assignment.metric = 'variety_count' and p_action_type = 'plant' and p_plant_type is not null then
      if not values_json @> jsonb_build_array(p_plant_type) then
        values_json := values_json || jsonb_build_array(p_plant_type);
      end if;
      next_state := jsonb_set(next_state, '{values}', values_json, true);
      next_progress := jsonb_array_length(values_json);
    elsif assignment.metric = 'watering_rounds' and p_action_type = 'water' then
      next_progress := next_progress + 1;
    elsif assignment.metric = 'flowers_watered' and p_action_type = 'water' then
      next_progress := next_progress + affected;
    elsif assignment.metric = 'other_flowers_watered' and p_action_type = 'water' then
      next_progress := next_progress + other_affected;
    elsif assignment.metric = 'regions' and region_x is not null then
      if not values_json @> jsonb_build_array(region_x::text || ':' || region_y::text) then
        values_json := values_json || jsonb_build_array(region_x::text || ':' || region_y::text);
      end if;
      next_state := jsonb_set(next_state, '{values}', values_json, true);
      next_progress := jsonb_array_length(values_json);
    elsif assignment.metric = 'growth_ring_plants'
      and p_action_type = 'plant'
      and p_guidance_zone = 'growth-ring' then
      next_progress := next_progress + greatest(1, affected);
    elsif assignment.metric = 'diverse_patch_actions'
      and patch_plants >= 6
      and patch_varieties >= 3 then
      next_progress := next_progress + 1;
    elsif assignment.metric = 'weeds' and p_action_type = 'weed' then
      next_progress := next_progress + 1;
    elsif assignment.metric = 'active_days' then
      if not values_json @> jsonb_build_array(current_date::text) then
        values_json := values_json || jsonb_build_array(current_date::text);
      end if;
      next_state := jsonb_set(next_state, '{values}', values_json, true);
      next_progress := jsonb_array_length(values_json);
    end if;

    next_progress := least(assignment.target, next_progress);
    if next_progress is distinct from assignment.progress
      or next_state is distinct from assignment.state then
      update public.garden_task_assignments
      set progress = next_progress,
          state = next_state
      where id = assignment.id;
    end if;

    if next_progress >= assignment.target then
      update public.garden_task_assignments
      set status = 'completed',
          completed_at = now()
      where id = assignment.id;

      update public.garden_stewardship_profiles
      set tasks_completed = tasks_completed + 1,
          updated_at = now()
      where steward_id = resolved_steward_id;

      insert into public.garden_stewardship_categories (
        steward_id,
        category,
        tasks_completed
      ) values (
        resolved_steward_id,
        assignment.category,
        1
      )
      on conflict (steward_id, category) do update
      set tasks_completed = public.garden_stewardship_categories.tasks_completed + 1,
          updated_at = now();

      insert into public.garden_stewardship_accolades (
        steward_id,
        assignment_id,
        accolade_key,
        title,
        description
      ) values (
        resolved_steward_id,
        assignment.id,
        assignment.template_key,
        assignment.title,
        assignment.description
      );

      insert into public.garden_stewardship_notifications (
        steward_id,
        notification_type,
        payload
      ) values (
        resolved_steward_id,
        'task_complete',
        jsonb_build_object(
          'assignmentId', assignment.id,
          'title', assignment.title,
          'description', assignment.description,
          'category', assignment.category
        )
      );
      -- The slot deliberately remains completed until tomorrow. Ordinary
      -- gameplay can therefore produce at most three task notices per day.
    end if;
  end loop;

  current_project_id := public.ensure_current_garden_project_v1();
  select * into current_project
  from public.garden_community_projects project_row
  where project_row.id = current_project_id
  for update;

  if current_project.completed_at is null
    and current_project.ends_at > now()
    and current_project.metric = p_action_type then
    insert into public.garden_community_project_progress (
      project_id,
      steward_id,
      progress
    ) values (
      current_project_id,
      resolved_steward_id,
      greatest(1, affected)
    )
    on conflict (project_id, steward_id) do update
    set progress = public.garden_community_project_progress.progress + excluded.progress,
        updated_at = now();

    update public.garden_community_projects
    set global_progress = global_progress + greatest(1, affected)
    where id = current_project_id;

    select * into current_project
    from public.garden_community_projects project_row
    where project_row.id = current_project_id
    for update;

    if current_project.global_progress >= current_project.global_target and (
      select count(*)
      from public.garden_community_project_progress project_progress
      where project_progress.project_id = current_project.id
        and project_progress.progress > 0
    ) >= 2 then
      update public.garden_community_projects
      set completed_at = now()
      where id = current_project.id
        and completed_at is null;

      with credited as (
        update public.garden_community_project_progress progress
        set credited_at = now()
        where progress.project_id = current_project.id
          and progress.credited_at is null
          and progress.progress >= current_project.personal_target
        returning progress.steward_id
      )
      update public.garden_stewardship_profiles profile
      set community_projects_completed = profile.community_projects_completed + 1,
          updated_at = now()
      from credited
      where profile.steward_id = credited.steward_id;

      insert into public.garden_stewardship_notifications (
        steward_id,
        notification_type,
        payload
      )
      select progress.steward_id,
        'project_complete',
        jsonb_build_object(
          'title', current_project.title,
          'projectKey', current_project.project_key
        )
      from public.garden_community_project_progress progress
      where progress.project_id = current_project.id
        and progress.credited_at is not null;
    end if;
  end if;

  perform public.refresh_garden_stewardship_rank_v1(resolved_steward_id);
  return public.get_garden_stewardship_summary_v1(resolved_steward_id);
end;
$$;

create or replace function public.get_garden_stewardship_summary_v1(p_steward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.garden_stewardship_profiles%rowtype;
  actor_key text;
  active_days integer;
  categories integer;
  living_count integer;
  current_project_id uuid;
  recent jsonb;
  oldest jsonb;
  cluster jsonb;
  flowers jsonb;
begin
  perform public.ensure_garden_tasks_v1(p_steward_id);
  select * into profile
  from public.garden_stewardship_profiles profile_row
  where profile_row.steward_id = p_steward_id;
  if not found then return null; end if;

  select mapping.actor_key into actor_key
  from public.garden_stewards steward
  join public.community_garden_account_actors mapping
    on mapping.user_id = steward.user_id
  where steward.id = p_steward_id;

  select count(*)::integer into active_days
  from public.garden_stewardship_active_days active_day
  where active_day.steward_id = p_steward_id;

  select count(*)::integer into categories
  from public.garden_stewardship_categories category
  where category.steward_id = p_steward_id
    and category.tasks_completed > 0;

  if actor_key is not null then
    select count(*)::integer into living_count
    from public.community_garden_roses rose
    where rose.contributor_key = actor_key
      and rose.heritage_at is null
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now())
      and (rose.guest_expires_at is null or rose.guest_expires_at > now());

    select jsonb_build_object(
      'gridX', rose.grid_x,
      'gridY', rose.grid_y,
      'plantId', rose.id
    ) into recent
    from public.community_garden_roses rose
    where rose.contributor_key = actor_key
      and rose.heritage_at is null
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now())
      and (rose.guest_expires_at is null or rose.guest_expires_at > now())
    order by rose.created_at desc, rose.id desc
    limit 1;

    select jsonb_build_object(
      'gridX', rose.grid_x,
      'gridY', rose.grid_y,
      'plantId', rose.id
    ) into oldest
    from public.community_garden_roses rose
    where rose.contributor_key = actor_key
      and rose.heritage_at is null
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now())
      and (rose.guest_expires_at is null or rose.guest_expires_at > now())
    order by rose.created_at, rose.id
    limit 1;

    select jsonb_build_object(
      'gridX', round(avg(rose.grid_x))::integer,
      'gridY', round(avg(rose.grid_y))::integer,
      'count', count(*)
    ) into cluster
    from public.community_garden_roses rose
    where rose.contributor_key = actor_key
      and rose.heritage_at is null
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now())
      and (rose.guest_expires_at is null or rose.guest_expires_at > now())
    group by rose.region_x, rose.region_y
    order by count(*) desc
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'gridX', rose.grid_x,
      'gridY', rose.grid_y,
      'plantId', rose.id
    )), '[]'::jsonb) into flowers
    from public.community_garden_roses rose
    where rose.contributor_key = actor_key
      and rose.heritage_at is null
      and (rose.succession_at is null or rose.succession_at > now())
      and (rose.absolute_expires_at is null or rose.absolute_expires_at > now())
      and (rose.guest_expires_at is null or rose.guest_expires_at > now());
  else
    living_count := 0;
    flowers := '[]'::jsonb;
  end if;

  current_project_id := public.ensure_current_garden_project_v1();

  return jsonb_build_object(
    'rankKey', profile.rank_key,
    'capacity', profile.ordinary_footprint_capacity,
    'tasksCompleted', profile.tasks_completed,
    'activeDays', active_days,
    'categoriesCompleted', categories,
    'communityProjectsCompleted', profile.community_projects_completed,
    'replacementAvailableAt', case
      when profile.last_task_replacement_at is null then null
      else profile.last_task_replacement_at + interval '24 hours'
    end,
    'flowers', jsonb_build_object(
      'living', living_count,
      'coordinates', coalesce(flowers, '[]'::jsonb),
      'recent', recent,
      'oldest', oldest,
      'mainCluster', cluster
    ),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', task.id,
        'slot', task.slot,
        'templateKey', task.template_key,
        'category', template.category,
        'title', template.title,
        'description', template.description,
        'progress', task.progress,
        'target', task.target,
        'status', task.status,
        'completedAt', task.completed_at
      ) order by task.slot)
      from (
        select distinct on (assignment.slot) assignment.*
        from public.garden_task_assignments assignment
        where assignment.steward_id = p_steward_id
          and (
            assignment.status = 'active'
            or (
              assignment.status = 'completed'
              and assignment.completed_at >= current_date::timestamptz
              and assignment.completed_at < (current_date + 1)::timestamptz
            )
          )
        order by assignment.slot,
          case when assignment.status = 'active' then 0 else 1 end,
          assignment.completed_at desc nulls first
      ) task
      join public.garden_task_templates template
        on template.template_key = task.template_key
    ), '[]'::jsonb),
    'recentAccolades', coalesce((
      select jsonb_agg(item.value order by item.earned_at desc)
      from (
        select jsonb_build_object(
          'id', accolade.id,
          'title', accolade.title,
          'description', accolade.description,
          'earnedAt', accolade.earned_at
        ) value,
        accolade.earned_at
        from public.garden_stewardship_accolades accolade
        where accolade.steward_id = p_steward_id
        order by accolade.earned_at desc
        limit 12
      ) item
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', notification.id,
        'type', notification.notification_type,
        'payload', notification.payload,
        'createdAt', notification.created_at
      ) order by notification.created_at)
      from public.garden_stewardship_notifications notification
      where notification.steward_id = p_steward_id
        and notification.acknowledged_at is null
    ), '[]'::jsonb),
    'project', (
      select jsonb_build_object(
        'id', project.id,
        'title', project.title,
        'description', project.description,
        'globalProgress', least(project.global_progress, project.global_target),
        'globalTarget', project.global_target,
        'personalProgress', least(coalesce(progress.progress, 0), project.personal_target),
        'personalTarget', project.personal_target,
        'completed', project.completed_at is not null,
        'endsAt', project.ends_at
      )
      from public.garden_community_projects project
      left join public.garden_community_project_progress progress
        on progress.project_id = project.id
        and progress.steward_id = p_steward_id
      where project.id = current_project_id
    )
  );
end;
$$;

revoke all on function public.assign_garden_task_v1(uuid, smallint)
  from public, anon, authenticated;
revoke all on function public.ensure_garden_tasks_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.record_garden_stewardship_action_v1(
  uuid, text, text, integer, integer, text, uuid[], jsonb, text
) from public, anon, authenticated;
revoke all on function public.get_garden_stewardship_summary_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.record_garden_stewardship_action_v1(
  uuid, text, text, integer, integer, text, uuid[], jsonb, text
) to service_role;
grant execute on function public.get_garden_stewardship_summary_v1(uuid)
  to service_role;
