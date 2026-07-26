# Basil Garden Heart and Growth Ring

Status: active visual guidance; Care bonuses intentionally deferred.

## Player model

Basil now describes its open shared land in three simple layers:

1. **Garden Heart** — the largest connected, established cluster of the shared
   garden. It is shown as deeper green.
2. **Growth Ring** — the one-region-deep band of open land immediately around
   the Heart. It is shown with a pale green-gold outline.
3. **Growing Edge** — future land outside the open garden. It remains gold and
   visibly padlocked until the existing frontier process opens it.

The Heart is not a fixed circle and is not computed from a raw center point. It
can lean or bulge in any direction as the community builds a connected garden.
This avoids letting one isolated high-volume player or bot drag the perceived
center across the map.

## Daily planning rule

The server classifies 16 by 16 open regions using the latest daily frontier
evaluation whenever it is available. It considers aggregate plant density,
Heritage Flowers, spatial coverage, and distinct gardener support. Candidate
regions are joined through cardinal adjacency; the largest connected component
becomes the Heart. Small planted holes surrounded on three sides are filled to
make the public shape easier to read. The adjacent open band becomes the Growth
Ring.

The public manifest exposes only each region's friendly classification and an
aggregate zone summary. It does not expose player identities, contributor keys,
exact account evidence, or exact quorum reasoning.

If the daily evaluator is temporarily unavailable, the regional snapshot is a
safe fallback. It changes no canonical data.

## Explicit non-goals in this release

- No extra Care is awarded in either zone.
- No Care prices, inventory unlocks, footprints, or watering rules change.
- No flowers, weeds, Heritage Flowers, or land states are moved or removed.
- The zone plan does not open locked land.
- Automatic frontier opening remains disabled.

A later measured release may attach bounded, server-authoritative bonuses to
accepted helpful actions in these areas. Keeping rewards separate lets Basil
first observe whether the map itself guides players naturally.
