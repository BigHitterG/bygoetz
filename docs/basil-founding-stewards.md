# Basil Founding Stewards

## Purpose

Basil starts with three server-run Founding Stewards—Rowan, Clover, and Wren—so
the shared garden behaves like a small but active community while the real
membership grows. They are controlled test accounts, not visible simulated
players.

## Same garden rules as players

Every steward action calls the same idempotent Community Garden action used by
an account player. That means the normal Care rewards, 100-plant footprint,
100-watering footprint, weeds, tile conflicts, regional pressure, and Heritage
Flower qualification all apply. Each steward may naturally establish one
Heritage Flower under the same one-per-account rule.

Stewards do not have My Garden, cannot unlock land, never create browser
presence or an avatar, and receive no private-member inventory progression.
Their actions cannot directly bypass or force a frontier unlock.

## Daily pace

Each enabled steward is scheduled for:

- 105 planting actions;
- 360 watering actions; and
- 12 weed-removal actions.

That is 477 actions per steward per Central-time day and 1,431 across all three.
There is no population-based slowdown. Work is divided over 32 half-hour slots
from 7:00 a.m. through 10:59 p.m. Central. A session may catch up safely, but is
limited to 24 actions per steward so the work remains bursty and bounded.

## Human-like movement model

The server does not animate an invisible avatar. Instead it gives each steward
a local session anchor and makes choices that correspond to ordinary play:

- planting advances along a short row, bend, or compact patch;
- watering starts on an eligible droplet flower and follows a connected local
  chain of up to six eligible flowers, using the normal watering action;
- weed removal prefers nearby weeds;
- one session stays local, while later sessions may begin in another region;
- work stays at least 12 tiles from all current tutorial spawn points; and
- stewards never target guest-owned tutorial flowers.

This creates visible garden effects without scatterplot planting, teleport-like
target selection, or onboarding interference.

## Reliability and privacy

The half-hour worker is resumable. Every scheduled action has a deterministic
daily ID, so duplicate cron deliveries cannot award duplicate Care or mutate the
garden twice. Database planning and audit functions are service-role-only with
RLS enabled. Actor and network keys never appear in the founder dashboard.

## Founder monitoring

The private Garden Health panel shows:

- progress against all daily planting, watering, weed, and combined targets;
- flowers reached by watering chains;
- seven-day work, failures, and regions supported;
- per-steward progress for the current Central-time day; and
- Heritage care and promotion totals.

Disabling a steward row stops future work without deleting legitimate garden
history. If there are no paid Basil members, the worker skips the session.
