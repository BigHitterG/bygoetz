alter table public.garden_care_ledger
  drop constraint if exists garden_care_ledger_delta_check;

alter table public.garden_care_ledger
  add constraint garden_care_ledger_delta_check
  check (care_delta between 0 and 6);
