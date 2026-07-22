-- Support efficient cascade cleanup when a Community Garden flower returns.
create index if not exists community_garden_watering_history_plant_idx
  on public.community_garden_watering_history (plant_id);
