alter table public.garden_member_progress
  add column if not exists inventory_seen_lifetime_care integer
  not null default 0
  check (inventory_seen_lifetime_care >= 0);

comment on column public.garden_member_progress.inventory_seen_lifetime_care is
  'Highest lifetime-Care progression the member has acknowledged in the My Garden inventory.';

-- Existing members keep every earned unlock without receiving a backlog of
-- historical celebration dialogs on the first progressive-catalog release.
update public.garden_member_progress
set inventory_seen_lifetime_care = lifetime_care
where inventory_seen_lifetime_care < lifetime_care;

update public.garden_personal_plant_catalog
set
  lifetime_care_required = case plant_type
    when 'rose' then 0
    when 'sunflower' then 0
    when 'lavender' then 0
    when 'daisy' then 25
    when 'tulip' then 50
    when 'wildflowers' then 75
    when 'peony' then 250
    when 'bee_balm' then 750
    else lifetime_care_required
  end,
  updated_at = now()
where plant_type in (
  'rose',
  'sunflower',
  'lavender',
  'daisy',
  'tulip',
  'wildflowers',
  'peony',
  'bee_balm'
);

update public.garden_personal_element_catalog
set
  lifetime_care_required = case element_type
    when 'stone_paver' then 0
    when 'birdhouse' then 0
    when 'bench' then 0
    when 'gravel_tile' then 100
    when 'brick_paver' then 125
    when 'clay_pot' then 150
    when 'hedge' then 200
    when 'fern' then 300
    when 'hydrangea' then 375
    when 'wheelbarrow' then 450
    when 'wooden_planter' then 525
    when 'bird_feeder' then 600
    when 'rustic_bench' then 675
    when 'trellis' then 725
    when 'butterfly_bush' then 850
    when 'pollinator_sign' then 950
    when 'butterfly_house' then 1050
    when 'beehive' then 1200
    when 'rose_trellis' then 1400
    when 'reeds' then 1500
    when 'lily_pads' then 1650
    when 'birdbath' then 1800
    when 'stone_basin' then 2000
    when 'willow_tree' then 2200
    when 'fountain' then 2500
    when 'small_pond' then 2800
    else lifetime_care_required
  end,
  updated_at = now()
where element_type in (
  'stone_paver',
  'birdhouse',
  'bench',
  'gravel_tile',
  'brick_paver',
  'clay_pot',
  'hedge',
  'fern',
  'hydrangea',
  'wheelbarrow',
  'wooden_planter',
  'bird_feeder',
  'rustic_bench',
  'trellis',
  'butterfly_bush',
  'pollinator_sign',
  'butterfly_house',
  'beehive',
  'rose_trellis',
  'reeds',
  'lily_pads',
  'birdbath',
  'stone_basin',
  'willow_tree',
  'fountain',
  'small_pond'
);
