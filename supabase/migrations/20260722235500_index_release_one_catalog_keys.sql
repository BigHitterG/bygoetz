create index if not exists garden_personal_plants_plant_type_idx
  on public.garden_personal_plants (plant_type);

create index if not exists garden_personal_elements_element_type_idx
  on public.garden_personal_elements (element_type);
