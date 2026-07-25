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
planning estimate of 6,800 Care per day reaches the 1,000,000 Lifetime Care
Basil I milestone in about 147 days, or roughly five months. Later Basil
prestige levels can extend the progression without slowing the first release.

An unusually optimized farmer can finish sooner. A relaxed player can take much
longer. The game does not reduce either player’s reward rate.

## Implemented inventory curve

| Collection | Opens | Completes | Expected skilled-play horizon |
| --- | ---: | ---: | --- |
| Garden Starter | 0 | 500 | first session |
| Cottage Garden | 500 | 3,750 | first sessions |
| Pollinator Garden | 3,750 | 12,500 | first week |
| Water Garden | 12,500 | 50,000 | first few weeks |

Exact implemented unlocks:

- Garden Starter: Daisy 25; Tulip 60; Wildflowers 125; Gravel 200;
  Brick 250; Clay pot 325; Hedge 400; collection complete 500.
- Cottage Garden: Peony 500; Fern 750; Hydrangea 1,100;
  Wheelbarrow 1,500; Wooden planter 1,900; Bird feeder 2,250;
  Rustic bench 2,750; Trellis 3,250; collection complete 3,750.
- Pollinator Garden: Bee balm 3,750; Butterfly bush 4,750;
  Pollinator sign 5,750; Butterfly house 7,000; Beehive 8,500;
  Rose-covered trellis 10,500; collection complete 12,500.
- Water Garden: Reeds 12,500; Lily pads 15,000; Birdbath 19,000;
  Stone basin 22,500; Willow tree 27,500; Fountain 34,000;
  Small pond 41,500; collection complete 50,000.

Existing members were converted to the equivalent new milestone so no
previously earned item was relocked. Spendable Care was not inflated.

## Planned long progression

These are the locked rollout anchors for later inventory releases:

| Collection or milestone | Lifetime Care |
| --- | ---: |
| Woodland Garden | 50,000–125,000 |
| Working Garden | 125,000–300,000 |
| Heritage Garden | 300,000–625,000 |
| Botanical Masterworks | 625,000–1,000,000 |
| Basil I | 1,000,000 |

Future item releases should fill these bands. Basil II and later prestige
milestones will be designed when their inventory exists rather than making the
current path artificially long.

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
