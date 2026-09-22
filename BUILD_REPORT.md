# Marketplace | YasReady v0.5.0 — Build Report

## Result

**PASS — Publishing Handshake package ready for repository upload and demo.**

v0.5.0 keeps Marketplace in its own repository while adding the receiving side of a safe Publishing → Marketplace connection. Publishing remains untouched by this package.

## Verification completed

- `node --check src/main.js` — PASS
- `node --check src/worker.mjs` — PASS
- `node --check src/lib/publishing-handoff.mjs` — PASS
- `npm run verify:publishing` — **8/8 PASS**
- `npm run verify:pages` — **7/7 PASS**
- `npm run verify:style` — **12/12 PASS**
- `npm test` — **40/40 PASS**
- fresh SQLite migration replay through Python sqlite3 — **8/8 migrations PASS**
- fresh schema after migrations — **52 application tables**
- Publishing provenance tables present — PASS


## YasReady visual parity closure

The Marketplace no longer carries its earlier purple-first / oversized bookstore-adjacent operating UI. v0.5 now locks to the shared YasReady platform system:

- shared light/dark theme preference via `yasready-theme`
- Ready Lime `#C6FF00` as a readiness/status signal
- YasReady green `#16815c` as the primary operating accent
- compact 64px platform navigation shell
- green-gradient primary actions
- shared panel/background/muted/line tokens in light and dark mode
- compact operating cards and controls consistent with Business and Publishing
- dedicated regression verification in `scripts/verify-yasready-style.mjs`

## Publishing Handshake closure

The receiving architecture now proves:

- same YasReady account / `userId` is the ownership key
- source books and source editions receive durable cross-product links
- the payload is schema-versioned and SHA-256 hashed
- repeated identical payloads are idempotent
- service-to-service requests require a timestamped HMAC signature
- a Publishing source book cannot be attached to a different YasReady user
- production-owned fields can sync forward
- Marketplace-owned commercial fields are not silently overwritten
- changed Publishing price suggestions are recorded as preserved Marketplace values
- imports create/update drafts only
- author readiness and explicit go-live are separate actions
- every launch attempt can be audited

## New operational surfaces

- `POST /api/integrations/publishing/handoff`
- `GET /api/integrations/publishing/status`
- `GET /api/me/publishing/imports`
- `GET /api/me/publishing/changes?bookId=...`
- `GET /api/me/books/:bookId/readiness`
- `POST /api/me/books/:bookId/go-live`
- `POST /api/me/books/:bookId/pause`
- Launch workspace in the author UI
- `examples/publishing-handoff.example.json`
- `scripts/sign-publishing-handoff.mjs`
- `scripts/verify-publishing.mjs`
- `PUBLISHING_HANDSHAKE_VERIFY.command`

## Safety

`PUBLISHING_IMPORT_ENABLED=false` remains the tracked default and a configured `PUBLISHING_IMPORT_SECRET` is required even after the feature gate is enabled. The handoff cannot directly make a listing live.

All Stripe and Ingram live actions remain fail-closed as in prior builds.

## Production bundle limitation in this environment

`npm run build` could not execute because `vite` is not installed in this runtime (`node_modules` is absent). Therefore the Vite production bundle is **not claimed as verified here**. Source syntax, engine tests, Pages checks, Publishing Handshake verification and full migration replay are verified.

Run locally after dependency installation:

```bash
npm install
npm run verify
```
