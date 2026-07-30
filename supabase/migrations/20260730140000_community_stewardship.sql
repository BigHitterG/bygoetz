begin;

-- Community Stewardship turns ordinary, server-confirmed Community Garden
-- actions into short tasks, durable accolades, rank, and a larger trailing
-- ordinary-flower footprint. All ownership and progress remain private.

create table if not exists public.garden_stewardship_profiles (
  steward_id uuid primary key references public.garden_stewards(id) on delete cascade,
  rank_key text not null default 'gardener',
  ordinary_footprint_capacity smallint not null default 100,
  tasks_completed integer not null default 0,
  community_projects_completed integer not null default 0,
  last_task_replacement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_stewardship_rank_check check (
    rank_key in ('gardener','helper','caretaker','community_gardener','steward','elder_gardener')
  ),
  constraint garden_stewardship_capacity_check check (
    ordinary_footprint_capacity in (100,125,175,250,350,500)
  ),
  constraint garden_stewardship_counts_check check (
    tasks_completed >= 0 and community_projects_completed >= 0
  )
);

create table if not exists public.garden_stewardship_active_days (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  activity_date date not null,
  first_action_at timestamptz not null default now(),
  primary key (steward_id, activity_date)
);

create table if not exists public.garden_stewardship_categories (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  category text not null,
  tasks_completed integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (steward_id, category),
  constraint garden_stewardship_category_check check (
    category in ('cultivation','watering','neighbor_care','exploration','ecology','continuity')
  ),
  constraint garden_stewardship_category_count_check check (tasks_completed >= 0)
);

create table if not exists public.garden_task_templates (
  template_key text primary key,
  category text not null,
  slot_group text not null,
  title text not null,
  description text not null,
  metric text not null,
  target integer not null,
  conditional_key text,
  active boolean not null default true,
  constraint garden_task_template_category_check check (
    category in ('cultivation','watering','neighbor_care','exploration','ecology','continuity')
  ),
  constraint garden_task_template_slot_check check (slot_group in ('basic','community','any')),
  constraint garden_task_template_target_check check (target between 1 and 1000)
);

insert into public.garden_task_templates (
  template_key, category, slot_group, title, description, metric, target, conditional_key
) values
  ('plant_18','cultivation','basic','Plant a Patch','Plant 18 flowers in the Community Garden.','plant_count',18,null),
  ('varieties_3','cultivation','community','A Varied Garden','Plant three different flower varieties.','variety_count',3,null),
  ('water_rounds_6','watering','basic','Six Watering Rounds','Complete six successful watering rounds.','watering_rounds',6,null),
  ('water_flowers_20','watering','basic','Twenty Thirsty Flowers','Water 20 flowers.','flowers_watered',20,null),
  ('neighbor_water_20','neighbor_care','community','Care Across the Commons','Water 20 flowers planted by other gardeners.','other_flowers_watered',20,'other_flowers'),
  ('regions_2','exploration','community','Two Garden Regions','Help the garden in two different regions.','regions',2,null),
  ('growth_ring_8','exploration','any','Strengthen the Growth Ring','Plant eight flowers in the Growth Ring.','growth_ring_plants',8,'growth_ring'),
  ('varied_patch_6','ecology','any','Help a Living Patch','Complete six actions in patches containing several flower varieties.','diverse_patch_actions',6,'diverse_patch'),
  ('weeds_3','ecology','any','Make Room to Breathe','Pull three weeds.','weeds',3,'weeds'),
  ('days_3','continuity','any','Return to the Garden','Support the Community Garden on three different garden days.','active_days',3,null)
on conflict (template_key) do update set
  category = excluded.category,
  slot_group = excluded.slot_group,
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target = excluded.target,
  conditional_key = excluded.conditional_key,
  active = true;

create table if not exists public.garden_task_assignments (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  slot smallint not null,
  template_key text not null references public.garden_task_templates(template_key),
  target integer not null,
  progress integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  replaced_at timestamptz,
  constraint garden_task_assignment_slot_check check (slot between 1 and 3),
  constraint garden_task_assignment_progress_check check (progress >= 0 and target > 0),
  constraint garden_task_assignment_state_check check (jsonb_typeof(state) = 'object'),
  constraint garden_task_assignment_status_check check (status in ('active','completed','replaced'))
);

create unique index if not exists garden_task_assignments_active_slot_idx
  on public.garden_task_assignments (steward_id, slot) where status = 'active';
create index if not exists garden_task_assignments_steward_history_idx
  on public.garden_task_assignments (steward_id, assigned_at desc);

create table if not exists public.garden_stewardship_action_events (
  action_id uuid primary key,
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  action_type text not null,
  region_x smallint,
  region_y smallint,
  guidance_zone text,
  affected_count smallint not null default 0,
  other_affected_count smallint not null default 0,
  recorded_at timestamptz not null default now(),
  constraint garden_stewardship_event_action_check check (action_type in ('plant','water','weed')),
  constraint garden_stewardship_event_zone_check check (
    guidance_zone is null or guidance_zone in ('garden','heart','growth-ring')
  )
);

create index if not exists garden_stewardship_action_events_steward_idx
  on public.garden_stewardship_action_events (steward_id, recorded_at desc);

create table if not exists public.garden_stewardship_accolades (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  assignment_id uuid references public.garden_task_assignments(id) on delete set null,
  accolade_key text not null,
  title text not null,
  description text not null,
  earned_at timestamptz not null default now()
);

create index if not exists garden_stewardship_accolades_steward_idx
  on public.garden_stewardship_accolades (steward_id, earned_at desc);

