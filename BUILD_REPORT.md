# Marketplace | YasReady v0.7.0 — Build Report

## Result

**PASS — Real Catalog & Book Management package is ready for repository upload and demo.**

v0.7 turns the My Books area into an actual author catalog workspace while preserving the v0.6 YasReady visual system and the production/commercial ownership boundary established by the Publishing Handshake.

## Verification completed

- `node --check src/main.js` — PASS
- `node --check src/worker.mjs` — PASS
- `node --check src/lib/catalog-management.mjs` — PASS
- `node --test tests/foundation.test.mjs` — **58/58 PASS**
- `node scripts/verify-catalog.mjs` — **16/16 PASS**
- `node scripts/verify-ui-closure.mjs` — **20/20 PASS**
- `node scripts/verify-yasready-style.mjs` — **16/16 PASS**
- `node scripts/verify-pages.mjs` — **7/7 PASS**
- `node scripts/verify-publishing.mjs` — **8/8 PASS**
- fresh SQLite migration replay — **9/9 migrations PASS**
- fresh schema after migrations — **55 application tables**
- static HTTP smoke for `/`, `/src/main.js`, `/src/styles.css`, `/yasready-mark.png`, `/PREVIEW.html` — PASS

## Catalog Management closure

### Working drafts

Autosave no longer writes directly into the live Marketplace listing. Each book gets one working `catalog_draft`, with a separate draft revision and the live listing revision it was based on.

A stale browser tab receives a conflict instead of overwriting a newer draft. Applying a draft also fails if the live listing changed since that draft was based on it.

### Shared author-profile concurrency

The author storefront profile is shared across every book, so v0.7 gives it its own `profile_revision`. A draft created from Book One cannot silently overwrite a newer author bio/storefront profile saved from Book Two.

### Production truth vs commercial presentation

Publishing remains authoritative for production data such as ISBN, format, artifacts, production status and provider IDs.

Marketplace now stores reader-facing presentation as listing overrides:

- display title / subtitle
- short and long description
- optional cover override URL
- category
- excerpt
- visibility
- SEO title / description
- planned launch date metadata

Edition price and commercial status remain Marketplace-owned.

### Preview + validation

The editor includes a side-by-side reader preview. Draft validation checks required reader-facing data, live edition prices, physical ISBN requirements, production readiness and URL safety before an author can apply the draft.

Validation runs are persisted separately for provenance.

### Audit history

Every applied catalog revision writes a `catalog_change_history` row with the changed field paths plus before/after snapshots. No-op applies return without manufacturing a new listing revision.

## APIs added

- `GET /api/me/books/:bookId/editor`
- `PATCH /api/me/books/:bookId/editor`
- `GET /api/me/books/:bookId/preview`
- `POST /api/me/books/:bookId/apply-draft`
- `GET /api/me/books/:bookId/history`

## UI added

- My Books catalog summary
- revision indicators
- Edit Listing action
- full-screen YasReady catalog editor
- autosave state
- reader-facing live preview
- edition price + availability controls
- author storefront profile controls
- SEO/discovery controls
- recent revision history
- responsive mobile editor behavior

`PREVIEW.html` was rebuilt around the v0.7 Catalog Editor so `SHOWCASE.command` demonstrates this release rather than the old v0.6 home dashboard.

## Safety retained

v0.7 does not loosen any production action gate. Live money, Stripe live mode, automatic refunds/transfers, Ingram submission/imports and Publishing transport remain fail-closed by default.

The planned launch date in v0.7 is stored metadata only; no scheduler automatically publishes a book.

## Production bundle limitation in this environment

The Vite production bundle is **not claimed as verified** because this runtime does not contain the npm dependencies / Vite installation. Source syntax, engine behavior, catalog contracts, Pages deployment shape, Publishing contract, visual system and the complete database migration chain were verified independently above.

Run locally after installing dependencies:

```bash
npm install
npm run verify
```
