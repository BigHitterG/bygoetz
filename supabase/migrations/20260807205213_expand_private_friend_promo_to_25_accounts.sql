create table if not exists public.garden_promo_redemptions (
  promo_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (promo_key, user_id)
);

alter table public.garden_promo_redemptions enable row level security;

revoke all on table public.garden_promo_redemptions from public, anon, authenticated;
grant select, insert on table public.garden_promo_redemptions to service_role;

insert into public.garden_promo_redemptions (promo_key, user_id, redeemed_at)
select
  'private-friend-gift-2026',
  steward.user_id,
  entitlement.purchased_at
from public.garden_entitlements as entitlement
join public.garden_stewards as steward
  on steward.id = entitlement.steward_id
where entitlement.provider = 'promo'
  and entitlement.provider_purchase_id = 'promo:private-friend-gift-2026'
on conflict (promo_key, user_id) do nothing;

create or replace function public.claim_garden_promo_redemption_v1(
  p_promo_key text,
  p_user_id uuid,
  p_max_redemptions integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  redemption_count integer;
begin
  if p_promo_key is null or btrim(p_promo_key) = '' then
    raise exception 'Promo key is required';
  end if;
  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if p_max_redemptions is null or p_max_redemptions < 1 or p_max_redemptions > 1000 then
    raise exception 'Promo redemption limit is invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('basil-promo:' || p_promo_key, 0));

  if exists (
    select 1
    from public.garden_promo_redemptions
    where promo_key = p_promo_key
      and user_id = p_user_id
  ) then
    return true;
  end if;

  select count(*)::integer
  into redemption_count
  from public.garden_promo_redemptions
  where promo_key = p_promo_key;

  if redemption_count >= p_max_redemptions then
    return false;
  end if;

  insert into public.garden_promo_redemptions (promo_key, user_id)
  values (p_promo_key, p_user_id);

  return true;
end;
$$;

revoke all on function public.claim_garden_promo_redemption_v1(text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_garden_promo_redemption_v1(text, uuid, integer)
  to service_role;
