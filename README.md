# Marketplace | YasReady v0.7.0

**Real Catalog & Book Management**

Marketplace remains a standalone YasReady product/repository for `marketplace.yasready.com`. v0.7 turns **My Books** into a real author operating workspace while preserving the one-way Publishing boundary established in v0.5 and the YasReady shell closed in v0.6.

## What changed in v0.7

Authors can now open a full catalog editor for a book and manage the commercial layer without editing Publishing production truth.

### Catalog editor

- reader-facing title and subtitle overrides
- short and full descriptions
- optional storefront cover override URL
- category and excerpt / preview copy
- public, direct-link or private visibility
- per-edition price
- per-edition draft / live / paused availability
- author storefront display name, tagline, bio and website
- SEO title and description
- planned launch date metadata
- live preview beside the editor

The preview updates while the author edits. ISBN, format, production status and fulfillment provider are intentionally displayed as production-owned/locked information.

### Autosave without changing the live store

v0.7 does **not** autosave directly into the live listing. Each book has one working `catalog_draft`.

- edits debounce into an autosave
- draft revisions protect against stale browser tabs
- the live listing has its own revision number
- the author previews the draft before applying it
- `Apply changes` performs validation and atomically updates Marketplace-owned fields
- a stale draft cannot overwrite a newer live revision
- a no-op apply does not create a fake revision

### Change history and validation provenance

Every applied revision records which commercial fields changed. Validation results are also stored separately, so Marketplace can explain why a draft was or was not ready instead of recomputing history later.

### Publishing stays protected

Publishing still owns:

- ISBN
- edition format
- production artifact reference/hash
- production status
- provider identifiers
- original source metadata and revision

Marketplace stores reader-facing presentation as overrides on the listing. A Publishing sync can continue updating production truth without silently replacing Marketplace price or commercial presentation choices.

## API added in v0.7

- `GET /api/me/books/:bookId/editor`
- `PATCH /api/me/books/:bookId/editor`
- `GET /api/me/books/:bookId/preview`
- `POST /api/me/books/:bookId/apply-draft`
- `GET /api/me/books/:bookId/history`

See `docs/CATALOG-MANAGEMENT.md` for the ownership and concurrency contract.

## Database

New migration: `0009_catalog_management.sql`

It adds Marketplace presentation override fields plus:

- `catalog_drafts`
- `catalog_change_history`
- `catalog_validation_runs`

Fresh migration replay now produces **55 application tables**.

## YasReady product boundaries retained

**Publishing | YasReady** → production truth and finished book assets  
**Marketplace | YasReady** → storefront, catalog, commerce, promotion, fulfillment and commercial analytics  
**Business | YasReady** → future company-wide intelligence consumer

The same central YasReady user identity maps into Marketplace; there is still no second author password/account.

## Safety defaults retained

Live money, Stripe live mode, automatic refunds/transfers, Ingram submission/import paths and Publishing transport remain fail-closed unless explicitly configured. v0.7 does not loosen any provider safety gate.

## Quick showcase

Double-click:

```bash
SHOWCASE.command
```

This opens the no-install v0.7 catalog-management preview.

## Verification

```bash
npm test
npm run verify:catalog
npm run verify:ui
npm run verify:style
npm run verify:pages
npm run verify:publishing
```

Full local verification after installing dependencies:

```bash
npm install
npm run verify
```

The repository remains configured for `3dudes1life/yasready-marketplace` and the eventual production domain `marketplace.yasready.com`.
