# Basil My Garden Catalog Rollout

Status: The full Garden Starter through Basil I ladder is implemented. The
authoritative numbers are in `basil-uncapped-care-economy.md`,
`myGardenCatalog.ts`, and the matching Supabase catalog migration.

## Product rules

- Care is earned only by helping in the Community Garden.
- Care cannot be purchased.
- Lifetime Care is a non-spendable progression measurement.
- Current Care is spent when an item or flower is placed.
- My Garden never decays and never requires maintenance.
- Furniture can be picked up for a full refund of its original placement cost.
- Personal plants retain the existing partial uprooting return.
- Decorative animals and insects never award Care or create a paid gameplay advantage.
- The three-flower onboarding remains rose, sunflower and lavender.
- Each collection is implemented before it is shown to players.
- Released inventory unlocks one item at a time from lifetime Care.
- Reaching the next collection threshold completes the prior collection and
  opens the next collection as a larger progression moment.

## Player progression

| Collection | Lifetime Care | Expected active-player timing |
| --- | ---: | --- |
| Garden Starter | Membership | Immediately |
| Cottage Garden | 500 | First sessions |
| Pollinator Garden | 3,750 | First week |
| Water Garden | 12,500 | First few weeks |
| Woodland Garden | 50,000 | Long-term progression |
| Working Garden | 125,000 | Long-term progression |
| Heritage Garden | 300,000 | Long-term progression |
| Botanical Masterworks | 625,000 | Long-term progression |
| Basil I | 1,000,000 | Long-term prestige goal |

Timing is deliberately approximate. Basil no longer has diminishing returns or
a visible daily Care ceiling.

## Release 1: Catalog foundation through Water Garden

Release 1 establishes the reusable catalog, database validation, collection
progression, categorized inventory and one-tile/multi-tile placement.

### Garden Starter

Rose, sunflower, lavender, daisy, tulip and wildflowers cost 1 Care. Clay pot,
hedge, stone paver, gravel and brick cost 1; birdhouse costs 2; garden bench
costs 3.

Rose, sunflower, lavender, stone paver, birdhouse and garden bench are the
membership starter kit. Daisy unlocks at 25 lifetime Care, tulip at 60,
wildflowers at 125, gravel at 200, brick at 250, clay pot at 325 and hedge at
400. At 500, Garden Starter is complete and Cottage Garden opens.

### Cottage Garden: 500 lifetime Care

Peony costs 1; fern costs 6; hydrangea costs 10; wheelbarrow costs 12; wooden
planter costs 20; bird feeder costs 25; rustic bench costs 30; trellis costs 50.

Peony unlocks at 500, fern at 750, hydrangea at 1,100, wheelbarrow at 1,500,
wooden planter at 1,900, bird feeder at 2,250, rustic bench at 2,750 and
trellis at 3,250. At 3,750, Cottage Garden is complete and Pollinator Garden
opens.

### Pollinator Garden: 3,750 lifetime Care

Bee balm costs 1; butterfly bush costs 15; pollinator sign costs 25; butterfly
house costs 40; beehive costs 60; rose-covered trellis costs 100.

Pollinator visitors are ambient only. They require no feeding, maintenance or
Care and do not generate Care.

Bee balm unlocks at 3,750, butterfly bush at 4,750, pollinator sign at 5,750,
butterfly house at 7,000, beehive at 8,500 and rose-covered trellis at 10,500.
At 12,500, Pollinator Garden is complete and Water Garden opens.

### Water Garden: 12,500 lifetime Care

Reeds cost 3; lily pads cost 4; birdbath costs 60; stone basin costs 125;
willow tree costs 200; garden fountain costs 375; small pond costs 625.

The fountain and pond are fixed-footprint objects in Release 1. Freeform ponds
belong in a later release.

Reeds unlock at 12,500, lily pads at 15,000, birdbath at 19,000, stone basin at
22,500, willow tree at 27,500, garden fountain at 34,000 and small pond at
41,500. At 50,000, Water Garden is complete.

### Release 1 completion gate

- Prices, lifetime thresholds and footprints are server-authoritative.
- Existing gardens and existing placements survive the migration.
- New personal flowers never enter the public Community Garden.
- Locked entries cannot be placed by modifying browser requests.
- Multi-tile footprints cannot overlap flowers, paths, furniture or the fence.
- Multi-tile items can be picked up by selecting any occupied tile.
- Inventory remains usable with touch, mouse and keyboard.
- Tall objects sort by their apparent bottom edge.
- Guest preview, onboarding, paywall, public Care economy and price are unchanged.
- TypeScript, ESLint, unit tests, production build, database verification,
  Supabase advisors and live mobile/tablet checks pass before production.

## Woodland Garden: 50,000 lifetime Care

Woodland shrub unlocks at 50,000; log bench at 60,000; pine at 70,000; maple at
80,000; flowering tree at 90,000; bonsai at 105,000; grand oak at 115,000. At
125,000, Woodland Garden is complete and Working Garden opens.

## Working Garden: 125,000 lifetime Care

Compost bin unlocks at 125,000; potting table at 145,000; raised bed at 170,000;
cold frame at 200,000; garden shed at 235,000; small greenhouse at 275,000. At
300,000, Working Garden is complete and Heritage Garden opens. Nothing requires
maintenance or generates Care.

## Heritage Garden: 300,000 lifetime Care

Topiary arch unlocks at 300,000; pergola at 350,000; greenhouse extension at
405,000; mosaic fountain at 465,000; formal pond at 530,000; conservatory at
590,000. At 625,000, Heritage Garden is complete and Botanical Masterworks
opens.

## Botanical Masterworks: 625,000 lifetime Care

Grand rose pergola unlocks at 625,000; glass pavilion at 750,000; botanical
glasshouse at 875,000. At 1,000,000, Botanical Masterworks is complete and
Basil I opens. These are visually dramatic landmarks without statistical
bonuses.

## Basil I: 1,000,000 lifetime Care

At 1,000,000 lifetime Care, Great Basil Topiary unlocks as the first prestige
landmark. It provides no economic advantage.

## Instructions for future catalog extensions

Audit the live schema and current catalog before changing it. Extend the
existing catalog architecture instead of creating special-case purchase
systems. Validate all costs, thresholds, entitlements, footprints and
collisions in a transactional server-side mutation. Use proper Supabase
migrations with RLS and least-privilege grants. Preserve historical placement
costs for refunds. Do not add an empty player-facing collection.

Each release must preserve the Community Garden, onboarding, guest preview,
membership paywall, account system, existing gardens and $9.99 price. Run the
complete validation and deployment gate, report the migration and changed
catalog, then stop before beginning the next release.
