-- Complete Basil's server-authoritative My Garden collection ladder.
-- Existing gardens, balances, placements and unlock history are preserved.

alter table public.garden_personal_plant_catalog
  drop constraint if exists garden_personal_plant_catalog_collection_key_check;
alter table public.garden_personal_plant_catalog
  add constraint garden_personal_plant_catalog_collection_key_check
  check (
    collection_key in (
      'starter',
      'cottage',
      'pollinator',
      'water',
      'woodland',
      'working',
      'heritage',
      'botanical',
      'basil'
    )
  );

alter table public.garden_personal_element_catalog
  drop constraint if exists garden_personal_element_catalog_collection_key_check;
alter table public.garden_personal_element_catalog
  add constraint garden_personal_element_catalog_collection_key_check
  check (
    collection_key in (
      'starter',
      'cottage',
      'pollinator',
      'water',
      'woodland',
      'working',
      'heritage',
      'botanical',
      'basil'
    )
  );

insert into public.garden_personal_element_catalog (
  element_type,
  display_name,
  collection_key,
  inventory_category,
  lifetime_care_required,
  care_cost,
  footprint_width,
  footprint_height,
  sort_order,
  active
)
values
  ('woodland_shrub', 'Woodland shrub', 'woodland', 'nature', 50000, 3, 1, 1, 410, true),
  ('log_bench', 'Log bench', 'woodland', 'decor', 60000, 5, 2, 1, 420, true),
  ('pine_tree', 'Pine tree', 'woodland', 'nature', 70000, 13, 2, 2, 430, true),
  ('maple_tree', 'Maple tree', 'woodland', 'nature', 80000, 18, 2, 2, 440, true),
  ('flowering_tree', 'Flowering tree', 'woodland', 'nature', 90000, 23, 2, 2, 450, true),
  ('bonsai_tree', 'Bonsai tree', 'woodland', 'nature', 105000, 30, 1, 1, 460, true),
  ('grand_oak', 'Grand oak', 'woodland', 'nature', 115000, 75, 3, 2, 470, true),
  ('compost_bin', 'Compost bin', 'working', 'decor', 125000, 5, 1, 1, 510, true),
  ('potting_table', 'Potting table', 'working', 'decor', 145000, 12, 2, 1, 520, true),
  ('raised_bed', 'Raised bed', 'working', 'nature', 170000, 20, 2, 2, 530, true),
  ('cold_frame', 'Cold frame', 'working', 'decor', 200000, 30, 2, 1, 540, true),
  ('garden_shed', 'Garden shed', 'working', 'decor', 235000, 75, 3, 2, 550, true),
  ('small_greenhouse', 'Small greenhouse', 'working', 'decor', 275000, 150, 3, 3, 560, true),
  ('topiary_arch', 'Topiary arch', 'heritage', 'nature', 300000, 60, 2, 1, 610, true),
  ('pergola', 'Pergola', 'heritage', 'decor', 350000, 100, 3, 2, 620, true),
  ('greenhouse_extension', 'Greenhouse extension', 'heritage', 'decor', 405000, 90, 3, 2, 630, true),
  ('mosaic_fountain', 'Mosaic fountain', 'heritage', 'water', 465000, 125, 2, 2, 640, true),
  ('formal_pond', 'Formal pond', 'heritage', 'water', 530000, 165, 4, 3, 650, true),
  ('conservatory', 'Conservatory', 'heritage', 'decor', 590000, 375, 4, 3, 660, true),
  ('grand_rose_pergola', 'Grand rose pergola', 'botanical', 'decor', 625000, 300, 4, 2, 710, true),
  ('glass_pavilion', 'Glass pavilion', 'botanical', 'decor', 750000, 625, 4, 3, 720, true),
  ('botanical_glasshouse', 'Botanical glasshouse', 'botanical', 'decor', 875000, 1000, 5, 4, 730, true),
  ('great_basil_topiary', 'Great Basil topiary', 'basil', 'nature', 1000000, 2500, 3, 3, 810, true)
on conflict (element_type) do update
set
  display_name = excluded.display_name,
  collection_key = excluded.collection_key,
  inventory_category = excluded.inventory_category,
  lifetime_care_required = excluded.lifetime_care_required,
  care_cost = excluded.care_cost,
  footprint_width = excluded.footprint_width,
  footprint_height = excluded.footprint_height,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

comment on table public.garden_personal_element_catalog is
  'Server-authoritative My Garden catalog for the complete Garden Starter through Basil I collection ladder.';
