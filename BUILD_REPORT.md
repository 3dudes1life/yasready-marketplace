# Marketplace | YasReady v0.2.0 — build report

## Verified in this package

- Node syntax checks pass for frontend entry, Worker and provider/auth modules.
- `npm test` passes 16/16 engine tests.
- All 4 SQLite/D1 migrations apply in order to an empty database.
- Shared-account user mapping is unique at the database layer.
- Stripe webhook HMAC verification has a passing test.
- Multi-author seller allocation has a passing test.
- Marketing campaign URL / embed generation has passing tests.
- Business export schema has a passing test.
- Ingram fulfillment normalization and external-channel sales separation have passing tests.
- Live checkout, live Stripe, Ingram order submission, Ingram report import and Publishing import are fail-closed in tracked configuration.

## Not verified in this execution environment

`npm install` repeatedly timed out while retrieving Vite/Wrangler/QRCode dependencies, so the Vite production bundle was not executed here. This is an environment dependency-download limitation, not a passing build claim.

The package includes `FIRST_RUN.command`, which performs dependency installation and the full `npm run verify` on the target Mac.

## Immediate show-and-tell

Double-click `SHOWCASE.command` or open `PREVIEW.html`. This requires no npm install and demonstrates the v0.2.0 visual/product direction.
