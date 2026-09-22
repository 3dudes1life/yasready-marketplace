# Marketplace | YasReady v0.4.0 — Build Report

## Result

**PASS — package ready for repository upload / GitHub Pages demo.**

v0.4.0 is the Ingram Bridge build. It retains v0.3 Commerce Closure and adds provider-feed, fulfillment-document, invoice, retry, dead-letter and fulfillment-health architecture. It also fixes the GitHub Pages white-screen bootstrap found on the v0.3 repository deployment.

## Verification completed

- `node --check src/main.js` — PASS
- `node --check src/lib/analytics.js` — PASS
- `node --check src/lib/ingram-bridge.mjs` — PASS
- `node --check src/worker.mjs` — PASS
- `npm run verify:pages` — **7/7 PASS**
- `npm test` — **30/30 PASS**
- fresh SQLite migration replay — **7/7 migrations PASS**
- fresh schema after migrations — **48 application tables**
- HTTP static-path smoke test — index, main JS, stylesheet, demo data and analytics module all resolve at `/yasready-marketplace/`

## GitHub Pages incident fixed

The v0.3 repository root used `/src/main.js`, which a GitHub project site resolves against `https://3dudes1life.github.io/` rather than `/yasready-marketplace/`. The browser was therefore not bootstrapping the app correctly. v0.4 changes the demo bootstrap to project-relative assets, moves CSS loading into HTML, guards native `import.meta.env`, lazy-loads QRCode so an optional CDN failure cannot blank the storefront, and adds a Pages deep-link fallback.

`PAGES_VERIFY.command` / `npm run verify:pages` prevents regression.

## Ingram Bridge additions

- normalized readiness/capability model
- metadata feed snapshots
- inventory/availability + provider cost snapshots
- provider sync cursors and run history
- normalized purchase-order validation/envelope
- PO acknowledgment / shipment / exception ingestion retained
- provider invoice + invoice-line ingestion
- fulfillment attempt ledger
- bounded retry schedule
- dead-letter queue
- author fulfillment summary API
- admin Ingram queue + dead-letter APIs
- actual fulfillment-cost reconciliation back into Commerce Closure
- external Ingram sales remain isolated from native Marketplace orders

## Safety

Every Ingram action remains fail-closed by default. In particular, `INGRAM_SUBMISSION_ENABLED=false`; this build does **not** invent or call an undocumented/private Ingram API.

## Production bundle limitation in this environment

`npm run build` could not execute because `vite` is not installed locally. `npm install` was attempted earlier in this environment and timed out downloading dependencies. Therefore the Vite production bundle is **not claimed as verified here**. Source syntax, engine tests, Pages checks, migration replay and static-path checks are verified.

Run locally after dependency installation:

```bash
npm install
npm run verify
```
