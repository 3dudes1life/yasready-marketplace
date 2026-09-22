# Marketplace | YasReady v0.12.0 — Build Report

## Release
**v0.12.0 — Ingram Operations Closure**

This release turns the existing provider bridge into an inspectable Ingram operations layer while preserving Stripe test commerce and the hidden YasReady. Books app bridge.

## Verified in this build environment
- Core engine tests: **119/119 PASS** (`npm test`)
- Ingram Operations checks: **12/12 PASS**
- UI Closure regression checks: **20/20 PASS**
- Catalog Management checks: **16/16 PASS**
- Consumer Marketplace checks: **12/12 PASS**
- Marketing Studio checks: **16/16 PASS**
- Analytics Brain checks: **20/20 PASS**
- Books app bridge checks: **12/12 PASS**
- Stripe test closure checks: **10/10 PASS**
- YasReady visual parity checks: **16/16 PASS**
- GitHub Pages checks: **7/7 PASS**
- Publishing Handshake checks: **8/8 PASS**
- JavaScript syntax: **PASS** for `src/main.js`, `src/worker.mjs`, and the new Ingram operations library
- Fresh SQLite migration replay: **14/14 PASS**
- Fresh schema: **78 application tables**
- SQL smoke insert/select checks: **PASS** for provider title mappings and readiness-run records

## v0.12 operational additions
- `provider_title_mappings`
- `provider_cost_refresh_runs`
- `provider_reconciliation_cases`
- `provider_dead_letter_events`
- `provider_readiness_runs`
- `provider_readiness_items`
- invoice/line reconciliation columns
- richer dead-letter linkage/resolution columns
- author and admin Ingram operations APIs
- protected admin title-mapping API
- cost-feed import API
- persisted readiness evidence
- Fulfillment → Ingram Operations author UI

## Important accounting behavior
Current provider cost, checkout-era estimated fulfillment cost, and invoice actual cost stay separate. A new provider cost does not mutate a historical order. Invoice variance can create a reconciliation case while the immutable order/payment record remains intact.

## Publishing ownership boundary
The Ingram mapping layer may attach provider title IDs, SKUs and provider costs, but it cannot overwrite a conflicting ISBN that came from Publishing. That mismatch is rejected as `isbn_mismatch_production_truth`.

## Safety defaults
Tracked deployment defaults remain fail-closed, including:
- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `REFUNDS_ENABLED=false`
- `TRANSFERS_ENABLED=false`
- `INGRAM_MODE=off`
- `INGRAM_SUBMISSION_ENABLED=false`
- `INGRAM_METADATA_IMPORT_ENABLED=false`
- `INGRAM_INVENTORY_IMPORT_ENABLED=false`
- `INGRAM_COST_IMPORT_ENABLED=false`
- `INGRAM_FULFILLMENT_IMPORT_ENABLED=false`
- `INGRAM_INVOICE_IMPORT_ENABLED=false`
- `INGRAM_REPORT_IMPORT_ENABLED=false`
- `BOOKS_APP_BRIDGE_ENABLED=false`
- `BOOKS_APP_DELIVERY_ENABLED=false`
- `BOOKS_APP_PUSH_ENABLED=false`

## Production bundle note
`npm run build` was attempted in this execution environment and stopped with `vite: not found` because `node_modules` / Vite are not installed here. Therefore the Vite production bundle is **not marked verified**. The source, schema, engine, feature, Pages, and syntax checks listed above were actually executed and passed.
