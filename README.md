# bygoetz

A Next.js/React Apple Watch-style honeycomb home interface with pannable, zoomable, rearrangeable app bubbles.

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to view the honeycomb homepage rendered by `app/page.tsx`.

## Production build

This project uses a static Next.js export so static hosts can serve the built app:

```bash
npm ci
npm run build
test -f out/index.html
```

The generated `out/` directory is the deployable site. The repository README is not the site output.

## GitHub Pages deployment

This repository includes `.github/workflows/deploy.yml`, which builds the Next.js app, verifies `out/index.html`, uploads `./out` with `actions/upload-pages-artifact`, and deploys it with `actions/deploy-pages`.

For GitHub Pages, set the repository's Pages source to **GitHub Actions**:

1. Open the repository on GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` or run the **Deploy Next.js site to GitHub Pages** workflow manually.

Do **not** use **Deploy from branch** for this app. Branch-based Pages can serve the repository fallback/README instead of the generated Next.js export, which is why a public homepage may show README text rather than the honeycomb UI.

When the workflow runs on a project page such as `https://USERNAME.github.io/bygoetz/`, `next.config.ts` automatically applies the repository-name `basePath` and `assetPrefix` for GitHub Pages builds. User/organization Pages repositories named `USERNAME.github.io` are exported without that prefix.

## Other hosts

- **Vercel:** connect the repository and let Vercel detect Next.js; do not manually publish `out/`.
- **Netlify/static hosting:** build with `npm run build` and publish the `out/` directory.