create table if not exists public.garden_stewardship_notifications (
  id uuid primary key default gen_random_uuid(),
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  notification_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  constraint garden_stewardship_notification_type_check check (
    notification_type in ('task_complete','rank_up','project_complete')
  ),
  constraint garden_stewardship_notification_payload_check check (jsonb_typeof(payload) = 'object')
);

create index if not exists garden_stewardship_notifications_unread_idx
  on public.garden_stewardship_notifications (steward_id, created_at)
  where acknowledged_at is null;

create table if not exists public.garden_community_projects (
  id uuid primary key default gen_random_uuid(),
  cycle_index integer not null unique,
  project_key text not null,
  title text not null,
  description text not null,
  metric text not null,
  global_target integer not null,
  personal_target integer not null,
  global_progress integer not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  completed_at timestamptz,
  constraint garden_community_project_metric_check check (metric in ('plant','water')),
  constraint garden_community_project_targets_check check (
    global_target > 0 and personal_target > 0 and global_progress >= 0
  )
);

create table if not exists public.garden_community_project_progress (
  project_id uuid not null references public.garden_community_projects(id) on delete cascade,
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  progress integer not null default 0,
  credited_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, steward_id),
  constraint garden_community_project_progress_check check (progress >= 0)
);

-- Owned 4x4 clearings preserve all legacy rectangles while allowing
-- Caretakers to branch into the surrounding forest in any cardinal direction.
create table if not exists public.garden_unlocked_parcels (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  parcel_x integer not null,
  parcel_y integer not null,
  purchase_ordinal integer,
  care_cost integer not null default 0,
  unlocked_at timestamptz not null default now(),
  source text not null default 'legacy',
  primary key (steward_id, parcel_x, parcel_y),
  constraint garden_unlocked_parcel_coordinate_check check (
    parcel_x between -25000 and 25000 and parcel_y between -25000 and 25000
  ),
  constraint garden_unlocked_parcel_cost_check check (care_cost >= 0),
  constraint garden_unlocked_parcel_source_check check (source in ('starter','legacy','freeform'))
);

