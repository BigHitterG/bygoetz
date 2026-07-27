# Basil account Heritage Seeds

## Player rule

Every active Garden Membership receives one lifetime Heritage Seed. The seed
can only be placed on a living Community Garden flower planted by that same
account. Ownership remains private and never appears in the public snapshot.

The nomination is locked while that flower is trying to establish. It becomes
a Heritage Flower immediately after all of these are true:

- at least 5 days old;
- cared for on at least 3 UTC dates;
- cared for by at least 3 distinct account/steward actors;
- at least 6 living neighboring flowers within two tiles;
- planted in founding or established land; and
- its region has fewer than 9 Heritage Flowers.

There is no 14-day promotion batch. The action that completes the criteria, or
the nomination of an already-qualified flower, promotes it transactionally.

## Failure and retry

The seed is consumed only by successful Heritage promotion. A nomination
cannot be moved to another existing flower. If the candidate returns to earth,
the seed is returned and its new `available_since` timestamp is recorded. Only
a flower planted after that loss can receive the next nomination.

## Steward rule

Rowan, Clover, and Wren each receive the same one lifetime opportunity. Their
first eligible new planting is nominated automatically. They use the same age,
care, gardener, neighborhood, land, and regional-capacity checks as a member.

## Existing garden

The 15 Heritage Flowers present before this release are grandfathered and are
never deleted or rewritten by the migration. Regional capacity now counts the
actual Heritage Flowers in the region, including those grandfathered flowers.
If an existing flower has a known private account mapping, the earliest one can
be linked to that account's badge; unknown public flowers remain anonymous.

## Privacy and deletion

`community_garden_heritage_seeds` is RLS-protected, has no client policies, and
is granted only to `service_role`. Account deletion cascades the private seed
mapping while the already-anonymous public Heritage Flower and event remain in
the canonical Community Garden.
