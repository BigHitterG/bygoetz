# Basil account Heritage Seeds

## Player rule

Every active Garden Membership can naturally grow one lifetime Heritage
Flower. The player never chooses or nominates a candidate. Normal Community
Garden play selects the first qualifying flower planted by that account.
Ownership remains private and never appears in the public snapshot.

A flower becomes Heritage immediately after all of these are true:

- at least 5 days old;
- cared for on at least 3 UTC dates;
- cared for by at least 3 distinct account/steward actors;
- at least 6 living neighboring flowers within two tiles;
- planted in founding or established land; and
- its region has fewer than 9 Heritage Flowers.

There is no 14-day promotion batch and no failed nomination. Until one flower
qualifies, the opportunity remains available across all of the member's living
flowers. The water action that completes the criteria promotes the flower
transactionally; after that, the account has earned its one lifetime Heritage
Flower.

## Steward rule

Rowan, Clover, and Wren each receive the same one lifetime opportunity. Their
first naturally qualifying flower uses the same age, care, gardener,
neighborhood, land, and regional-capacity checks as a member.

## Existing garden

The 15 Heritage Flowers present before this release are grandfathered and are
never deleted or rewritten by the migration. Regional capacity now counts the
actual Heritage Flowers in the region, including those grandfathered flowers.
If an existing flower has a known private account mapping, the earliest one can
be linked to that account's badge; unknown public flowers remain anonymous.

## Privacy and deletion

`community_garden_heritage_seeds` is RLS-protected, has no client policies, and
is granted only to `service_role`. Candidate lists and nomination controls are
not exposed. Account deletion cascades the private Heritage mapping while the
already-anonymous public Heritage Flower and event remain in the canonical
Community Garden.
