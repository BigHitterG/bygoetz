# Basil quorum frontier

Status: implemented in shadow/manual mode before automatic land opening

## Product rule

One gardener may play indefinitely, but only distributed gardeners returning
together can grow the shared world. Raw planting volume never substitutes for
community participation.

The implementation intentionally separates three concepts:

1. **Discovered land** never disappears after it opens.
2. **The active frontier** may advance or become fallow as participation changes.
3. **Heritage Flowers** are rare permanent landmarks preserving shared history.

An inactive outer region may become fallow, but it remains visitable and may be
awakened again. Existing plants remain visible there, but fallow land does not
accept new planting or count as active capacity until it is restored. The game
does not delete unlocked land to make the map smaller.

## Existing world compatibility

- The existing `-96..63` coordinate square is the 160 by 160 Founding Garden.
- Its 100 existing 16 by 16 regions are registered without relocating,
  deleting, or changing the ownership of current flowers.
- Existing Heritage Flowers remain permanent.
- Existing ordinary and legacy flowers retain their current lifecycle. Legacy
  rows without a trustworthy contributor identity never count as new quorum
  evidence.

## Capacity

Each 16 by 16 region contains 256 raw tiles, but planting rests at 180 plants.
Frontier planning therefore uses 180 plants per open region as effective
capacity.

- Prepare candidates at 50 percent effective occupancy.
- Recommend opening supported adjacent land at 60 percent.
- Open only enough regions to restore approximately 55 percent occupancy.
- Automatic opening remains disabled until shadow measurements and manual
  openings validate the model.
- A qualifying absent section is first recommended as `prepare`. An owner may
  open it as frontier land; only participation inside that new land can then
  earn an `establish` recommendation. This keeps adjacent activity from
  instantly turning empty land into permanent garden.

## Distributed support

One authenticated account may contribute at most one qualifying support credit
per region per UTC day and may support at most three frontier regions per day.
Guest actions remain normal gameplay but cannot independently govern world
expansion because browser sessions are inexpensive to manufacture.

Starting shadow thresholds for one region are:

- 64 supported living flowers;
- coverage across 8 of the region's 16 internal 4 by 4 subcells;
- 6 distinct eligible gardeners;
- meaningful activity on 4 of the last 7 days;
- 3 consecutive qualifying daily observations; and
- side adjacency to established land.

These values are versioned hypotheses. The owner dashboard reports why each
candidate passed or failed before the values can affect land.

## Perimeter quorum

The database computes the actual discrete perimeter: wild 16 by 16 regions
sharing a side with established land. The initial formula is:

```text
required gardeners = max(12, ceil(perimeter regions / 3))
```

This makes total community requirements rise with circumference and naturally
penalizes thin tendrils. Action counts do not appear in this formula.

## Heritage

An ordinary account-owned flower remains eligible under the established Basil
requirements: at least five days old, Care on three dates from three gardeners,
and six nearby living flowers. New promotion additionally requires established
land and available regional capacity.

Each established region initially permits nine Heritage Flowers. Existing
Heritage is grandfathered outside that budget. A player is notified only when a
flower they planted actually becomes Heritage, not when an ordinary flower is
first planted.

## Processing and safety

- Immediate plant, water, weed, Care, and ledger mutations remain direct and
  transactional.
- Region support is rolled into bounded account-region-day records. Idempotency
  evidence is indexed and retained for 35 days, then removed by the daily
  evaluator; evaluation summaries are retained for 400 days.
- Ecology evaluation is advisory-locked and idempotent.
- All policy, audit, support, and notification tables are server-only with RLS
  and revoked browser grants.
- The initial release records recommendations and permits manual decisions. It
  never opens land automatically.
- Public ten-minute snapshots remain the visible synchronization rhythm, not
  the authority for deciding whether quorum exists.

## Player-facing Growing Edge

Players see the friendly term **Growing Edge**, not quorum scores or account
counts. The public minimap uses privacy-safe region states:

- Garden: open land for normal play.
- Growing Edge: community activity is helping prospective land take root.
- Ready: the owner may safely review the section for a manual opening.
- Newly opened: recently discovered land.
- Resting: open land taking an ecological pause.

The small map is available to everyone. Membership expands it with Heritage
markers and more regional detail. Exact quorum evidence and opening decisions
remain private in the founder dashboard.

## Delivery migration

The active client now loads a cached manifest plus one five-by-five regional
window centered on the player. It does not request 25 individual regions and
does not normally hydrate the entire world. The prior full snapshot remains an
automatic recovery path if regional delivery fails, which protects existing
Play state, optimistic recent flowers, and reconnect behavior.

Future areas remain sectors on the same global coordinate plane, not separate
databases or duplicate games. Actual land opening remains manual; this release
does not turn on automatic expansion.
