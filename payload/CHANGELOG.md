# Changelog

## 0.12.0 — Ingram Operations Closure

### Provider operations
- Added `yasready.ingram.operations.v1` operations contract.
- Added author-facing Ingram Operations summary/API.
- Added admin-wide operations summary/API.
- Added persistent edition ↔ provider title/SKU mappings.
- Protected Publishing-owned ISBN truth from provider mapping overwrite.
- Added explicit feed freshness calculation for metadata and inventory/cost truth.
- Added provider cost refresh runs with unmatched-row accounting.

### Reconciliation
- Added expected vs actual invoice-line cost fields.
- Added bounded invoice-variance evaluation.
- Added provider reconciliation cases for material cost differences.
- Added admin reconciliation actions without rewriting historical checkout economics.

### Exception repair
- Extended dead letters with author/book/edition/order linkage fields.
- Added retry / resolve / ignore actions.
- Added append-only dead-letter repair history.
- Unmatched external sales can now surface for mapping repair instead of disappearing.

### Readiness
- Added persisted Ingram readiness runs and per-check evidence.
- Live readiness requires explicit transport, secrets, mappings, feed freshness, clean exceptions/reconciliation, import gates, and submission gate.
- Added `INGRAM_COST_IMPORT_ENABLED=false` safety switch.

### Author UI
- Rebuilt Fulfillment into an Ingram Operations workspace.
- Added mapping/cost table, readiness checklist, queue health, sync freshness, reconciliation cases, dead-letter visibility, and Ingram-network sales metrics.

### Preserved
- Stripe test-commerce closure remains intact.
- YasReady. Books hidden bridge remains intact.
- Publishing handshake, Catalog, Consumer Marketplace, Marketing Studio, Analytics Brain, Business export, Pages support, and YasReady UI system remain intact.

### Safety
- No live Ingram submission was enabled.
- No live money was enabled.
- No Books app content delivery/push was enabled.
