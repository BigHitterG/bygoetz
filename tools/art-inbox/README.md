# Artwork Inbox

The Artwork Inbox is deliberately local-only. Raw phone uploads, incomplete
metadata, condition photographs, signature tasks, prices, and storage locations
must not be placed in `public/` or a public catalog module.

## Import a photo dump

1. Put raw photographs in `.art-inbox/assets/`.
2. Run `pnpm art:inbox`.
3. Review `.art-inbox/inbox.json` and group photographs as one of:
   - `same-artwork`
   - `same-body-of-work`
   - `separate-artworks`
   - `studio-reference`
4. Create sanitized web derivatives only for photographs approved for public use.
5. Promote confirmed public facts and media into `lib/art/catalog.ts`.

The entire `.art-inbox/` directory is gitignored. A future authenticated Studio
Desk can read the same conceptual model without changing the public catalog.
