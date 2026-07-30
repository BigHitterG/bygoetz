begin;

-- Avoid a PL/pgSQL variable/column collision in the community-project join.
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
  result jsonb;
begin
  perform public.ensure_garden_tasks_v1(p_steward_id);
  select * into profile
  from public.garden_stewardship_profiles
  where steward_id=p_steward_id;
  if not found then return null; end if;

  select mapping.actor_key into actor_key
  from public.garden_stewards steward
  join public.community_garden_account_actors mapping on mapping.user_id=steward.user_id
  where steward.id=p_steward_id;

  select count(*)::integer into active_days
  from public.garden_stewardship_active_days
  where steward_id=p_steward_id;

  select count(*)::integer into categories
  from public.garden_stewardship_categories
  where steward_id=p_steward_id and tasks_completed>0;

  if actor_key is not null then
    select count(*)::integer into living_count
    from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now());

    select jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id) into recent
    from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
    order by created_at desc,id desc limit 1;

    select jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id) into oldest
    from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
    order by created_at,id limit 1;

    select jsonb_build_object(
      'gridX',round(avg(grid_x))::integer,
      'gridY',round(avg(grid_y))::integer,
      'count',count(*)
    ) into cluster
    from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
    group by region_x,region_y order by count(*) desc limit 1;

    select coalesce(
      jsonb_agg(jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id)),
      '[]'::jsonb
    ) into flowers
    from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now());
  else
    living_count:=0;
    flowers:='[]'::jsonb;
  end if;

  current_project_id:=public.ensure_current_garden_project_v1();

  result:=jsonb_build_object(
    'rankKey',profile.rank_key,
    'capacity',profile.ordinary_footprint_capacity,
    'tasksCompleted',profile.tasks_completed,
    'activeDays',active_days,
    'categoriesCompleted',categories,
    'communityProjectsCompleted',profile.community_projects_completed,
    'replacementAvailableAt',case
      when profile.last_task_replacement_at is null then null
      else profile.last_task_replacement_at+interval '24 hours'
    end,
    'flowers',jsonb_build_object(
      'living',living_count,
      'coordinates',coalesce(flowers,'[]'::jsonb),
      'recent',recent,
      'oldest',oldest,
      'mainCluster',cluster
    ),
    'tasks',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'slot',a.slot,
        'templateKey',a.template_key,
        'category',t.category,
        'title',t.title,
        'description',t.description,
        'progress',a.progress,
        'target',a.target
      ) order by a.slot)
      from public.garden_task_assignments a
      join public.garden_task_templates t on t.template_key=a.template_key
      where a.steward_id=p_steward_id and a.status='active'
    ),'[]'::jsonb),
    'recentAccolades',coalesce((
      select jsonb_agg(item.value order by item.earned_at desc)
      from (
        select jsonb_build_object(
          'id',id,
          'title',title,
          'description',description,
          'earnedAt',earned_at
        ) value,earned_at
        from public.garden_stewardship_accolades
        where steward_id=p_steward_id
        order by earned_at desc limit 12
      ) item
    ),'[]'::jsonb),
    'notifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'type',notification_type,
        'payload',payload,
        'createdAt',created_at
      ) order by created_at)
      from public.garden_stewardship_notifications
      where steward_id=p_steward_id and acknowledged_at is null
    ),'[]'::jsonb),
    'project',(
      select jsonb_build_object(
        'id',project.id,
        'title',project.title,
        'description',project.description,
        'globalProgress',least(project.global_progress,project.global_target),
        'globalTarget',project.global_target,
        'personalProgress',least(coalesce(progress.progress,0),project.personal_target),
        'personalTarget',project.personal_target,
        'completed',project.completed_at is not null,
        'endsAt',project.ends_at
      )
      from public.garden_community_projects project
      left join public.garden_community_project_progress progress
        on progress.project_id=project.id and progress.steward_id=p_steward_id
      where project.id=current_project_id
    )
  );
  return result;
end;
$$;

commit;
