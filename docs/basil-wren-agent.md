# Wren: Basil's AI-directed garden steward

Wren is a persistent, transparent system resident in Basil. Wren is not a hidden human account and is not continuously connected to a language model. The current planner is a scheduled Codex task. Basil's server validates every proposed action, applies a small daily non-player Care budget, executes only allowlisted work, and writes an action trace before the result may be narrated as real.

Public disclosure:

> Wren is an AI-directed Basil garden steward. Codex selects daily missions; Basil's server rules validate and log every action.

The public profile is `/community-garden/wren`; the machine-readable record is `/api/community-garden/wren`. Private planning records, coordinates used for future work, credentials, tokens, and unreviewed diary drafts never leave service-role code.

## Current architecture

1. The scheduled Codex task reads recent missions, action traces, diary drafts, Creator Studio feedback, published-post history, and comparable performance windows.
2. Codex writes one bounded mission and ordered decisions with `planner_mode=codex_scheduled` and autonomy tier 2.
3. Basil policy marks allowed decisions. Narration, captions, and social copy have no execution authority.
4. The existing half-hour Founding Steward heartbeat grants at most the configured daily Care budget and executes no more than three Wren My Garden actions per session.
5. The runtime writes before/after evidence, a replay-safe trace, a persistent My Garden snapshot, and an evidence-backed draft diary entry.
6. The next creative run selects three fresh content lanes from real evidence. Creator Studio remains the approval boundary for publication.
7. Published results are stored by variant at 1-hour, 24-hour, and 7-day windows, then become planning context for the next run.

## Autonomy contract

- Tier 0: observe only.
- Tier 1: propose decisions for review.
- Tier 2: execute allowlisted, reversible or low-risk garden decisions inside explicit budgets. This is Wren's current tier.
- Tier 3: reserved and disabled.

Tier 2 does not permit Wren to publish social posts, change account settings, spend money, create credentials, alter policy, grant itself progression, or bypass Creator Studio approval. The daily care ledger is private, capped at eight Care, and does not increase human lifetime progression or consume player rewards.

## Identity and continuity

Wren has:

- a system-owned `garden_stewards` row with no authentication user;
- a permanent moss-and-amber sprite rendered by Basil's real game renderer;
- a persistent My Garden, inventory balance, missions, decisions, action traces, snapshots, and diary;
- a public biography and explicit AI-directed label;
- no claim of consciousness, emotions, unrestricted memory, or continuous model connection.

Stored preferences, goals, uncertainties, and failed experiments may be narrated when they are present in the mission or action ledger. A social script may not invent an action merely because the renderer could depict it.

## Capture and provenance

`/community-garden/social-capture?captureMode=live_gameplay` mounts the production `GardenCanvas` in a clean 9:16 capture shell with Wren as the actor. It removes browser chrome, navigation, the map, compass, north marker, and irrelevant UI. The canvas exposes controlled walking, actor-following camera, checkpoint, idle, and capture-stream methods for the renderer. For ordinary field footage the browser records that real canvas directly with `MediaRecorder`; the slower frame-by-frame renderer remains available for deterministic illustration and recovery.

Each schema-version-3 creative manifest records:

- Wren's identity, autonomy tier, planner mode, and disclosure;
- mission, content lane, objective, hypothesis, and alternative hooks;
- capture mode and provenance;
- source action IDs when an action is claimed;
- supported truth claims and platform adaptations.

Real-time footage from the production canvas is labeled real gameplay. A deterministic replay must reference completed traces and say it is a replay. The legacy generated scene is fallback-only and must be labeled an illustration.

The intended low-compute evolution is session-first: Wren completes one bounded, logged play session; Basil retains one clean gameplay recording plus its timestamped action/checkpoint timeline; the creative run selects the strongest non-overlapping moments and cuts an agent diary, a current garden fact, and a mechanic or discovery explanation from that shared source. Text, narration, music, and alternate openings are edit layers, so the game session is not re-rendered for every hook. The secure runtime remains authoritative: scheduled actions happen server-side, and any later capture is a truthful replay tied to the same trace IDs rather than a second production mutation.

## Social learning loop

The default three lanes are agent diary, field footage, and experiment/discovery. A materially changed garden status or founder explanation may replace one. Recent missions, subjects, hooks, action traces, layouts, and narration patterns are excluded for seven packages unless new evidence supports a follow-up.

The learning hierarchy is chose-to-view, average percentage viewed, completion, replay, shares/saves/meaningful comments, profile/link activity, Basil sessions, game starts, and first flowers planted. The north-star rate is first flowers planted per 1,000 impressions. Missing platform data is stored as missing, not converted to zero.

## Future live AI connector

`lib/communityGarden/agentPlanner.ts` defines the planner seam. `CodexScheduledPlanner` is active. `ExternalApiPlanner` exists only as a disabled adapter and throws if called.

A future model connection may be enabled only after it has:

- server-side credentials and explicit cost/rate limits;
- structured mission output with an allowlisted schema;
- the same policy validation and action budgets used by scheduled Codex;
- complete decision, model-version, tool, and outcome auditing;
- timeout, retry, kill-switch, and deterministic fallback behavior;
- no direct database, social publishing, credential, or payment authority;
- a clear public disclosure update and creator-controlled rollout.

Changing the planner does not change the executor or Creator Studio approval boundary. That is the point of the adapter.
