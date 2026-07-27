# Basil Founding Stewards

## Purpose

Basil starts with three low-volume, server-run Founding Stewards so paid-member
areas can receive a little cooperative planting and watering while the human
community is still small. They are support, not simulated visible players.

## Player-facing behavior

- No steward avatar, name, cursor, movement, or presence is sent to a browser.
- Their ordinary flowers appear only through the normal shared-garden snapshot.
- They never target guest-owned tutorial flowers.
- Their actions stay at least eight tiles from the current tutorial spawn points.
- They work only when at least one active paid Basil member exists.
- They work around flowers owned by paid members or by the three stewards.

## Daily limits

The existing daily frontier cron runs the steward batch before measuring the
frontier. Each enabled steward may perform at most:

- 2 plant actions; and
- 4 watering actions.

That is a maximum of 18 successful actions per day across all three stewards.
The limits are stored in the private steward table and can be paused or lowered
without a browser release.

## Fairness and safety

Stewards call `perform_idempotent_community_garden_action_v9` through the same
server action wrapper as players. Therefore the normal 100-plant footprint,
100-watering footprint, regional pressure, tile conflicts, action rails, and
Heritage Flower qualification rules still apply. Their deterministic daily
action IDs make cron retries safe.

The database tables and plan RPC are service-role-only with RLS enabled. The
private founder dashboard receives aggregate counts and friendly internal
names, never the steward actor or network keys and never player email.

## Founder monitoring

The existing private Garden Health panel shows:

- whether all three stewards are enabled;
- the latest daily run and its success/failure counts;
- seven-day planting, watering, and regional activity;
- Heritage care records and completed promotions; and
- a per-steward seven-day summary.

This is deliberately measurable and reversible. Disabling all three steward
rows stops future work without removing any legitimate garden history.
