# bygoetz

A Next.js/React Apple Watch-style honeycomb home interface with pannable, zoomable, rearrangeable app bubbles.

## Development

Run the local Next.js app from the repository root:

```bash
npm install
npm run dev
```

Then open the local URL printed by Next.js, usually <http://localhost:3000>.

If you only see this README text on the public homepage, GitHub Pages is serving the repository README instead of the built Next.js app. This project is configured for a static Next.js export, and the included GitHub Actions workflow deploys the generated `out/` directory to Pages.

## GitHub Pages deployment

1. Commit and push to the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Run the **Deploy Next.js site to GitHub Pages** workflow, or push to `main` to trigger it automatically.