create index if not exists garden_unlocked_parcels_steward_time_idx
  on public.garden_unlocked_parcels (steward_id, unlocked_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'garden_stewardship_profiles','garden_stewardship_active_days',
    'garden_stewardship_categories','garden_task_templates',
    'garden_task_assignments','garden_stewardship_action_events',
    'garden_stewardship_accolades','garden_stewardship_notifications',
    'garden_community_projects','garden_community_project_progress',
    'garden_unlocked_parcels'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

create or replace function public.ensure_garden_stewardship_profile_v1(p_steward_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_steward_id is null or not exists (
    select 1 from public.garden_entitlements
    where steward_id = p_steward_id
      and product_key = 'basil_founding_gardener' and status = 'active'
  ) then return; end if;
  insert into public.garden_stewardship_profiles (steward_id)
  values (p_steward_id) on conflict (steward_id) do nothing;
end;
$$;

create or replace function public.get_community_stewardship_capacity_v1(p_actor_key text)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((
    select profile.ordinary_footprint_capacity::integer
    from public.community_garden_account_actors mapping
    join public.garden_stewards steward on steward.user_id = mapping.user_id
    join public.garden_entitlements entitlement
      on entitlement.steward_id = steward.id
      and entitlement.product_key = 'basil_founding_gardener'
      and entitlement.status = 'active'
    left join public.garden_stewardship_profiles profile on profile.steward_id = steward.id
    where mapping.actor_key = p_actor_key
    limit 1
  ), 100)
$$;

create or replace function public.assign_garden_task_v1(p_steward_id uuid, p_slot smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare chosen public.garden_task_templates%rowtype; assignment_id uuid;
begin
  if p_slot not between 1 and 3 or exists (
    select 1 from public.garden_task_assignments
    where steward_id=p_steward_id and slot=p_slot and status='active'
  ) then return null; end if;

  select template.* into chosen
  from public.garden_task_templates template
  where template.active
    and (p_slot <> 1 or template.slot_group = 'basic')
    and (p_slot <> 2 or template.slot_group in ('basic','community'))
    and not exists (
      select 1 from public.garden_task_assignments current
      where current.steward_id=p_steward_id and current.status='active'
        and current.template_key=template.template_key
    )
    and (template.metric <> 'active_days' or not exists (
      select 1 from public.garden_task_assignments current
      join public.garden_task_templates other on other.template_key=current.template_key
      where current.steward_id=p_steward_id and current.status='active'
        and other.metric='active_days'
    ))
    and (template.conditional_key is distinct from 'weeds' or (
      select count(*) from public.community_garden_weeds where expires_at > now()
    ) >= template.target)
    and (template.conditional_key is distinct from 'other_flowers' or (
      select count(*) from public.community_garden_roses
      where contributor_kind='account' and heritage_at is null
    ) >= template.target)
    and (template.conditional_key is distinct from 'growth_ring' or exists (
      select 1 from public.community_garden_regions where land_state in ('founding','established')
    ))
    and (template.conditional_key is distinct from 'diverse_patch' or (
      select count(distinct plant_type) from public.community_garden_roses
    ) >= 3)
  order by md5(p_steward_id::text || ':' || p_slot::text || ':' ||
    (select tasks_completed::text from public.garden_stewardship_profiles where steward_id=p_steward_id) || ':' || template.template_key)
  limit 1;

  if chosen.template_key is null then return null; end if;
  insert into public.garden_task_assignments (
    steward_id,slot,template_key,target,state
  ) values (
    p_steward_id,p_slot,chosen.template_key,chosen.target,
    jsonb_build_object('values','[]'::jsonb)
  ) returning id into assignment_id;
  return assignment_id;
end;
$$;

create or replace function public.ensure_garden_tasks_v1(p_steward_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare slot_number smallint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_steward_id::text,8311)
  );
  perform public.ensure_garden_stewardship_profile_v1(p_steward_id);
  for slot_number in 1..3 loop
    perform public.assign_garden_task_v1(p_steward_id, slot_number);
  end loop;
end;
$$;

create or replace function public.refresh_garden_stewardship_rank_v1(p_steward_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  profile public.garden_stewardship_profiles%rowtype;
  day_count integer; category_count integer; next_rank text; next_capacity integer;
begin
  select * into profile from public.garden_stewardship_profiles
  where steward_id=p_steward_id for update;
  if not found then return null; end if;
  select count(*)::integer into day_count from public.garden_stewardship_active_days where steward_id=p_steward_id;
  select count(*)::integer into category_count from public.garden_stewardship_categories
    where steward_id=p_steward_id and tasks_completed>0;

  next_rank := case
    when profile.tasks_completed>=120 and day_count>=45 and profile.community_projects_completed>=3 then 'elder_gardener'
    when profile.tasks_completed>=60 and day_count>=21 and category_count>=6 then 'steward'
    when profile.tasks_completed>=25 and day_count>=7 and category_count>=5 then 'community_gardener'
    when profile.tasks_completed>=10 and day_count>=3 and category_count>=4 then 'caretaker'
    when profile.tasks_completed>=3 and category_count>=2 then 'helper'
    else 'gardener' end;
  next_capacity := case next_rank
    when 'helper' then 125 when 'caretaker' then 175
    when 'community_gardener' then 250 when 'steward' then 350
    when 'elder_gardener' then 500 else 100 end;

  if next_capacity > profile.ordinary_footprint_capacity then
    update public.garden_stewardship_profiles set
      rank_key=next_rank, ordinary_footprint_capacity=next_capacity, updated_at=now()
    where steward_id=p_steward_id;
    insert into public.garden_stewardship_notifications (
      steward_id,notification_type,payload
    ) values (
      p_steward_id,'rank_up',jsonb_build_object(
        'rankKey',next_rank,'capacity',next_capacity
      )
    );
  end if;
  return next_rank;
end;
$$;

create or replace function public.ensure_current_garden_project_v1()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  cycle_number integer := floor((current_date - date '2026-07-27')::numeric / 14)::integer;
  project_id uuid; cycle_start timestamptz;
begin
  cycle_number := greatest(0, cycle_number);
  select id into project_id from public.garden_community_projects where cycle_index=cycle_number;
  if project_id is not null then return project_id; end if;
  cycle_start := (date '2026-07-27' + cycle_number * 14)::timestamptz;
  insert into public.garden_community_projects (
    cycle_index,project_key,title,description,metric,global_target,personal_target,starts_at,ends_at
  ) values (
    cycle_number,
    case when mod(cycle_number,2)=0 then 'shared_bloom' else 'watering_circle' end,
    case when mod(cycle_number,2)=0 then 'The Shared Bloom' else 'The Watering Circle' end,
    case when mod(cycle_number,2)=0
      then 'Members are planting a new community-wide bloom together.'
      else 'Members are refreshing the shared garden together.' end,
    case when mod(cycle_number,2)=0 then 'plant' else 'water' end,
    case when mod(cycle_number,2)=0 then 120 else 180 end,
    case when mod(cycle_number,2)=0 then 12 else 18 end,
    cycle_start, cycle_start + interval '14 days'
  ) returning id into project_id;
  return project_id;
end;
$$;

-- Forward declaration used by the idempotent action recorder below. The full
-- private summary implementation replaces this stub later in the migration.
create or replace function public.get_garden_stewardship_summary_v1(p_steward_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select null::jsonb
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
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  resolved_steward_id uuid; inserted_count integer; anchor_x integer := p_grid_x; anchor_y integer := p_grid_y;
  region_x smallint; region_y smallint; affected integer := 0; other_affected integer := 0;
  patch_varieties integer := 0; patch_plants integer := 0;
  assignment record; values_json jsonb; next_state jsonb; next_progress integer;
  completed_slot smallint; project_id uuid; project public.garden_community_projects%rowtype;
begin
  if p_action_type not in ('plant','water','weed') then return null; end if;
  select steward.id into resolved_steward_id
  from public.community_garden_account_actors mapping
  join public.garden_stewards steward on steward.user_id=mapping.user_id
  join public.garden_entitlements entitlement
    on entitlement.steward_id=steward.id
    and entitlement.product_key='basil_founding_gardener' and entitlement.status='active'
  where mapping.actor_key=p_actor_key limit 1;
  if resolved_steward_id is null then return null; end if;

  perform public.ensure_garden_tasks_v1(resolved_steward_id);
  if anchor_x is null or anchor_y is null then
    select rose.grid_x,rose.grid_y into anchor_x,anchor_y
    from jsonb_array_elements(coalesce(p_result->'plants','[]'::jsonb)) item
    join public.community_garden_roses rose on rose.id::text=item->>'id' limit 1;
  end if;
  if anchor_x is not null and anchor_y is not null then
    region_x := floor(anchor_x::numeric/16)::smallint;
    region_y := floor(anchor_y::numeric/16)::smallint;
    select count(*),count(distinct plant_type) into patch_plants,patch_varieties
    from public.community_garden_roses
    where grid_x between anchor_x-2 and anchor_x+2 and grid_y between anchor_y-2 and anchor_y+2
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now());
  end if;
  affected := case
    when p_action_type='weed' then 1
    else jsonb_array_length(coalesce(p_result->'plants','[]'::jsonb)) end;
  if p_action_type='water' then
    select count(*)::integer into other_affected
    from jsonb_array_elements(coalesce(p_result->'plants','[]'::jsonb)) item
    join public.community_garden_roses rose on rose.id::text=item->>'id'
    where rose.contributor_key<>p_actor_key;
  end if;

  insert into public.garden_stewardship_action_events (
    action_id,steward_id,action_type,region_x,region_y,guidance_zone,affected_count,other_affected_count
  ) values (
    p_action_id,resolved_steward_id,p_action_type,region_x,region_y,p_guidance_zone,affected,other_affected
  ) on conflict (action_id) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then return public.get_garden_stewardship_summary_v1(resolved_steward_id); end if;

  insert into public.garden_stewardship_active_days (steward_id,activity_date)
  values (resolved_steward_id,current_date) on conflict do nothing;

  for assignment in
    select a.*,t.metric,t.category,t.title,t.description
    from public.garden_task_assignments a join public.garden_task_templates t on t.template_key=a.template_key
    where a.steward_id=resolved_steward_id and a.status='active' order by a.slot
    for update of a
  loop
    next_progress := assignment.progress;
    next_state := assignment.state;
    values_json := coalesce(assignment.state->'values','[]'::jsonb);
    if assignment.metric='plant_count' and p_action_type='plant' then next_progress:=next_progress+1;
    elsif assignment.metric='variety_count' and p_action_type='plant' and p_plant_type is not null then
      if not values_json @> jsonb_build_array(p_plant_type) then values_json:=values_json||jsonb_build_array(p_plant_type); end if;
      next_state:=jsonb_set(next_state,'{values}',values_json,true); next_progress:=jsonb_array_length(values_json);
    elsif assignment.metric='watering_rounds' and p_action_type='water' then next_progress:=next_progress+1;
    elsif assignment.metric='flowers_watered' and p_action_type='water' then next_progress:=next_progress+affected;
    elsif assignment.metric='other_flowers_watered' and p_action_type='water' then next_progress:=next_progress+other_affected;
    elsif assignment.metric='regions' and region_x is not null then
      if not values_json @> jsonb_build_array(region_x::text||':'||region_y::text) then
        values_json:=values_json||jsonb_build_array(region_x::text||':'||region_y::text); end if;
      next_state:=jsonb_set(next_state,'{values}',values_json,true); next_progress:=jsonb_array_length(values_json);
    elsif assignment.metric='growth_ring_plants' and p_action_type='plant' and p_guidance_zone='growth-ring' then next_progress:=next_progress+1;
    elsif assignment.metric='diverse_patch_actions' and patch_plants>=6 and patch_varieties>=3 then next_progress:=next_progress+1;
    elsif assignment.metric='weeds' and p_action_type='weed' then next_progress:=next_progress+1;
    elsif assignment.metric='active_days' then
      if not values_json @> jsonb_build_array(current_date::text) then values_json:=values_json||jsonb_build_array(current_date::text); end if;
      next_state:=jsonb_set(next_state,'{values}',values_json,true); next_progress:=jsonb_array_length(values_json);
    end if;
    next_progress:=least(assignment.target,next_progress);
    if next_progress is distinct from assignment.progress or next_state is distinct from assignment.state then
      update public.garden_task_assignments set progress=next_progress,state=next_state where id=assignment.id;
    end if;
    if next_progress>=assignment.target then
      update public.garden_task_assignments set status='completed',completed_at=now() where id=assignment.id;
      update public.garden_stewardship_profiles set tasks_completed=tasks_completed+1,updated_at=now() where steward_id=resolved_steward_id;
      insert into public.garden_stewardship_categories (steward_id,category,tasks_completed)
      values (resolved_steward_id,assignment.category,1) on conflict (steward_id,category) do update set
        tasks_completed=public.garden_stewardship_categories.tasks_completed+1,updated_at=now();
      insert into public.garden_stewardship_accolades (steward_id,assignment_id,accolade_key,title,description)
      values (resolved_steward_id,assignment.id,assignment.template_key,assignment.title,assignment.description);
      insert into public.garden_stewardship_notifications (steward_id,notification_type,payload)
      values (resolved_steward_id,'task_complete',jsonb_build_object(
        'assignmentId',assignment.id,'title',assignment.title,'description',assignment.description,'category',assignment.category
      ));
      perform public.assign_garden_task_v1(resolved_steward_id,assignment.slot);
    end if;
  end loop;

  project_id:=public.ensure_current_garden_project_v1();
  select * into project from public.garden_community_projects where id=project_id for update;
  if project.completed_at is null and project.ends_at>now() and project.metric=p_action_type then
    insert into public.garden_community_project_progress (project_id,steward_id,progress)
    values (project_id,resolved_steward_id,greatest(1,affected)) on conflict (project_id,steward_id) do update set
      progress=public.garden_community_project_progress.progress+excluded.progress,updated_at=now();
    update public.garden_community_projects set global_progress=global_progress+greatest(1,affected)
    where id=project_id;
    select * into project from public.garden_community_projects where id=project_id for update;
    if project.global_progress>=project.global_target and (
      select count(*) from public.garden_community_project_progress where project_id=project.id and progress>0
    )>=2 then
      update public.garden_community_projects set completed_at=now() where id=project.id and completed_at is null;
      with credited as (
        update public.garden_community_project_progress progress set credited_at=now()
        where progress.project_id=project.id and progress.credited_at is null and progress.progress>=project.personal_target
        returning progress.steward_id
      )
      update public.garden_stewardship_profiles profile set
        community_projects_completed=community_projects_completed+1,updated_at=now()
      from credited where profile.steward_id=credited.steward_id;
      insert into public.garden_stewardship_notifications (steward_id,notification_type,payload)
      select progress.steward_id,'project_complete',jsonb_build_object('title',project.title,'projectKey',project.project_key)
      from public.garden_community_project_progress progress
      where progress.project_id=project.id and progress.credited_at is not null;
    end if;
  end if;

  perform public.refresh_garden_stewardship_rank_v1(resolved_steward_id);
  return public.get_garden_stewardship_summary_v1(resolved_steward_id);
end;
$$;

create or replace function public.get_garden_stewardship_summary_v1(p_steward_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  profile public.garden_stewardship_profiles%rowtype; actor_key text;
  active_days integer; categories integer; living_count integer; project_id uuid;
  recent jsonb; oldest jsonb; cluster jsonb; flowers jsonb; result jsonb;
begin
  perform public.ensure_garden_tasks_v1(p_steward_id);
  select * into profile from public.garden_stewardship_profiles where steward_id=p_steward_id;
  if not found then return null; end if;
  select mapping.actor_key into actor_key from public.garden_stewards steward
    join public.community_garden_account_actors mapping on mapping.user_id=steward.user_id
    where steward.id=p_steward_id;
  select count(*)::integer into active_days from public.garden_stewardship_active_days where steward_id=p_steward_id;
  select count(*)::integer into categories from public.garden_stewardship_categories where steward_id=p_steward_id and tasks_completed>0;

  if actor_key is not null then
    select count(*)::integer into living_count from public.community_garden_roses
    where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now());
    select jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id) into recent
      from public.community_garden_roses where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
      order by created_at desc,id desc limit 1;
    select jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id) into oldest
      from public.community_garden_roses where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
      order by created_at,id limit 1;
    select jsonb_build_object('gridX',round(avg(grid_x))::integer,'gridY',round(avg(grid_y))::integer,'count',count(*)) into cluster
      from public.community_garden_roses where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now())
      group by region_x,region_y order by count(*) desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('gridX',grid_x,'gridY',grid_y,'plantId',id)),'[]'::jsonb) into flowers
      from public.community_garden_roses where contributor_key=actor_key and heritage_at is null
      and (succession_at is null or succession_at>now())
      and (absolute_expires_at is null or absolute_expires_at>now())
      and (guest_expires_at is null or guest_expires_at>now());
  else living_count:=0; flowers:='[]'::jsonb; end if;
  project_id:=public.ensure_current_garden_project_v1();

  result:=jsonb_build_object(
    'rankKey',profile.rank_key,'capacity',profile.ordinary_footprint_capacity,
    'tasksCompleted',profile.tasks_completed,'activeDays',active_days,'categoriesCompleted',categories,
    'communityProjectsCompleted',profile.community_projects_completed,
    'replacementAvailableAt',case when profile.last_task_replacement_at is null then null else profile.last_task_replacement_at+interval '24 hours' end,
    'flowers',jsonb_build_object('living',living_count,'coordinates',coalesce(flowers,'[]'::jsonb),'recent',recent,'oldest',oldest,'mainCluster',cluster),
    'tasks',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'slot',a.slot,'templateKey',a.template_key,'category',t.category,'title',t.title,
      'description',t.description,'progress',a.progress,'target',a.target
    ) order by a.slot) from public.garden_task_assignments a join public.garden_task_templates t on t.template_key=a.template_key
      where a.steward_id=p_steward_id and a.status='active'),'[]'::jsonb),
    'recentAccolades',coalesce((select jsonb_agg(item.value order by item.earned_at desc) from (
      select jsonb_build_object('id',id,'title',title,'description',description,'earnedAt',earned_at) value,earned_at
      from public.garden_stewardship_accolades where steward_id=p_steward_id order by earned_at desc limit 12
    ) item),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'type',notification_type,'payload',payload,'createdAt',created_at
    ) order by created_at) from public.garden_stewardship_notifications
      where steward_id=p_steward_id and acknowledged_at is null),'[]'::jsonb),
    'project',(select jsonb_build_object(
      'id',project.id,'title',project.title,'description',project.description,
      'globalProgress',least(project.global_progress,project.global_target),'globalTarget',project.global_target,
      'personalProgress',least(coalesce(progress.progress,0),project.personal_target),'personalTarget',project.personal_target,
      'completed',project.completed_at is not null,'endsAt',project.ends_at
    ) from public.garden_community_projects project left join public.garden_community_project_progress progress
      on progress.project_id=project.id and progress.steward_id=p_steward_id where project.id=project_id)
  );
  return result;
