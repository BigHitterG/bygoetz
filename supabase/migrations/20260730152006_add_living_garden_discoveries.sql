create table if not exists public.my_garden_habitat_discoveries (
  steward_id uuid not null references public.garden_stewards(id) on delete cascade,
  habitat_key text not null,
  discovered_at timestamptz not null default now(),
  first_center_x integer not null,
  first_center_y integer not null,
  trigger_signature text not null,
  acknowledged_at timestamptz,
  primary key (steward_id, habitat_key),
  constraint my_garden_habitat_key_length
    check (char_length(habitat_key) between 1 and 80),
  constraint my_garden_habitat_signature_length
    check (char_length(trigger_signature) between 1 and 500)
);

create index if not exists my_garden_habitat_discoveries_steward_date_idx
  on public.my_garden_habitat_discoveries (steward_id, discovered_at desc);

alter table public.my_garden_habitat_discoveries enable row level security;

revoke all on table public.my_garden_habitat_discoveries from public;
revoke all on table public.my_garden_habitat_discoveries from anon;
revoke all on table public.my_garden_habitat_discoveries from authenticated;
grant all on table public.my_garden_habitat_discoveries to service_role;

comment on table public.my_garden_habitat_discoveries is
  'Private, account-owned Living Garden discoveries. Access is mediated by authenticated Basil server routes.';
