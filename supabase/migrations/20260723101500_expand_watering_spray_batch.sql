-- Allow one authoritative watering action to cover two four-flower sprays.
-- Care is still awarded once because both sprays share one action_id and one
-- transaction through perform_idempotent_community_garden_water_v1.
do $migration$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.perform_idempotent_community_garden_water_v1(uuid,text,text,uuid[])'::regprocedure
  )
  into current_definition;

  if position(
    'cardinality(normalized_ids) > 8' in current_definition
  ) > 0 then
    return;
  end if;

  if position(
    'cardinality(normalized_ids) > 4' in current_definition
  ) = 0 then
    raise exception
      'The watering function no longer contains the expected four-target guard.';
  end if;

  updated_definition := pg_catalog.replace(
    current_definition,
    'cardinality(normalized_ids) > 4',
    'cardinality(normalized_ids) > 8'
  );
  updated_definition := pg_catalog.replace(
    updated_definition,
    'Choose between one and four plants to water.',
    'Choose between one and eight connected plants to water.'
  );

  execute updated_definition;
end;
$migration$;

revoke execute on function public.perform_idempotent_community_garden_water_v1(
  uuid, text, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.perform_idempotent_community_garden_water_v1(
  uuid, text, text, uuid[]
) to service_role;

comment on function public.perform_idempotent_community_garden_water_v1(
  uuid, text, text, uuid[]
) is
  'Processes one idempotent watering action across one or two four-flower sprays and awards Care once.';
