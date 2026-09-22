# Marketplace | YasReady v0.11.0 — Build Report

## Release
**v0.11.0 — Stripe Test Commerce Closure + YasReady. Books App Bridge**

This release closes the test-commerce architecture while deliberately building the hidden contracts the future YasReady. Books app will consume. Live money, Books content delivery, push, and provider submission remain fail-closed by default.

## Verified
- Core engine tests: **106/106 PASS** (`npm test`)
- Books app bridge checks: **12/12 PASS**
- Stripe test closure checks: **10/10 PASS**
- Analytics Brain checks: **20/20 PASS**
- UI Closure regression checks: **20/20 PASS**
- Catalog Management checks: **16/16 PASS**
- Consumer Marketplace checks: **12/12 PASS**
- Marketing Studio checks: **16/16 PASS**
- YasReady visual parity checks: **16/16 PASS**
- GitHub Pages checks: **7/7 PASS**
- Publishing Handshake checks: **8/8 PASS**
- JavaScript syntax checks: **PASS** for `src/main.js`, `src/worker.mjs`, `src/lib/books-app.mjs`, `src/lib/stripe-test-cert.mjs`, and `src/lib/stripe-commerce.mjs`
- Fresh SQLite migration replay: **13/13 PASS**
- Fresh schema: **72 application tables**
- New Books/commerce columns and tables verified after fresh replay.

## Books app bridge included now
- Versioned contract: `yasready.books.marketplace.v1`
- Same YasReady identity; no second reader account system
- Paid ebook/audiobook order → active library entitlement
- Fully refunded digital order item → entitlement revocation
- Guest purchase can be claimed by a later YasReady login using the same email
- Library, Saved, Recent, author follows, and progress remain Marketplace-owned source of truth
- Cross-device progress revisions with optimistic concurrency
- Device registration model without storing raw push tokens yet
- Incremental change feed with sync cursor
- Future app deep links (`yasreadybooks://...`) plus web fallback
- Digital content manifests with entitlement checks
- Actual content delivery and push notifications remain disabled

## Stripe test-commerce closure included now
- Explicit test-mode readiness report
- Persisted certification runs
- Eight required scenarios: single-author checkout, multi-author checkout, signed-webhook replay, digital entitlement grant, Connect onboarding, refund reconciliation, transfer ceiling, dispute hold
- Existing checkout validation, webhook idempotency, refunds, Connect, seller allocations, transfers, and reconciliation retained
- Reader order-history endpoints reserved for Marketplace / Books app continuity

## Safety defaults
The tracked deployment defaults remain fail closed, including:
- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `REFUNDS_ENABLED=false`
- `TRANSFERS_ENABLED=false`
- `INGRAM_MODE=off`
- `BOOKS_APP_BRIDGE_ENABLED=false`
- `BOOKS_APP_DELIVERY_ENABLED=false`
- `BOOKS_APP_PUSH_ENABLED=false`

## Production bundle note
`npm run build` was attempted in this execution environment and stopped with `vite: not found` because `node_modules` / Vite are not installed here. Therefore the Vite production bundle is **not marked verified**. The source, schema, engine, feature, Pages, and syntax checks listed above were actually executed and passed.
