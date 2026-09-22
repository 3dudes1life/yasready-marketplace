# GitHub Pages demo deployment

The v0.3 white page was caused by serving raw Vite source from a GitHub project site while `index.html` referenced `/src/main.js`. On a project site that resolves against `https://3dudes1life.github.io/`, not `/yasready-marketplace/`. Raw browser modules also cannot import CSS as JavaScript.

v0.4 makes the repository-root demo Pages-safe:

- `./src/main.js` relative module path
- `./src/styles.css` linked from HTML
- QRCode is lazy-loaded only inside Promote, so an optional CDN failure cannot blank the storefront
- guarded `import.meta.env` access
- project-safe marketing links
- `404.html` redirect for pretty `/book/...` links
- `npm run verify:pages` / `PAGES_VERIFY.command` guard

Cloudflare production remains the intended home for `marketplace.yasready.com`; GitHub Pages is the demo surface.
