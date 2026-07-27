-- Trigger helpers are invoked by Postgres, never directly by browser roles.
revoke all on function public.extend_community_garden_heritage_aura_v1()
  from public, anon, authenticated;