end;
$$;

create or replace function public.replace_garden_task_v1(p_steward_id uuid,p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile public.garden_stewardship_profiles%rowtype; task public.garden_task_assignments%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_steward_id::text,8311)
  );
  select * into profile from public.garden_stewardship_profiles where steward_id=p_steward_id for update;
  if not found then raise exception 'Community Stewardship is not ready.' using errcode='P0001'; end if;
  if profile.last_task_replacement_at is not null and profile.last_task_replacement_at>now()-interval '24 hours' then
    raise exception 'Another Garden Task can be replaced tomorrow.' using errcode='P0001';
  end if;
  select * into task from public.garden_task_assignments
  where id=p_assignment_id and steward_id=p_steward_id and status='active' for update;
  if not found then raise exception 'That Garden Task is no longer active.' using errcode='P0002'; end if;
  update public.garden_task_assignments set status='replaced',replaced_at=now() where id=task.id;
  update public.garden_stewardship_profiles set last_task_replacement_at=now(),updated_at=now() where steward_id=p_steward_id;
  perform public.assign_garden_task_v1(p_steward_id,task.slot);
  return public.get_garden_stewardship_summary_v1(p_steward_id);
end;
$$;

create or replace function public.acknowledge_garden_stewardship_notification_v1(p_steward_id uuid,p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.garden_stewardship_notifications set acknowledged_at=now()
  where id=p_notification_id and steward_id=p_steward_id and acknowledged_at is null;
  return public.get_garden_stewardship_summary_v1(p_steward_id);
end;
$$;

-- Seed every current garden's exact rectangular footprint into 4x4 parcels.
create or replace function public.ensure_my_garden_parcels_v1(p_steward_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare progress public.garden_member_progress%rowtype; expansions integer; lefts integer; rights integer; ups integer; downs integer;
begin
  -- Once initialized, parcel rows become the source of truth. This prevents a
  -- deliberately returned clearing from being recreated by legacy backfill.
  if exists (
    select 1 from public.garden_unlocked_parcels where steward_id=p_steward_id
  ) then return; end if;
  select * into progress from public.garden_member_progress where steward_id=p_steward_id;
  if not found then return; end if;
  expansions:=greatest(progress.plot_level-1,0);
  rights:=(expansions+3)/4; downs:=(expansions+2)/4; lefts:=(expansions+1)/4; ups:=expansions/4;
  insert into public.garden_unlocked_parcels (steward_id,parcel_x,parcel_y,source)
  select p_steward_id,x,y,case when x between 0 and 2 and y between 0 and 3 then 'starter' else 'legacy' end
  from generate_series(-lefts,2+rights) x cross join generate_series(-ups,3+downs) y
  on conflict (steward_id,parcel_x,parcel_y) do nothing;
end;
$$;

create or replace function public.return_my_garden_clearing_v1(
  p_steward_id uuid,
  p_parcel_x integer,
  p_parcel_y integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  parcel public.garden_unlocked_parcels%rowtype;
  progress public.garden_member_progress%rowtype;
  remaining_count integer;
  connected_count integer;
  refund integer := 0;
begin
  perform public.ensure_my_garden_parcels_v1(p_steward_id);
  select * into parcel from public.garden_unlocked_parcels
  where steward_id=p_steward_id and parcel_x=p_parcel_x and parcel_y=p_parcel_y
  for update;
  if not found then
    raise exception 'That clearing is not part of My Garden.' using errcode='P0002';
  end if;
  if parcel.source='starter' then
    raise exception 'Your original garden clearing always stays.' using errcode='42501';
  end if;

  if exists (
    select 1 from public.garden_personal_plants
    where steward_id=p_steward_id
      and grid_x between p_parcel_x*4 and p_parcel_x*4+3
      and grid_y between p_parcel_y*4 and p_parcel_y*4+3
  ) or exists (
    select 1 from public.garden_personal_paths
    where steward_id=p_steward_id
      and grid_x between p_parcel_x*4 and p_parcel_x*4+3
      and grid_y between p_parcel_y*4 and p_parcel_y*4+3
  ) or exists (
    select 1
    from public.garden_personal_elements element
    join public.garden_personal_element_catalog catalog
      on catalog.element_type=element.element_type
    where element.steward_id=p_steward_id
      and element.grid_x <= p_parcel_x*4+3
      and element.grid_x+catalog.footprint_width-1 >= p_parcel_x*4
      and element.grid_y <= p_parcel_y*4+3
      and element.grid_y+catalog.footprint_height-1 >= p_parcel_y*4
  ) then
    raise exception 'Clear every plant, path, and item before returning this land.' using errcode='P0001';
  end if;

  select count(*)::integer into remaining_count
  from public.garden_unlocked_parcels
  where steward_id=p_steward_id
    and (parcel_x<>p_parcel_x or parcel_y<>p_parcel_y);
  if remaining_count<12 then
    raise exception 'My Garden must keep its original clearing.' using errcode='42501';
  end if;

  with recursive connected(parcel_x,parcel_y) as (
    (
      select candidate.parcel_x,candidate.parcel_y
      from public.garden_unlocked_parcels candidate
      where candidate.steward_id=p_steward_id
        and (candidate.parcel_x<>p_parcel_x or candidate.parcel_y<>p_parcel_y)
      order by candidate.parcel_y,candidate.parcel_x
      limit 1
    )
    union
    select candidate.parcel_x,candidate.parcel_y
    from public.garden_unlocked_parcels candidate
    join connected current_parcel on
      abs(candidate.parcel_x-current_parcel.parcel_x)+
      abs(candidate.parcel_y-current_parcel.parcel_y)=1
    where candidate.steward_id=p_steward_id
      and (candidate.parcel_x<>p_parcel_x or candidate.parcel_y<>p_parcel_y)
  )
  select count(*)::integer into connected_count from connected;
  if connected_count<>remaining_count then
    raise exception 'That clearing connects two parts of My Garden and cannot be returned yet.' using errcode='P0001';
  end if;

  select * into progress from public.garden_member_progress
  where steward_id=p_steward_id for update;
  if parcel.source='freeform' then refund:=parcel.care_cost; end if;
  delete from public.garden_unlocked_parcels
  where steward_id=p_steward_id and parcel_x=p_parcel_x and parcel_y=p_parcel_y;
  update public.garden_member_progress set
    care_balance=care_balance+refund,
    plot_level=case when parcel.source='freeform' then greatest(5,plot_level-1) else plot_level end,
    updated_at=now()
  where steward_id=p_steward_id;
  return jsonb_build_object(
    'parcelX',p_parcel_x,'parcelY',p_parcel_y,'careRefund',refund,
    'careBalance',progress.care_balance+refund
  );
end;
$$;

select public.ensure_my_garden_parcels_v1(steward_id) from public.garden_member_progress;

create or replace function public.my_garden_cell_is_unlocked_v1(p_steward_id uuid,p_grid_x integer,p_grid_y integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.garden_unlocked_parcels
    where steward_id=p_steward_id and parcel_x=floor(p_grid_x::numeric/4)::integer and parcel_y=floor(p_grid_y::numeric/4)::integer
  )
$$;

create or replace function public.my_garden_area_is_unlocked_v1(p_steward_id uuid,p_grid_x integer,p_grid_y integer,p_width integer,p_height integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_width>0 and p_height>0 and not exists (
    select 1 from generate_series(p_grid_x,p_grid_x+p_width-1) x
    cross join generate_series(p_grid_y,p_grid_y+p_height-1) y
    where not public.my_garden_cell_is_unlocked_v1(p_steward_id,x,y)
  )
$$;

create or replace function public.expand_my_garden_freeform_v1(p_steward_id uuid,p_parcel_x integer,p_parcel_y integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile public.garden_stewardship_profiles%rowtype; progress public.garden_member_progress%rowtype; expansion_cost integer; cost_step bigint;
begin
  perform public.ensure_my_garden_parcels_v1(p_steward_id);
  select * into profile from public.garden_stewardship_profiles where steward_id=p_steward_id;
  if not found or profile.ordinary_footprint_capacity<175 then
    raise exception 'Reach Caretaker to shape freeform garden clearings.' using errcode='42501';
  end if;
  select * into progress from public.garden_member_progress where steward_id=p_steward_id for update;
  if progress.plot_level<5 then raise exception 'Open the starter garden parcels first.' using errcode='42501'; end if;
  if exists (select 1 from public.garden_unlocked_parcels where steward_id=p_steward_id and parcel_x=p_parcel_x and parcel_y=p_parcel_y) then
    raise exception 'That clearing is already part of My Garden.' using errcode='P0002';
  end if;
  if not exists (
    select 1 from public.garden_unlocked_parcels where steward_id=p_steward_id and (
      (parcel_x=p_parcel_x-1 and parcel_y=p_parcel_y) or (parcel_x=p_parcel_x+1 and parcel_y=p_parcel_y) or
      (parcel_x=p_parcel_x and parcel_y=p_parcel_y-1) or (parcel_x=p_parcel_x and parcel_y=p_parcel_y+1)
    )
  ) then raise exception 'Choose a forest clearing touching your garden.' using errcode='22023'; end if;
  cost_step:=greatest(progress.plot_level-4,0);
  expansion_cost:=least(2000000000::bigint,100::bigint+25*cost_step+(5*cost_step*(cost_step+1))/2)::integer;
  if progress.care_balance<expansion_cost then raise exception 'Earn more Care in the Community Garden before expanding.' using errcode='22000'; end if;
  insert into public.garden_unlocked_parcels (steward_id,parcel_x,parcel_y,purchase_ordinal,care_cost,source)
  values (p_steward_id,p_parcel_x,p_parcel_y,progress.plot_level,expansion_cost,'freeform');
  update public.garden_member_progress set care_balance=care_balance-expansion_cost,plot_level=plot_level+1,updated_at=now()
  where steward_id=p_steward_id;
  return jsonb_build_object('careBalance',progress.care_balance-expansion_cost,'plotLevel',progress.plot_level+1,'parcelX',p_parcel_x,'parcelY',p_parcel_y);
end;
$$;

-- Upgrade the established My Garden mutation functions to authorize the union
-- of owned clearings. Exact replacements deliberately fail the migration if a
-- future function body no longer matches this reviewed release.
do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.plant_my_garden(uuid,integer,integer,text)'::regprocedure) into definition; original:=definition;
  definition:=replace(definition,
    E'if p_grid_x is null or p_grid_y is null\n     or p_grid_x < plot_min_x or p_grid_x > plot_max_x\n     or p_grid_y < plot_min_y or p_grid_y > plot_max_y then',
    E'if p_grid_x is null or p_grid_y is null\n     or not public.my_garden_cell_is_unlocked_v1(p_steward_id,p_grid_x,p_grid_y) then');
  if definition=original then raise exception 'Could not add parcel checks to plant_my_garden.'; end if; execute definition;
end $$;

do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.toggle_my_garden_path(uuid,integer,integer)'::regprocedure) into definition; original:=definition;
  definition:=replace(definition,
    E'if p_grid_x is null or p_grid_y is null\n     or p_grid_x < plot_min_x or p_grid_x > plot_max_x\n     or p_grid_y < plot_min_y or p_grid_y > plot_max_y then',
    E'if p_grid_x is null or p_grid_y is null\n     or not public.my_garden_cell_is_unlocked_v1(p_steward_id,p_grid_x,p_grid_y) then');
  if definition=original then raise exception 'Could not add parcel checks to toggle_my_garden_path.'; end if; execute definition;
end $$;

do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.place_my_garden_element(uuid,integer,integer,text)'::regprocedure) into definition; original:=definition;
  definition:=replace(definition,
    E'if p_grid_x is null or p_grid_y is null\n     or p_grid_x < plot_min_x\n     or p_grid_x + item_width - 1 > plot_max_x\n     or p_grid_y < plot_min_y\n     or p_grid_y + item_height - 1 > plot_max_y then',
    E'if p_grid_x is null or p_grid_y is null\n     or not public.my_garden_area_is_unlocked_v1(p_steward_id,p_grid_x,p_grid_y,item_width,item_height) then');
  if definition=original then raise exception 'Could not add parcel checks to place_my_garden_element.'; end if; execute definition;
end $$;

do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.apply_my_garden_builder_action(uuid,uuid,text,text,text,jsonb)'::regprocedure) into definition; original:=definition;
  definition:=replace(definition,
    E'if cell_xs[cell_index] < plot_min_x\n       or cell_xs[cell_index] > plot_max_x\n       or cell_ys[cell_index] < plot_min_y\n       or cell_ys[cell_index] > plot_max_y then',
    E'if not public.my_garden_cell_is_unlocked_v1(p_steward_id,cell_xs[cell_index],cell_ys[cell_index]) then');
  if definition=original then raise exception 'Could not add parcel checks to Builder Mode.'; end if; execute definition;
end $$;

-- Replace the hard-coded ordinary 100/125 action rails with the member's
-- permanent Stewardship capacity. Guests and system actors still resolve to 100.
do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.perform_idempotent_community_garden_action_v3(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure) into definition; original:=definition;
  definition:=replace(definition,'if contributor_count > 100 then','if contributor_count > public.get_community_stewardship_capacity_v1(p_actor_key) then');
  definition:=replace(definition,'limit contributor_count - 100','limit contributor_count - public.get_community_stewardship_capacity_v1(p_actor_key)');
  definition:=replace(definition,'if contributor_count > 125 then','if contributor_count > public.get_community_stewardship_capacity_v1(p_actor_key) + 25 then');
  definition:=replace(definition,'limit contributor_count - 125','limit contributor_count - (public.get_community_stewardship_capacity_v1(p_actor_key) + 25)');
  if definition=original or definition not like '%get_community_stewardship_capacity_v1%' then
    raise exception 'Could not add Stewardship capacity to Community actions.'; end if; execute definition;
end $$;

do $$ declare definition text; original text; begin
  select pg_get_functiondef('public.perform_idempotent_community_garden_action_v4(uuid,text,text,text,integer,integer,text,uuid[])'::regprocedure) into definition; original:=definition;
  definition:=replace(
    definition,
    'succession_count := greatest(contributor_count - 100, 0);',
    'succession_count := greatest(contributor_count - public.get_community_stewardship_capacity_v1(p_actor_key), 0);'
  );
  if definition=original or definition not like '%get_community_stewardship_capacity_v1%' then
    raise exception 'Could not add Stewardship capacity to Community footprint normalization.';
  end if;
  execute definition;
end $$;

create or replace function public.reconcile_community_garden_actor_v3(p_user_id uuid,p_guest_actor_key text,p_account_actor_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; steward_id uuid; capacity integer; ordinary_count integer; overflow_count integer; next_snapshot timestamptz;
begin
  result:=public.reconcile_community_garden_actor_v2(p_user_id,p_guest_actor_key,p_account_actor_key);
  select steward.id into steward_id from public.garden_stewards steward
  join public.garden_entitlements entitlement on entitlement.steward_id=steward.id and entitlement.product_key='basil_founding_gardener' and entitlement.status='active'
  where steward.user_id=p_user_id limit 1;
  if steward_id is not null then perform public.ensure_garden_stewardship_profile_v1(steward_id); end if;
  capacity:=public.get_community_stewardship_capacity_v1(p_account_actor_key);
  select count(*)::integer into ordinary_count from public.community_garden_roses where contributor_key=p_account_actor_key and heritage_at is null;
  overflow_count:=greatest(ordinary_count-capacity,0);
  next_snapshot:=to_timestamp((floor(extract(epoch from statement_timestamp())/600)+1)*600);
  with ranked as (
    select id,row_number() over(order by created_at,id) rank from public.community_garden_roses
    where contributor_key=p_account_actor_key and heritage_at is null
  ) update public.community_garden_roses plant set succession_at=case
      when ranked.rank<=overflow_count then coalesce(plant.succession_at,next_snapshot) else null end
    from ranked where plant.id=ranked.id;
  return result||jsonb_build_object('ordinaryFootprintCapacity',capacity,'scheduledOverflow',overflow_count);
end;
$$;

revoke all on function public.ensure_garden_stewardship_profile_v1(uuid) from public,anon,authenticated;
revoke all on function public.get_community_stewardship_capacity_v1(text) from public,anon,authenticated;
revoke all on function public.assign_garden_task_v1(uuid,smallint) from public,anon,authenticated;
revoke all on function public.ensure_garden_tasks_v1(uuid) from public,anon,authenticated;
revoke all on function public.refresh_garden_stewardship_rank_v1(uuid) from public,anon,authenticated;
revoke all on function public.ensure_current_garden_project_v1() from public,anon,authenticated;
revoke all on function public.record_garden_stewardship_action_v1(uuid,text,text,integer,integer,text,uuid[],jsonb,text) from public,anon,authenticated;
revoke all on function public.get_garden_stewardship_summary_v1(uuid) from public,anon,authenticated;
revoke all on function public.replace_garden_task_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.acknowledge_garden_stewardship_notification_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ensure_my_garden_parcels_v1(uuid) from public,anon,authenticated;
revoke all on function public.return_my_garden_clearing_v1(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.my_garden_cell_is_unlocked_v1(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.my_garden_area_is_unlocked_v1(uuid,integer,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.expand_my_garden_freeform_v1(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.reconcile_community_garden_actor_v3(uuid,text,text) from public,anon,authenticated;

grant execute on function public.record_garden_stewardship_action_v1(uuid,text,text,integer,integer,text,uuid[],jsonb,text) to service_role;
grant execute on function public.ensure_garden_stewardship_profile_v1(uuid) to service_role;
grant execute on function public.get_garden_stewardship_summary_v1(uuid) to service_role;
grant execute on function public.replace_garden_task_v1(uuid,uuid) to service_role;
grant execute on function public.acknowledge_garden_stewardship_notification_v1(uuid,uuid) to service_role;
grant execute on function public.ensure_my_garden_parcels_v1(uuid) to service_role;
grant execute on function public.return_my_garden_clearing_v1(uuid,integer,integer) to service_role;
grant execute on function public.expand_my_garden_freeform_v1(uuid,integer,integer) to service_role;
grant execute on function public.reconcile_community_garden_actor_v3(uuid,text,text) to service_role;

comment on table public.garden_stewardship_profiles is
  'Private, permanent Community Stewardship rank and trailing ordinary-flower capacity for paid Basil members.';
comment on table public.garden_unlocked_parcels is
  'Private 4x4 My Garden clearing ownership. Legacy rectangles are backfilled without moving existing content.';

commit;
