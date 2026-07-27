begin;

alter table public.community_garden_heritage_seeds
  add column if not exists available_since timestamptz
  not null default '1970-01-01 00:00:00+00';

create or replace function public.guard_community_garden_heritage_nomination_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate public.community_garden_roses%rowtype;
  releasing_failed_seed boolean :=
    pg_catalog.current_setting('basil.release_failed_heritage_seed', true) = '1';
begin
  if old.redeemed_at is not null then
    return new;
  end if;

  if old.nominated_plant_id is not null
    and new.nominated_plant_id is distinct from old.nominated_plant_id
    and not releasing_failed_seed
  then
    raise exception 'Your Heritage Seed is already growing with its nominated flower.'
      using errcode = 'P0001';
  end if;

  if old.nominated_plant_id is null and new.nominated_plant_id is not null then
    select * into candidate
    from public.community_garden_roses
    where id = new.nominated_plant_id;

    if candidate.id is null
      or candidate.contributor_key is distinct from old.owner_actor_key
      or candidate.planted_at < old.available_since
    then
      raise exception 'Plant a new Community Garden flower before placing the returned Heritage Seed.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_community_garden_heritage_nomination
  on public.community_garden_heritage_seeds;
create trigger guard_community_garden_heritage_nomination
before update of nominated_plant_id on public.community_garden_heritage_seeds
for each row execute function public.guard_community_garden_heritage_nomination_v1();

create or replace function public.release_failed_community_garden_heritage_seed_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('basil.release_failed_heritage_seed', '1', true);
  update public.community_garden_heritage_seeds
  set
    nominated_plant_id = null,
    nominated_at = null,
    available_since = statement_timestamp(),
    updated_at = statement_timestamp()
  where nominated_plant_id = old.id
    and redeemed_at is null;
  return old;
end;
$$;

drop trigger if exists release_failed_community_garden_heritage_seed
  on public.community_garden_roses;
create trigger release_failed_community_garden_heritage_seed
before delete on public.community_garden_roses
for each row execute function public.release_failed_community_garden_heritage_seed_v1();

create or replace function public.nominate_founding_steward_heritage_seed_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.community_garden_heritage_seeds as seed
  set
    nominated_plant_id = new.id,
    nominated_at = new.planted_at,
    updated_at = statement_timestamp()
  where seed.owner_actor_key = new.contributor_key
    and seed.owner_kind = 'founding_steward'
    and seed.redeemed_at is null
    and seed.nominated_plant_id is null
    and new.planted_at >= seed.available_since;
  return new;
end;
$$;

-- v2 filters the v1 account payload at the returned-seed boundary. This keeps
-- the original audited status function intact while ensuring an account cannot
-- nominate a flower that existed before its previous candidate returned.
create or replace function public.get_community_garden_heritage_seed_v2(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  seed_available_since timestamptz := '1970-01-01 00:00:00+00';
  filtered_candidates jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' or p_user_id is null then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  payload := public.get_community_garden_heritage_seed_v1(p_user_id);

  select coalesce(seed.available_since, seed_available_since)
  into seed_available_since
  from public.community_garden_heritage_seeds as seed
  where seed.user_id = p_user_id;
  seed_available_since := coalesce(
    seed_available_since,
    '1970-01-01 00:00:00+00'::timestamptz
  );

  select coalesce(jsonb_agg(candidate.value), '[]'::jsonb)
  into filtered_candidates
  from jsonb_array_elements(coalesce(payload -> 'candidates', '[]'::jsonb))
    as candidate(value)
  where nullif(candidate.value ->> 'plantedAt', '')::timestamptz
    >= seed_available_since;

  payload := jsonb_set(payload, '{candidates}', filtered_candidates, true);
  payload := jsonb_set(
    payload,
    '{availableSince}',
    to_jsonb(seed_available_since),
    true
  );
  return payload;
end;
$$;

revoke all on function public.guard_community_garden_heritage_nomination_v1()
  from public, anon, authenticated;
revoke all on function public.release_failed_community_garden_heritage_seed_v1()
  from public, anon, authenticated;
revoke all on function public.nominate_founding_steward_heritage_seed_v1()
  from public, anon, authenticated;
revoke all on function public.get_community_garden_heritage_seed_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.get_community_garden_heritage_seed_v2(uuid)
  to service_role;

comment on function public.get_community_garden_heritage_seed_v2(uuid) is
  'Service-only member Heritage status filtered so a returned seed can only be placed on a newly planted flower.';

commit;
