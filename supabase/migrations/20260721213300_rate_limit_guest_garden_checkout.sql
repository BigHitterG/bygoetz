alter table public.garden_pending_purchases
  add column if not exists request_ip_hash text;

alter table public.garden_pending_purchases
  drop constraint if exists garden_pending_purchases_ip_hash_format;

alter table public.garden_pending_purchases
  add constraint garden_pending_purchases_ip_hash_format check (
    request_ip_hash is null or request_ip_hash ~ '^[0-9a-f]{64}$'
  );

create index if not exists garden_pending_purchases_ip_created_idx
  on public.garden_pending_purchases (request_ip_hash, created_at desc)
  where request_ip_hash is not null;
