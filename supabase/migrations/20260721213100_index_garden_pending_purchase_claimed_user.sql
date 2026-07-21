create index if not exists garden_pending_purchases_claimed_user_idx
  on public.garden_pending_purchases (claimed_user_id)
  where claimed_user_id is not null;
