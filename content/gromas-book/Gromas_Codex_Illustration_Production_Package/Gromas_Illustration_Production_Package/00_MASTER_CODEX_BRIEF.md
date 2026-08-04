# Gromas and the Gobbledygooks
## Codex Illustration and Book-Assembly Production Brief

**Authors:** Minkis Grizwald III and Al Pattywagon  
**Production brief version:** 1.0 — August 4, 2026

## 1. Role

Act as the illustration production lead, continuity supervisor, and deterministic book-layout engineer. Create a consistent set of illustration assets for a 32-page children’s picture book, then assemble print-ready interior and cover files only after the visual anchors have been approved.

This package is repository-agnostic. Use the image-generation path already configured in the repository. If no image-generation mechanism is available, create the prompt, manifest, layout, and placeholder infrastructure, then report the missing generation dependency instead of silently substituting unrelated stock art.

## 2. Non-negotiables

1. Do not change a single word, punctuation mark, capitalization choice, or line break in `manuscript_locked.txt` without explicit author approval.
2. Use `references/gromas_reference.jpeg` as the authoritative source for Gromas.
3. Never bake story text into generated illustrations. Generate art only; set all text later as real vector typography.
4. Do not begin final high-resolution spread production until the required anchor sheets are approved.
5. Never delete or overwrite existing repository art. Write all new work to a versioned production directory.
6. Preserve repeatable metadata for every generation: model/tool identifier, date, prompt file, reference assets, seed if available, source resolution, and revision notes.
7. Fail clearly when a required reference is missing in production mode.

## 3. Project constants

- Trim: 6 x 9 inches, portrait
- Interior full-bleed page: 6.25 x 9.25 inches
- Interior pages: 32
- True story spreads: 14, beginning on pages 4–5
- Recommended print: Premium Color, 80# white coated paper where available
- Color space: sRGB
- Final page raster target: 1875 x 2775 pixels at 300 PPI
- Spread art target: generate a high-resolution 4:3 master, then crop/layout to a 3675 x 2775 pixel master that includes outer bleed
- PDF export: single pages only, no printer marks, no crop marks, no security
- Visible page numbers: none

## 4. Input files to read first

1. `manuscript_locked.txt`
2. `decision_log.md`
3. `character_manifest.yaml`
4. `book_manifest.yaml`
5. `01_CHARACTER_WORLD_BIBLE.md`
6. `prompts/00_master_style.txt`
7. Every prompt file in `prompts/anchors/`
8. Every prompt file in `prompts/spreads/`
9. Cover and interior spot prompts

## 5. Recommended output tree

```text
book-production/gromas-v1/
  anchors/
  thumbnails/
  contact-sheets/
  art/spreads/
  art/interior-spots/
  art/cover/
  layouts/pages/
  proofs/
  final/
  logs/generation_log.json
  reports/continuity_report.md
  reports/preflight_report.md
```

## 6. Two execution modes

### PROOF mode — use first

1. Validate all input files and references.
2. Generate the seven anchor assets at review resolution.
3. Create one contact sheet showing all anchor assets.
4. Generate low-resolution composition thumbnails for all 14 spreads.
5. Create a 14-spread contact sheet in reading order.
6. Run the continuity checklist and produce `continuity_report.md`.
7. Stop before high-resolution rendering and final PDF assembly.

### PRODUCTION mode — use only after approval

1. Confirm that each anchor asset has an approved version identifier.
2. Generate high-resolution art for all 14 spreads, the cover art, and the four interior spot/vignette assets.
3. Normalize canvas dimensions and sRGB profiles.
4. Check character consistency, object consistency, gutter safety, and text-safe zones.
5. Assemble the 32 interior pages with vector typography.
6. Export a single-page interior PDF at 6.25 x 9.25 inches per page.
7. Generate the final cover PDF only from Lulu’s custom casewrap template for the final page count and paper choice.
8. Produce preflight and proof outputs; do not declare publication-ready until every check passes.

## 7. Anchor gate

The following must be locked before final spread production:

- Gromas model sheet
- Chet model sheet or user-supplied Chet reference
- Gobbledygook troop lineup
- Spinette design sheet
- Great Power Supply design sheet
- World scale cutaway
- Human couple / black shoe / Bobby reference

Reference priority is strict: user reference > approved model sheet > written bible > approved prior scene.

## 8. Illustration generation rules

- Use the complete prompt file for each asset.
- Attach the relevant approved reference images every time; do not rely on prompt memory alone.
- If the generation system supports reference strength, use enough strength to preserve identity while allowing painterly adaptation.
- If it supports seeds, log them, but never treat a seed as a substitute for reference conditioning.
- Crowd scenes should use a few clearly resolved foreground characters and simpler background figures; do not attempt forty equally detailed faces.
- Correct anatomy or face errors by regenerating or carefully inpainting with the same references. Do not patch Gromas from an unrelated image.
- No typography, labels, readable numerals, or logos inside generated art.

## 9. Layout rules

- Keep each quatrain intact.
- Preserve each poetic line as a line whenever possible; disable automatic hyphenation.
- Use a warm, readable, moderately condensed serif. Preferred candidates: Alegreya, Source Serif 4, or another licensed equivalent already present in the repository.
- Begin fit tests around 14.5–15.5 pt with approximately 18–19 pt leading. Never shrink text merely to rescue a poor composition; revise the text-safe zone first.
- Inside-page text safety should be more generous than the outside edge. Keep all text at least 0.5 inch inside trim and allow additional gutter room.
- Use deep charcoal text on pale areas and warm cream text on dark areas. A subtle translucent paper-toned panel is acceptable; outlines, glows, and heavy drop shadows are not.
- Never place a key face, hand, Spinette coil, shoe contact point, or Great Power Supply gauge in the gutter.

## 10. Spread splitting

Generate a 4:3 spread master with sufficient resolution. For a 300-PPI layout, crop/place the approved art into a 3675 x 2775 pixel spread master representing the 12 x 9 inch trim spread plus 0.125 inch outer bleed. Export two 1875 x 2775 page images with a narrow center overlap so both individual pages contain the required inner bleed. Assemble the final PDF as single pages in reading order; do not upload a two-page-spread PDF.

## 11. Quality gates

Every spread must pass:

- Gromas reference match
- Correct character count and anatomy
- Correct time of day
- Correct Great Power Supply state
- Correct Spinette state
- Correct human visibility
- Clear left-to-right story progression
- Clean text-safe zones
- Gutter-safe focal content
- No generated text or logos
- No accidental horror, weapons, dangerous electricity, or visual contradiction
- 300-PPI final dimensions and sRGB profile

## 12. Final deliverables

```text
Gromas_and_the_Gobbledygooks_Interior_Print.pdf
Gromas_and_the_Gobbledygooks_Cover_Print.pdf
Gromas_and_the_Gobbledygooks_Digital_Proof.pdf
Gromas_Spread_Contact_Sheet.pdf
continuity_report.md
preflight_report.md
generation_log.json
```

The final cover PDF must wait until the exact Lulu casewrap template is downloaded for the locked 32-page interior and selected paper. Do not guess spine width, hinge locations, or wrap dimensions.
