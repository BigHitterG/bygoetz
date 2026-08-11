create table if not exists public.basil_social_daily_snapshots (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default statement_timestamp(),
  community_flowers integer not null check (community_flowers >= 0),
  gardener_sessions integer not null check (gardener_sessions >= 0),
  waterings integer not null check (waterings >= 0),
  weeds_pulled integer not null check (weeds_pulled >= 0)
);

create index if not exists basil_social_daily_snapshots_captured_idx
  on public.basil_social_daily_snapshots (captured_at desc, id desc);

alter table public.basil_social_daily_snapshots enable row level security;
revoke all on table public.basil_social_daily_snapshots from public, anon, authenticated;
grant select, insert on table public.basil_social_daily_snapshots to service_role;

comment on table public.basil_social_daily_snapshots is
  'Service-role-only cumulative, non-identifying measurements captured for Basil Today in the Garden social cards.';
comment on column public.basil_social_daily_snapshots.gardener_sessions is
  'Cumulative distinct privacy-preserving actor keys with at least one completed planting action; includes anonymous sessions.';

insert into public.basil_social_daily_snapshots (
  community_flowers,
  gardener_sessions,
  waterings,
  weeds_pulled
)
select
  (select count(*)::integer from public.community_garden_roses),
  (select count(distinct action.actor_key)::integer from public.community_garden_actions as action where action.action_type = 'plant' and action.status = 'completed'),
  (select count(*)::integer from public.community_garden_actions as action where action.action_type = 'water' and action.status = 'completed'),
  (select count(*)::integer from public.community_garden_actions as action where action.action_type = 'weed' and action.status = 'completed')
where not exists (select 1 from public.basil_social_daily_snapshots);

create or replace function public.get_basil_social_daily_update()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  measured_at timestamptz := statement_timestamp();
  current_flowers integer;
  current_gardeners integer;
  current_waterings integer;
  current_weeds integer;
  previous_snapshot record;
  new_snapshot_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('basil_social_daily_snapshot', 0));

  select count(*)::integer
    into current_flowers
    from public.community_garden_roses;

  select
    count(distinct action.actor_key) filter (where action.action_type = 'plant' and action.status = 'completed')::integer,
    count(*) filter (where action.action_type = 'water' and action.status = 'completed')::integer,
    count(*) filter (where action.action_type = 'weed' and action.status = 'completed')::integer
    into current_gardeners, current_waterings, current_weeds
    from public.community_garden_actions as action;

  select snapshot.id, snapshot.captured_at, snapshot.community_flowers,
         snapshot.gardener_sessions, snapshot.waterings, snapshot.weeds_pulled
    into previous_snapshot
    from public.basil_social_daily_snapshots as snapshot
    order by snapshot.captured_at desc, snapshot.id desc
    limit 1;

  insert into public.basil_social_daily_snapshots (
    captured_at,
    community_flowers,
    gardener_sessions,
    waterings,
    weeds_pulled
  ) values (
    measured_at,
    current_flowers,
    current_gardeners,
    current_waterings,
    current_weeds
  ) returning id into new_snapshot_id;

  return jsonb_build_object(
    'snapshotId', new_snapshot_id,
    'measuredAt', measured_at,
    'comparison', 'previous_snapshot',
    'previousSnapshotAt', previous_snapshot.captured_at,
    'communityFlowers', jsonb_build_object(
      'value', current_flowers,
      'previousValue', previous_snapshot.community_flowers,
      'delta', case when previous_snapshot.id is null then null else current_flowers - previous_snapshot.community_flowers end
    ),
    'newGardeners', jsonb_build_object(
      'value', current_gardeners,
      'previousValue', previous_snapshot.gardener_sessions,
      'delta', case when previous_snapshot.id is null then null else current_gardeners - previous_snapshot.gardener_sessions end
    ),
    'waterings', jsonb_build_object(
      'value', current_waterings,
      'previousValue', previous_snapshot.waterings,
      'delta', case when previous_snapshot.id is null then null else current_waterings - previous_snapshot.waterings end
    ),
    'weedsPulled', jsonb_build_object(
      'value', current_weeds,
      'previousValue', previous_snapshot.weeds_pulled,
      'delta', case when previous_snapshot.id is null then null else current_weeds - previous_snapshot.weeds_pulled end
    )
  );
end;
$$;

revoke all on function public.get_basil_social_daily_update() from public, anon, authenticated;
grant execute on function public.get_basil_social_daily_update() to service_role;

comment on function public.get_basil_social_daily_update() is
  'Captures cumulative Basil community flowers, distinct anonymous-inclusive planting sessions, waterings, and weeds pulled; returns deltas from the immediately previous Studio snapshot.';
