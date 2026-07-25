-- Compress Basil's open-ended Lifetime Care progression to roughly one
-- quarter of the original curve. Existing Lifetime Care and spendable Care
-- balances are intentionally preserved, so this migration can only unlock
-- inventory sooner and cannot relock an item.

update public.garden_personal_plant_catalog
set
  lifetime_care_required = case plant_type
    when 'rose' then 0
    when 'sunflower' then 0
    when 'lavender' then 0
    when 'daisy' then 25
    when 'tulip' then 60
    when 'wildflowers' then 125
    when 'peony' then 500
    when 'bee_balm' then 3750
    else lifetime_care_required
  end,
  care_cost = case plant_type
    when 'rose' then 1
    when 'sunflower' then 1
    when 'lavender' then 1
    when 'daisy' then 1
    when 'tulip' then 1
    when 'wildflowers' then 1
    when 'peony' then 1
    when 'bee_balm' then 1
    else care_cost
  end,
  updated_at = now()
where active;

update public.garden_personal_element_catalog
set
  lifetime_care_required = case element_type
    when 'stone_paver' then 0
    when 'birdhouse' then 0
    when 'bench' then 0
    when 'gravel_tile' then 200
    when 'brick_paver' then 250
    when 'clay_pot' then 325
    when 'hedge' then 400
    when 'fern' then 750
    when 'hydrangea' then 1100
    when 'wheelbarrow' then 1500
    when 'wooden_planter' then 1900
    when 'bird_feeder' then 2250
    when 'rustic_bench' then 2750
    when 'trellis' then 3250
    when 'butterfly_bush' then 4750
    when 'pollinator_sign' then 5750
    when 'butterfly_house' then 7000
    when 'beehive' then 8500
    when 'rose_trellis' then 10500
    when 'reeds' then 12500
    when 'lily_pads' then 15000
    when 'birdbath' then 19000
    when 'stone_basin' then 22500
    when 'willow_tree' then 27500
    when 'fountain' then 34000
    when 'small_pond' then 41500
    else lifetime_care_required
  end,
  care_cost = case element_type
    when 'stone_paver' then 1
    when 'birdhouse' then 2
    when 'bench' then 3
    when 'gravel_tile' then 1
    when 'brick_paver' then 1
    when 'clay_pot' then 1
    when 'hedge' then 1
    when 'fern' then 6
    when 'hydrangea' then 10
    when 'wheelbarrow' then 12
    when 'wooden_planter' then 20
    when 'bird_feeder' then 25
    when 'rustic_bench' then 30
    when 'trellis' then 50
    when 'butterfly_bush' then 15
    when 'pollinator_sign' then 25
    when 'butterfly_house' then 40
    when 'beehive' then 60
    when 'rose_trellis' then 100
    when 'reeds' then 3
    when 'lily_pads' then 4
    when 'birdbath' then 60
    when 'stone_basin' then 125
    when 'willow_tree' then 200
    when 'fountain' then 375
    when 'small_pond' then 625
    else care_cost
  end,
  updated_at = now()
where active;

comment on table public.garden_personal_plant_catalog is
  'Server-authoritative My Garden plant costs and quarter-scale Lifetime Care unlocks.';

comment on table public.garden_personal_element_catalog is
  'Server-authoritative My Garden item costs, footprints, categories and quarter-scale Lifetime Care unlocks.';
