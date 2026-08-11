-- Keep every flower from the expanded 15-flower guest preview when checkout
-- turns it into a permanent member garden.
do $$
declare
  definition text;
  upgraded text;
begin
  select pg_get_functiondef(
    'public.import_my_garden_preview(uuid,integer,jsonb,jsonb)'::regprocedure
  ) into definition;

  upgraded := replace(
    definition,
    E'      with ordinality as preview(item, ordinal)\n    limit 10\n  loop',
    E'      with ordinality as preview(item, ordinal)\n    limit 15\n  loop'
  );

  if upgraded = definition
    or upgraded not like '%with ordinality as preview(item, ordinal)%limit 15%'
  then
    raise exception 'Basil guest preview import limit could not be upgraded safely.';
  end if;

  execute upgraded;
end;
$$;

comment on function public.import_my_garden_preview(uuid,integer,jsonb,jsonb) is
  'Imports a purchased guest preview, preserving up to 15 flowers, 64 paths, and the transferable Care balance exactly once.';
