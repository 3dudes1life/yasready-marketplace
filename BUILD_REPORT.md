# Marketplace | YasReady v0.8.0 — Build Report

**Release:** Consumer Marketplace Closure  
**Target:** `marketplace.yasready.com`  
**Repository:** `3dudes1life/yasready-marketplace`

## Release objective

v0.8 turns the public side of Marketplace into a reader product while preserving the author operating system completed in v0.6–v0.7. It also establishes the canonical reader-data contract intended to power the future **YasReady. Books** app.

The core rule is unchanged: more capability should not create a second account or a second copy of the book. A central YasReady identity may act as an author and a reader; Marketplace owns commercial/reader truth while Publishing continues to own production truth.

## Consumer experience added

- Consumer-first discovery hero and search.
- Genre shortcuts.
- Digital-first ebook shelf.
- Audiobook shelf when live audio editions exist.
- Recently viewed shelf.
- Saved books page and save/remove interactions.
- Public author storefront view.
- Series page with reading order.
- Richer book detail view with format choices and digital-library messaging.
- Mobile-first consumer styling separate from the author operating shell.
- No-install static showcase updated to demonstrate the reader/library direction.

## Reader platform foundation

Migration `0010_consumer_marketplace.sql` adds:

- central YasReady `user_id` mapping for customers
- customer profile/last-seen fields
- book series metadata
- `customer_saved_books`
- `customer_recent_books`
- `reader_progress`
- `author_follows`
- `reader_activity_events`

The existing `customer_entitlements` table remains the durable ownership source of truth for purchased ebooks/audiobooks.

Reader APIs now include:

- `GET /api/reader/session`
- `GET /api/reader/library`
- `GET /api/reader/saved`
- `POST/DELETE /api/reader/saved/:bookId`
- `GET /api/reader/recent`
- `POST /api/reader/recent/:bookId`
- `PATCH /api/reader/progress/:editionId`
- `POST/DELETE /api/reader/follow/:authorId`

Progress updates require an active entitlement and the submitted progress kind must match the digital edition format.

## YasReady. Books boundary

v0.8 intentionally does **not** build a production EPUB reader, audiobook player, DRM system, protected file delivery, or offline downloads. It builds the account, entitlement, saved/recent and progress seams those clients will consume.

This avoids creating a later app-specific library database that would diverge from Marketplace purchases.

## Existing systems preserved

- v0.7 catalog autosave/preview/apply/history.
- Marketplace-owned presentation vs Publishing-owned production truth.
- v0.6 YasReady author operating shell and visual system.
- v0.5 signed Publishing handoff and explicit author go-live gate.
- v0.4 Ingram/provider bridge.
- v0.3 commerce accounting, settlements, refunds, transfer and fulfillment records.
- Marketing attribution and Business export contract.
- Live-money/provider switches remain fail-closed.

## Verification actually run

- **66/66** Node engine/regression tests passed.
- **12/12** Consumer Marketplace checks passed.
- **20/20** UI Closure regression checks passed.
- **16/16** YasReady visual parity checks passed.
- **7/7** GitHub Pages deployment checks passed.
- **8/8** Publishing Handshake checks passed.
- **16/16** Catalog Management checks passed.
- JavaScript syntax checks passed for `src/main.js` and `src/worker.mjs`.
- All **10/10** SQL migrations replayed successfully from an empty SQLite database.
- Fresh database produced **60 application tables**.
- Demo series metadata resolved in reading order after migration.

## Production bundle status

The production Vite bundle was **not marked verified** in this runtime because `node_modules` is not installed here. No claim is made that `npm run build` was executed successfully in this environment.

Run locally after installing dependencies:

```bash
npm install
npm run verify
```

## Safety state

The package does not loosen the existing safety gates. Live checkout, Stripe live mode, automatic refunds/payouts/transfers, Ingram submission/imports and Publishing transport remain disabled unless explicitly configured.

## Recommended next build

v0.9 should be **Marketing Studio**: turn the attribution plumbing already present into a polished author growth workspace with campaign assets, tracked links/QRs, website embeds, social/email launch kits and actionable campaign performance.
