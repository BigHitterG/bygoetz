begin;

-- The production migration was verified immediately after application. This
-- correction keeps the function definition safe if a database interpreted the
-- original PL/pgSQL variable as the similarly named evaluation-table column.
do $fix$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.get_community_garden_frontier_dashboard_v1()'::regprocedure
  )
  into function_definition;

  execute replace(
    function_definition,
    'latest_evaluation_date',
    'dashboard_evaluation_date'
  );
end;
$fix$;

revoke execute on function public.get_community_garden_frontier_dashboard_v1()
  from public, anon, authenticated;
grant execute on function public.get_community_garden_frontier_dashboard_v1()
  to service_role;

commit;
