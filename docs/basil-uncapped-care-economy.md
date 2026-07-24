# Basil open-ended Care economy

Status: production model beginning July 24, 2026.

## Reward rule

- The first helpful Community Garden action each UTC day awards 4 Care.
- Every accepted planting, completed watering sequence, or pulled weed after
  that awards 1 Care.
- A Care Blossom adds 2 bonus Care.
- A Garden Worm adds 2 bonus Care.
- There is no diminishing return and no daily Care ceiling.
- Guest preview transfer limits remain unchanged. Open-ended saved progression
  belongs to a Garden Membership.

The commons is protected by the 100-flower planting footprint, the 100-claim
watering footprint, 16×16 regional pressure, and server-side validation—not by
making long play sessions stop feeling rewarding.

## Measured pace and design pace

The July 24 desktop planting run produced:

- 60 accepted plantings in 42.86 seconds
- 84 accepted plantings per minute at the observed burst pace
- 29 rejected requests caused by the former 60/minute rail

The progression curve is **not** balanced around holding that farming burst for
hours. It is balanced around a skilled player averaging roughly 40–48 helpful
actions per minute across walking, selecting, watering, planting, returning to
My Garden, and arranging items.

At 2–3 hours per day, that is approximately 4,800–8,640 Care per day. A central
planning estimate of 6,800 Care per day reaches the final 7,500,000 Lifetime
Care Basil milestone in about 1,103 days, or just over three years.

An unusually optimized farmer can finish sooner. A relaxed player can take much
longer. The game does not reduce either player’s reward rate.

## Implemented inventory curve

| Collection | Opens | Completes | Expected skilled-play horizon |
| --- | ---: | ---: | --- |
| Garden Starter | 0 | 2,000 | first sessions |
| Cottage Garden | 2,000 | 15,000 | first week |
| Pollinator Garden | 15,000 | 50,000 | first few weeks |
| Water Garden | 50,000 | 200,000 | roughly first month |

Exact implemented unlocks:

- Garden Starter: Daisy 100; Tulip 250; Wildflowers 500; Gravel 750;
  Brick 1,000; Clay pot 1,300; Hedge 1,600; collection complete 2,000.
- Cottage Garden: Peony 2,000; Fern 3,000; Hydrangea 4,500;
  Wheelbarrow 6,000; Wooden planter 7,500; Bird feeder 9,000;
  Rustic bench 11,000; Trellis 13,000; collection complete 15,000.
- Pollinator Garden: Bee balm 15,000; Butterfly bush 19,000;
  Pollinator sign 23,000; Butterfly house 28,000; Beehive 34,000;
  Rose-covered trellis 42,000; collection complete 50,000.
- Water Garden: Reeds 50,000; Lily pads 60,000; Birdbath 75,000;
  Stone basin 90,000; Willow tree 110,000; Fountain 135,000;
  Small pond 165,000; collection complete 200,000.

Existing members were converted to the equivalent new milestone so no
previously earned item was relocked. Spendable Care was not inflated.

## Planned long progression

These are the locked rollout anchors for later inventory releases:

| Collection or milestone | Lifetime Care |
| --- | ---: |
| Woodland Garden | 200,000–500,000 |
| Working Garden | 500,000–1,200,000 |
| Heritage Garden | 1,200,000–2,500,000 |
| Botanical Masterworks | 2,500,000–4,000,000 |
| Basil I | 4,000,000 |
| Basil II | 5,000,000 |
| Basil III | 6,000,000 |
| Basil IV | 6,750,000 |
| Basil | 7,500,000 |

Future item releases should fill these bands rather than compressing the
existing curve.

## Technical safety rails

- Accepted actions per anonymous actor: 150/minute.
- Accepted actions per network: 1,500/minute.
- Mutations per actor per UTC day: 30,000.
- Mutations per network per UTC day: 120,000.

These are abuse and stability protections, not gameplay targets. At the
observed 84/minute pace, three uninterrupted hours is about 15,120 actions and
remains below the actor-day rail.

## Heritage Flowers

A Community Garden flower becomes a Heritage Flower when all of these are true:

- it is at least five days old;
- it has received valid Care on at least three different UTC days;
- at least three different anonymous gardeners contributed that Care; and
- at least six other living flowers are within two tiles.

Promotion is transactional and server-authoritative. A Heritage Flower:

- clears its ordinary maximum-season expiration;
- is protected from the no-water snapshot cleanup;
- is protected from contributor succession;
- no longer counts against the planter’s newest-100 footprint; and
- displays a small gold heritage marker on the shared map.

Heritage status does not expose the planter or watering gardeners.
