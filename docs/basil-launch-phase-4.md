# Basil Launch Phase 4 — dedicated domain

Last updated: July 22, 2026

## Boundary

Phase 4 does **not** move or rename the ByGoetz website. The existing application,
Vercel project, Supabase project, Stripe account, and codebase remain shared.

- `https://basilcommunitygarden.com/` is the primary Basil game URL.
- `https://www.bygoetz.com/` remains the ByGoetz/LazyGrid home.
- Explorers remains on its existing ByGoetz routes.
- `https://www.bygoetz.com/community-garden` remains a supported compatibility URL.

The Next.js `beforeFiles` routing rule rewrites `/` to `/community-garden` only when the
request host is an exact Basil hostname. It never rewrites the ByGoetz root.

## Implemented application behavior

- Added `NEXT_PUBLIC_BASIL_URL`, with `https://basilcommunitygarden.com` as the safe default.
- Added Basil-specific canonical, Open Graph, Twitter, policy, and navigation URLs.
- Updated the LazyGrid Basil entry to open the dedicated Basil origin.
- Updated verification, password recovery, pending-purchase, Stripe success/cancel, and
  Meta source URLs to use the Basil origin.
- Kept Explorers on `NEXT_PUBLIC_SITE_URL`; that variable remains the global ByGoetz URL.
- Added an exact production-origin allowlist for Basil mutations. Lookalike and unknown
  origins are rejected; no caller can supply an arbitrary redirect origin.
- Restored the signed pending-garden claim from authoritative Stripe session metadata on
  the Basil return. This allows a preview begun on the legacy ByGoetz route to survive the
  cross-domain checkout return.
- Kept UTM and launch-session persistence unchanged. New ad landings on the Basil origin
  retain attribution through the existing server-backed purchase handoff.

## Required production configuration

### Vercel

Use the existing `bygoetz` project (`prj_MXqx7eJDGtvK0XOOB80zVSUnTxdo`). Do not create a
second project.

1. Attach `basilcommunitygarden.com` to the project. Completed July 22, 2026.
2. Attach `www.basilcommunitygarden.com`. Completed July 22, 2026; it may remain a
   compatible host or be redirected to the apex after certificate issuance.
3. Confirm the apex and `www` certificates are valid. Completed July 22, 2026.
4. Add production environment variable
   `NEXT_PUBLIC_BASIL_URL=https://basilcommunitygarden.com`. Completed July 22, 2026.
5. Keep `NEXT_PUBLIC_SITE_URL=https://www.bygoetz.com` unchanged.
6. Redeploy production after the environment variable is saved.

The domain reports Vercel nameservers and both hostnames are attached to the exact project.
Both hostnames returned HTTPS 200 responses with HSTS on July 22, 2026.

### Supabase Auth

In project `qripkmzrujarmmbgewub`, set the production Site URL to
`https://basilcommunitygarden.com` and retain exact additional redirect URLs for:

- `https://basilcommunitygarden.com/`
- `https://basilcommunitygarden.com/community-garden`
- `https://www.bygoetz.com/community-garden`

Keep any required local-development URLs outside production review. Basil currently sends
custom token-hash links and completes them through `verifyOtp`; the allowlist is still kept
accurate for recovery, future Auth flows, and defense in depth.

### Stripe

No new Stripe account or product is required. Checkout Sessions now receive canonical Basil
success and cancel URLs from the server. Keep the existing signed webhook endpoint active.
Do not configure a generic user-supplied return URL.

### Resend

No sender-domain change is required. `garden@send.bygoetz.com` may remain the verified
sender. The application-generated verification and recovery links now use the Basil domain.
Confirm one live message shows the Basil URL and reaches its destination.

### Meta

Add and verify `basilcommunitygarden.com` in the existing ByGoetz Business Portfolio. Use
Meta's supplied DNS TXT value through the Vercel DNS zone, then confirm verification in
Business Settings. The existing Pixel ID remains unchanged. Test Events must show browser
events from the Basil hostname and one deduplicated server/browser Purchase.

## Security and migration notes

- Browser authentication and local storage are origin-scoped. An existing member may need
  to sign in once on the new Basil domain; the account, entitlement, Care, and My Garden are
  server-side and appear after sign-in.
- An unpaid local preview does not automatically cross domains merely by opening a new tab.
  The supported purchase transition writes the preview server-side before Stripe and restores
  it after return.
- Existing checkout sessions keep the return URL they were created with. New sessions use
  the Basil domain; the old claim route remains compatible.
- Anonymous Community Garden state is shared because both hosts use the same canonical
  Supabase data and API implementation.

## Completion checks

- [x] Basil apex loads the game and does not show LazyGrid.
- [x] ByGoetz apex still shows LazyGrid.
- [x] Explorers routes are unchanged.
- [x] Legacy `/community-garden` loads safely.
- [ ] Guest planting works on the Basil apex.
- [ ] Verification email and password recovery return to the Basil apex.
- [ ] Checkout cancel returns to the same guest preview.
- [ ] A paid checkout returns to My Garden with the preview intact.
- [ ] The verified account shows its entitlement and saved garden.
- [x] Unknown Origin requests receive HTTP 403.
- [x] Policy links and social preview use the Basil domain.
- [ ] Pixel events attribute to the Basil domain.
- [x] HTTPS is valid for apex and `www`.

## Verification evidence

On July 22, 2026, the optimized Next.js production build passed. A local production server
was requested with exact Host headers:

- `basilcommunitygarden.com` returned `Basil | Community Garden`.
- `www.bygoetz.com` returned `Honeycomb Home`, not Basil.
- An unknown-Origin POST to the Basil checkout endpoint returned HTTP 403.

This proves the application boundary before deployment; the remaining checklist items require
the live certificates and external Auth/Meta configuration.

Production deployment `dpl_4WmnhPZRBZU5P1Qmd2B7nYf7jQM6` from commit
`06d18529e6e802fbd9c61424c62d49c2d6bfdde8` reached `READY` on July 22, 2026.
Live checks then confirmed:

- `https://basilcommunitygarden.com/` returned the Basil game, a Basil canonical URL,
  HTTPS, and HSTS.
- `https://www.basilcommunitygarden.com/` returned the same game and canonicalized to the
  apex Basil URL.
- `https://www.bygoetz.com/` still returned `Honeycomb Home`.
- `https://www.bygoetz.com/community-garden` still returned Basil and used the dedicated
  Basil canonical URL.
- `https://www.bygoetz.com/explorers` still returned the Explorers experience.
- `https://basilcommunitygarden.com/community-garden/privacy` returned the public Basil
  privacy policy with the dedicated canonical URL.
- `https://basilcommunitygarden.com/api/community-garden/snapshot` returned the shared
  canonical garden snapshot successfully.

The remaining gate items are the Supabase Auth allowlist, Meta domain verification, and one
real verification/recovery/checkout restoration test on the new hostname.

Phase 4 is complete only after these live checks pass. Domain attachment and external
dashboard configuration are operational changes, not reasons to duplicate the application.
