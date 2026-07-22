# Basil Community Garden scaling

## Product boundary

Scaling must not change the game. A player still moves, plants, waters, earns Care, and switches to My Garden exactly as before. Community actions appear immediately on that player's screen. The shared public map quietly moves to a new canonical snapshot every ten minutes.

The current Community Garden is a 160 by 160 world:

- X coordinates: -96 through 63
- Y coordinates: -96 through 63
- 25,600 possible tiles
- A sparse database row exists only where a plant exists

## Phase 1 architecture (implemented)

1. The first snapshot request in a ten-minute window removes expired plants and creates one immutable, versioned view of the complete public garden.
2. The snapshot is retained in Postgres and returned through a versioned cacheable endpoint.
3. Browsers download the snapshot once, keep the complete sparse plant list locally, and filter it locally as the player walks. Walking no longer causes database reads.
4. Planting and watering are sent immediately through a server endpoint. The response is applied to the initiating player's local map immediately.
5. Every action has a client-generated unique ID. Retrying the same request cannot plant, water, or award Care twice.
6. Server-issued anonymous session keys support short-window rate limiting without storing a raw IP address or creating a public username.
7. The canonical database applies the commons controls below in the same transaction as planting, watering, or pulling a weed.
8. Only two full snapshots and 24 hours of action-deduplication records are retained.

This is intentionally not a queue. A queue would add moving parts and confirmation delay before measured action traffic requires it.

## Capacity stages

These are operating targets, not promises. Connected visitors are much cheaper than actions: 5,000 people looking at one cached snapshot is very different from 5,000 people planting every second.

| Stage | Simultaneous visitors | Sustained public actions | Architecture | Trigger to move up |
| --- | ---: | ---: | --- | --- |
| Launch | 0-1,000 | up to roughly 25/second | Ten-minute global snapshot, CDN/browser cache, immediate transactional actions | P95 action confirmation above 750 ms or database CPU repeatedly above 60% |
| Growth | 1,000-5,000 | roughly 25-150/second | Same player experience; add internal 32x32 region keys, short delta batches, stronger observability, paid database capacity | P95 above 1 second, sustained DB CPU above 70%, or snapshot payload becomes unwieldy |
| Large | 5,000-25,000 | roughly 150-500/second | Durable command ingestion, region-aware workers, canonical region versions, regional snapshot files | Queue lag or hot-region lock contention |
| Mass | 25,000+ | 500+/second | Multiple consumers, partitioned action/ledger tables, regional edge distribution, dedicated capacity | Determined from production measurements |

The Phase 1 design can serve 5,000 mostly-reading simultaneous sessions because they share a cache key and do not poll Supabase individually. It should not be marketed as supporting 5,000 simultaneous actions per second on the Supabase Free plan.

## Ten-minute snapshot behavior

- Snapshot version: Unix time divided into ten-minute windows.
- Generation: on demand by the first request in a new window.
- Browser refresh check: once per minute, with no network request until the current snapshot expires.
- Retention: latest two snapshots.
- Normal payload: only plant rows, never all 25,600 empty tiles.
- Actions: submitted immediately; never held in browser memory for ten minutes.
- Recovery: repeated action IDs return the original result.
- Conflicts: current first-valid-plant-wins and watering rules remain authoritative.

## Cached frontier entry (implemented)

- Each ten-minute snapshot now includes a small list of reusable arrival points.
- Arrival points are calculated from the snapshot already in memory, so no extra database query or per-visitor map scan is required.
- Candidates stay inside the largest connected garden footprint, contain nearby plants, retain open planting space, and are separated from one another.
- A first load chooses one candidate locally. A restored camera location always wins, so refresh and checkout recovery do not unexpectedly move the player.
- This is an entry-placement aid, not a new region system. The garden remains one 160 by 160 map with the same planting and watering rules.

No visible countdown is required. A future ecological or storytelling timer can be added as a product feature without becoming part of action correctness.

## Commons controls (implemented)

The controls are intentionally generous before they become restrictive:

