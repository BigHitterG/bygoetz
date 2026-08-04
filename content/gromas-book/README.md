# Gromas and the Gobbledygooks — Codex Book Project

This directory is the source of truth for illustrating and assembling the book. It is intentionally separate from the Basil application and does not require a new website route.

## Start Codex here

Open the `gromas-book-setup` branch and give Codex this instruction:

```text
Read content/gromas-book/README.md and content/gromas-book/00_MASTER_CODEX_BRIEF.md.
Treat content/gromas-book/manuscript_locked.txt as immutable.
Use content/gromas-book/references/gromas_reference.svg as the authoritative visual identity reference for Gromas.
Run PROOF mode only. Create the seven anchor sheets and low-resolution thumbnails for all fourteen story spreads. Write all generated work under book-production/gromas-v1/. Do not modify Basil, shared site code, payment code, Supabase configuration, or unrelated assets. Stop after the proof package and continuity report are complete.
```

## Read in this order

1. `00_MASTER_CODEX_BRIEF.md`
2. `manuscript_locked.txt`
3. `decision_log.md`
4. `01_CHARACTER_WORLD_BIBLE.md`
5. `02_14_SPREAD_PROMPTS.md`
6. `03_COVERS_ANCHORS_AND_SPOTS.md`
7. `book_manifest.yaml`
8. `character_manifest.yaml`
9. `04_PRODUCTION_QA.md`
10. `05_LULU_PRODUCTION_NOTES.md`

## Reference image

`references/gromas_reference.svg` is a lossless repository wrapper around the author-supplied JPEG. It displays the original reference and is suitable for browser preview and image-reference use. Codex may export its embedded JPEG to the versioned production directory if a downstream image tool requires a raster file. Do not redesign Gromas.

## Scope

- 6 × 9-inch portrait casewrap hardcover
- 32 interior pages
- 14 illustrated story spreads
- Proof anchors and thumbnails first
- Final high-resolution production only after author approval
