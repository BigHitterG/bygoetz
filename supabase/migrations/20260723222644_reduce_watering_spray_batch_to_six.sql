-- Keep one authoritative watering action aligned with two three-flower sprays.
-- Care remains awarded once because both sprays share one action_id and one
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
    'cardinality(normalized_ids) > 6' in current_definition
  ) > 0 then
    return;
  end if;

  if position(
    'cardinality(normalized_ids) > 8' in current_definition
  ) = 0 then
    raise exception
      'The watering function no longer contains the expected eight-target guard.';
  end if;

  updated_definition := pg_catalog.replace(
    current_definition,
    'cardinality(normalized_ids) > 8',
    'cardinality(normalized_ids) > 6'
  );
  updated_definition := pg_catalog.replace(
    updated_definition,
    'Choose between one and eight connected plants to water.',
    'Choose between one and six connected plants to water.'
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
  'Processes one idempotent watering action across one or two three-flower sprays and awards Care once.';
