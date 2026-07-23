# Basil My Garden Catalog Rollout

Status: Release 1 authorized for implementation on July 22, 2026.

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

## Player progression

| Collection | Lifetime Care | Expected active-player timing |
| --- | ---: | --- |
| Garden Starter | Membership | Immediately |
| Cottage Garden | 250 | 2-5 days |
| Pollinator Garden | 750 | 4-10 days |
| Water Garden | 1,500 | 1-3 weeks |
| Woodland Garden | 3,000 | 2-6 weeks |
| Working Garden | 6,000 | 1-3 months |
| Heritage Garden | 12,000 | 2-6 months |
| Botanical Masterworks | 25,000 | 4-12 months |
| Basil | 100,000 | Approximately 1.5-3 years |

Timing is deliberately approximate. Reaching the 600-Care daily ceiling requires
thousands of helpful actions because Basil tapers rewards after the first 200 and
400 Care.

## Release 1: Catalog foundation through Water Garden

Release 1 establishes the reusable catalog, database validation, collection
progression, categorized inventory and one-tile/multi-tile placement.

### Garden Starter

Rose, sunflower, lavender, daisy, tulip and wildflowers cost 2 Care. Clay pot
costs 3; hedge costs 4; stone and gravel pavers cost 1; brick paver costs 2;
birdhouse costs 6; garden bench costs 10.

### Cottage Garden: 250 lifetime Care

Peony costs 2; fern costs 5; hydrangea, wheelbarrow and wooden planter cost 8;
bird feeder and rustic bench cost 12; trellis costs 25.

### Pollinator Garden: 750 lifetime Care

Bee balm costs 2; butterfly bush costs 10; pollinator sign costs 12; butterfly
house costs 20; beehive costs 35; rose-covered trellis costs 50.

Pollinator visitors are ambient only. They require no feeding, maintenance or
Care and do not generate Care.

### Water Garden: 1,500 lifetime Care

Reeds and lily pads cost 5; birdbath costs 35; stone basin costs 60; willow tree
costs 100; garden fountain costs 175; small pond costs 250.

The fountain and pond are fixed-footprint objects in Release 1. Freeform ponds
belong in a later release.

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

## Release 2: Woodland Garden and property styling

At 3,000 lifetime Care add shrubs, log bench, pine, maple, flowering tree,
bonsai and grand oak. Add a path-painting workflow and whole-property fence
skins that follow future land expansions automatically. Ambient birds and
squirrels can appear when matching habitat items are present.

## Release 3: Working Garden

At 6,000 lifetime Care add compost bin, potting table, raised bed, cold frame,
garden shed and small greenhouse. Raised beds may hold normal personal flowers.
Nothing requires maintenance or generates Care.

## Release 4: Heritage Garden

At 12,000 lifetime Care add topiary arch, pergola, greenhouse extension, mosaic
fountain, formal pond and conservatory. Introduce auto-connecting greenhouse
bays and more flexible pond shapes.

## Release 5: Botanical Masterworks

At 25,000 lifetime Care add a grand rose pergola, glass pavilion and botanical
glasshouse. These are visually dramatic landmarks without statistical bonuses.

## Release 6: Basil

At 100,000 lifetime Care unlock the final prestige landmark: the Basil
Conservatory or Great Basil Topiary. It includes a permanent achievement plaque
and provides no economic advantage.

## Instructions for future Codex releases

Implement one release at a time. Audit the live schema and current catalog before
changing it. Extend the existing catalog architecture instead of creating
special-case purchase systems. Validate all costs, thresholds, entitlements,
footprints and collisions in a transactional server-side mutation. Use proper
Supabase migrations with RLS and least-privilege grants. Preserve historical
placement costs for refunds. Do not add an empty player-facing collection.

Each release must preserve the Community Garden, onboarding, guest preview,
membership paywall, account system, existing gardens and $9.99 price. Run the
complete validation and deployment gate, report the migration and changed
catalog, then stop before beginning the next release.
