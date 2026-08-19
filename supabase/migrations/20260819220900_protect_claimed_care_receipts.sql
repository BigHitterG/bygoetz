-- Claimed Care receipts are the immutable evidence behind the permanent Care
-- ledger. The snapshot function previously tried to delete them after 30 days,
-- but garden_care_ledger intentionally references those tokens with ON DELETE
-- RESTRICT. Once the first receipts reached 30 days old, every snapshot refresh
-- aborted and the Community Garden appeared empty.
--
-- Keep claimed receipts with their ledger entries. Only expired, unclaimed
-- receipts are disposable.

select pg_advisory_xact_lock(
  pg_catalog.hashtextextended('basil-community-garden-snapshot', 0)
);

do $$
declare
  definition text;
  upgraded text;
  previous_cleanup constant text :=
    E'delete from public.garden_care_receipts\n'
    || E'  where (claimed_at is not null and claimed_at < statement_timestamp() - interval ''30 days'')\n'
    || E'     or (claimed_at is null and expires_at < statement_timestamp() - interval ''1 day'');';
  safe_cleanup constant text :=
    E'delete from public.garden_care_receipts\n'
    || E'  where claimed_at is null\n'
    || E'    and expires_at < statement_timestamp() - interval ''1 day'';';
begin
  select pg_get_functiondef(
    'public.get_or_create_community_garden_snapshot()'::regprocedure
  ) into definition;

  if position(previous_cleanup in definition) > 0 then
    upgraded := replace(definition, previous_cleanup, safe_cleanup);

    if upgraded = definition
      or upgraded like '%claimed_at is not null and claimed_at < statement_timestamp()%'
      or position(safe_cleanup in upgraded) = 0
    then
      raise exception 'Basil Care receipt retention policy could not be installed safely.';
    end if;

    execute upgraded;
  elsif position(safe_cleanup in definition) > 0
    and definition not like '%claimed_at is not null and claimed_at < statement_timestamp()%'
  then
    -- The emergency production repair may already be installed before this
    -- migration is recorded in migration history. Treat that state as success.
    null;
  else
    raise exception 'Basil Care receipt retention policy could not be installed safely.';
  end if;
end;
$$;

comment on constraint garden_care_ledger_receipt_token_fkey
  on public.garden_care_ledger is
  'Preserves the claimed Care receipt that permanently substantiates each Care ledger entry.';
