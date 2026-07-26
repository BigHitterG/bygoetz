# Community Garden regional delivery foundation

Status: additive compatibility layer; current gameplay still uses the full
ten-minute snapshot.

## Purpose

The Founding Garden remains the existing 160 by 160 world (`-96..63` on both
axes). This foundation exposes that same canonical snapshot as one manifest
plus 100 independently addressable 16 by 16 regions. It does not open land,
move flowers, change action processing, or switch the browser to regional
loading.

## Public read contracts

### Region manifest

`GET /api/community-garden/regions/manifest?version={tenMinuteVersion}`

The response contains:

- the canonical snapshot version and timestamps;
- the fixed Founding Garden and region bounds;
- all 100 region coordinates and tile bounds;
- per-region plant, Heritage Flower, and weed counts;
- per-region pressure and effective occupancy; and
- the existing cached arrival points.

### Region snapshot

`GET /api/community-garden/regions/{regionX}/{regionY}/snapshot?version={tenMinuteVersion}`

The response contains only the plants and weeds inside that 16 by 16 region,
using the same record shapes as the existing full snapshot. Coordinates outside
the Founding Garden return `404` until authoritative land-opening rules make
them available.

Both endpoints share the immutable version-cache behavior of the current full
snapshot. Warm instances reuse one canonical snapshot and CDN caching limits
repeated work. A cold instance may still read the full canonical snapshot, so
this is compatibility groundwork rather than the final database-read reduction.

## Compatibility guarantee

`fetchGardenSnapshot()` intentionally continues to call
`/api/community-garden/snapshot`. Regional delivery is not active in the game
client yet. A later release may compare full and regional results in shadow
mode, then move only visible and adjacent chunks after parity, reconnect, and
mobile-suspension tests pass.

## Security and privacy

The endpoints expose only the same public plant and weed data already present
in the canonical snapshot plus aggregate regional counts. They never expose
contributor keys, user IDs, network keys, support-credit records, or owner-only
frontier decisions.
