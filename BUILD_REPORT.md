# Marketplace | YasReady v0.14.0 — Build Report

**Business Intelligence Bridge**

## Verified in this build environment

- `npm test`: **136/136 PASS**
- Business Intelligence Bridge verifier: **13/13 PASS**
- Publishing Handshake verifier: **8/8 PASS**
- Publishing Live Test verifier: **12/12 PASS**
- UI Closure: **20/20 PASS**
- Catalog Management: **16/16 PASS**
- Consumer Marketplace: **12/12 PASS**
- Marketing Studio: **16/16 PASS**
- Analytics Brain: **20/20 PASS**
- YasReady. Books bridge: **12/12 PASS**
- Stripe Test Closure: **10/10 PASS**
- Ingram Operations: **12/12 PASS**
- YasReady visual parity: **16/16 PASS**
- GitHub Pages: **7/7 PASS**
- Fresh database replay: **16/16 migrations PASS**
- Fresh schema: **84 application tables**
- Business sync triggers created: **12**
- Business ledger trigger SQL smoke test: **PASS**
- JS syntax checks passed for Worker, UI and Business bridge library

## Business bridge closure

- New canonical snapshot schema: `yasready.marketplace.business.v2`.
- New incremental event schema: `yasready.marketplace.business.change.v1`.
- Snapshot, changes and acknowledgement endpoints are built.
- Same central YasReady user ID is the cross-product identity key.
- Snapshot cursor is captured before aggregate queries, preventing lost concurrent writes.
- Commercial changes are appended from ledger, settlement, transfer, payout, external sales, marketing and Analytics Brain sources.
- Business acknowledgements cannot advance beyond Marketplace's latest known sequence.
- Sync runs and consumer cursors are retained as evidence.
- Legacy v1 Business export remains available.
- No Business service receives direct database access.

## Safety defaults

- `BUSINESS_BRIDGE_ENABLED=false`
- `BUSINESS_BRIDGE_SECRET` must be configured separately before service-to-service sync.
- Existing checkout, Stripe live, Ingram submission, Publishing import and Books app delivery gates remain fail-closed.

## Preserved architecture

- Publishing production truth remains separate from Marketplace commercial truth.
- YasReady. Books entitlement/library/progress contracts remain intact.
- Ingram external-channel sales remain separate from native Marketplace orders.
- Marketplace contribution economics are not presented as full-company profit.

## Not verified here

The Vite production bundle was attempted but this environment does not have Vite installed. `npm run build` returned `vite: not found` (exit 127). No claim is made that the production bundle was built in this environment.

The new remote D1 migration was **not** applied to any live database.
