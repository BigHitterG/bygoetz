create index if not exists garden_care_receipts_claimed_steward_idx
  on public.garden_care_receipts (claimed_by_steward_id)
  where claimed_by_steward_id is not null;
