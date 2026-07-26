# Community Garden regional delivery

Status: active regional hydration with a full-snapshot recovery path.

## Purpose

The Founding Garden remains the existing 160 by 160 world (`-96..63` on both
axes). The canonical state is exposed as a privacy-safe manifest, independently
addressable 16 by 16 regions, and one bounded regional-window response. This
does not open land, move flowers, change Care, or change authoritative action
processing.

## Public read contracts

### Region manifest

`GET /api/community-garden/regions/manifest?version={tenMinuteVersion}`

The response contains:

- canonical snapshot version and timestamps;
- open-world and map-display bounds;
- open regions plus nearby frontier planning cells;
- aggregate plant, Heritage Flower, weed, pressure, and occupancy values;
- coarse player-facing Growing Edge stage and support level; and
- balanced cached arrival points.

### Region snapshot

`GET /api/community-garden/regions/{regionX}/{regionY}/snapshot?version={tenMinuteVersion}`

The response contains only the public plants and weeds inside one open 16 by 16
region. Coordinates outside open land return `404` until an authoritative
manual land-opening decision makes them available.

### Regional window

`GET /api/community-garden/regions/window?centerX={x}&centerY={y}&radius=2&version={tenMinuteVersion}`

This returns plants and weeds from the visible-and-adjacent five-by-five region
window in one request. The client requests a new window only after the player
crosses a region boundary or the ten-minute snapshot advances.

All endpoints share versioned CDN caching. Warm server instances reuse one
canonical snapshot, so nearby clients do not produce repeated database reads.

## Compatibility guarantee

The client prefers the manifest and regional-window endpoints. If either is
unavailable, it automatically calls the previous full-snapshot endpoint. Recent
accepted local plants remain overlaid until a sufficiently new authoritative
snapshot confirms them, so changing delivery does not reintroduce disappearing
optimistic flowers.

## Security and privacy

The endpoints expose only the public plant and weed fields already present in
the canonical snapshot plus aggregate regional values and coarse public stages.
They never expose contributor keys, user IDs, network keys, exact quorum
evidence, support-credit records, or owner-only reasoning. The public manifest
is sanitized from the service-role-only founder dashboard.