| Control | Rule | Purpose |
| --- | --- | --- |
| First daily action | +4 Care | Preserve the satisfying daily return |
| 0-200 Care | +1 per meaningful action | Fast normal play |
| 201-400 Care | +1 per 4 meaningful actions | Gentle diminishing return |
| 401-600 Care | +1 per 20 meaningful actions | Long-session tail without rapid map capture |
| Daily Care | Configurable hard stop; currently 600 | A cookie bot cannot farm indefinitely |
| Daily mutations | Hard stop at 3,000 per session; 12,000 per pseudonymous network | Bounds malicious non-rewarded planting/watering |
| Live contributor footprint | 100 soft / 125 hard | The newest 100 remain; only that contributor's exact oldest overflow is scheduled to succeed at the next ecology round |
| Region size | 16 by 16 tiles | Local pressure without splitting the public garden into separate maps |
| Region pressure | Healthy below 140; busy at 140; resting at 180 | Steers new planting toward open parts of the same map |
| Absolute lifespan | Sunflower 7 days; rose 14 days; lavender 21 days | Watering cannot make one person's footprint permanent |
| Ecology round | Every ten-minute snapshot | Applies expiry, succession, pressure, and bounded weeds together |

A meaningful watering action is one that reaches the existing four-hour Care
window. Repeated watering can still animate and hydrate, but it does not advance
Care pacing. Special flowers retain their small bonus, subject to the same
600-Care ceiling. With the separate 3,000-mutation actor limit, ordinary
single-reward actions reach about 500 Care; legitimate cluster and special
rewards can advance faster but never exceed the configured ceiling.

Care receipts are now tied to the anonymous signed garden session and unique
action ID. A replay, another browser, or another account cannot claim the same
reward. The browser never decides the reward value.

## Natural pressure and weeds

Each region can hold 256 tiles, but new planting pauses at 180 live plants.
Busy regions grow at most 12 small weeds during the ten-minute ecology cycle.
Pulling a weed is a normal meaningful Care action. Weeds vanish when the region
returns to healthy density, so they regulate pressure without becoming permanent
clutter.

The private Garden Health panel reports daily anonymous contributors, awarded
Care, mutations, busy/resting regions, the densest region, weeds, scheduled
succession, whole-map occupancy, and the 65% expansion threshold. Expansion is
not automatic: the owner gets a measured signal before increasing world bounds.

## Privacy and retention

- Actor and network keys are one-way HMACs; raw IP addresses are not stored.
- Daily actor/network counters are retained for 35 days.
- Idempotency action rows remain limited to 24 hours.
- Claimed Care receipts are pruned after 30 days; the private member Care ledger remains the auditable balance source.
- Contributor keys never appear in public snapshots.

## Free-tier-safe verification

Do not send a 5,000-user synthetic test to the production Free-tier project.

Use this sequence:

1. Typecheck, lint, and production build locally.
2. Verify snapshot generation, reuse, expiry, and action idempotency with a handful of requests.
3. Verify in two browser contexts that one player's action remains local until the next snapshot.
4. Run query plans against representative data without creating large numbers of rows.
5. On a local Supabase stack or disposable test project, test 5, 20, and 50 virtual users in short runs.
6. After real traffic exists, measure cache hit rate, database CPU, action latency, error rate, and action volume before raising test levels.
7. Use a paid or disposable load-test environment for 100, 500, and 1,000-user simulations.

The checked-in `scripts/basil-load-test.mjs` runner refuses the Basil and
ByGoetz production hostnames. Remote execution also requires the explicit
`BASIL_DISPOSABLE_LOAD_TEST=I_ACCEPT_TEST_COSTS` acknowledgement.

## Measurements and thresholds

Track:

- snapshot requests and generated versions
- snapshot payload bytes and plant count
- cached versus server-served snapshot requests
- public actions per second
- P50 and P95 action confirmation latency
- duplicate action IDs
- rejected actions and rate-limit responses
- database CPU, connections, and slow queries
- ten-minute snapshot generation time

Green:

- P95 action confirmation below 750 ms
- snapshot generation below 1 second
- DB CPU below 60%

Yellow:

- P95 between 750 ms and 1.5 seconds
- DB CPU repeatedly 60-75%
- more than 100 sustained actions per second

Red:

- P95 above 1.5 seconds
- DB CPU repeatedly above 75%
- snapshot generation above 3 seconds
- elevated timeouts, duplicates, or lock waits

## Next stages, only when justified

The next improvement is internal spatial organization, not a second player-facing map. Add a computed 32x32 region key to plants and actions, then use regions for delta distribution and worker ownership while keeping the same 160x160 Community Garden.

A durable queue comes after direct transactions become a measured bottleneck. Queue analytics, snapshots, and other secondary jobs first. Queue authoritative planting/watering only when multiple region-aware consumers can confirm actions quickly enough to preserve the immediate feel.
