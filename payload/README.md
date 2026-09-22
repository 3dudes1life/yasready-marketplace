# Marketplace | YasReady v0.12.0

**Ingram Operations Closure**

v0.12 keeps the Stripe test-commerce closure and hidden **YasReady. Books** bridge from v0.11, then turns the existing Ingram bridge into an inspectable print-operations system.

The goal is not to invent a private IngramSpark API. Marketplace owns the commercial workflow and stores normalized provider truth so an approved Ingram transport can plug in later without rewriting Publishing, checkout, analytics, or YasReady. Books.

## What v0.12 adds

### Ingram Operations workspace
The author Fulfillment workspace now surfaces:

- print-edition → Ingram title/SKU mappings
- latest provider cost by ISBN
- metadata-feed freshness
- inventory/cost-feed freshness
- fulfillment queue state
- shipment/tracking state
- invoice-cost reconciliation
- dead-letter exceptions
- external Ingram-channel sales
- an explicit readiness checklist

### Provider title mappings
`provider_title_mappings` creates a durable relationship between a Marketplace edition and Ingram provider identifiers. Publishing-owned ISBN truth is protected: an Ingram mapping is not allowed to silently replace an ISBN that came from Publishing.

### Cost refreshes without rewriting history
Current provider costs can refresh independently of checkout history. Marketplace keeps three different concepts separate:

1. current provider/catalog cost
2. checkout-era estimated fulfillment cost
3. invoice actual fulfillment cost

That preserves historical economics even when Ingram pricing changes later.

### Invoice reconciliation
Provider invoice lines now retain expected cost, actual cost, variance, and reconciliation status. Material variance opens a `provider_reconciliation_cases` record instead of disappearing into a changed order total.

### Dead-letter repair
Malformed or unmatched provider rows remain inspectable. Admins can retry, resolve, or intentionally ignore a dead-letter record, and every action is appended to `provider_dead_letter_events`.

### External sales remain separate
Ingram network sales still live in `external_channel_sales`, separate from native Marketplace orders. Unmatched sales are preserved and also generate an exception for mapping review instead of being silently dropped.

## New APIs

Author:

- `GET /api/me/ingram/operations`

Admin:

- `GET /api/admin/ingram/operations`
- `POST /api/admin/ingram/title-mappings`
- `POST /api/admin/ingram/readiness/run`
- `POST /api/admin/ingram/dead-letters/:id/action`
- `POST /api/admin/ingram/reconciliation/:id/action`

Provider import:

- `POST /api/providers/ingram/costs/import`

Existing metadata, inventory, fulfillment-event, invoice, sales-report, queue, retry, and normalized PO endpoints remain intact.

## Readiness remains fail-closed

A provider is not called `live_ready` unless required transport, account reference, import secret, title mappings, feed freshness, exception state, reconciliation state, import lanes, and live submission all pass.

Tracked defaults remain off, including:

- `INGRAM_MODE=off`
- `INGRAM_SUBMISSION_ENABLED=false`
- `INGRAM_METADATA_IMPORT_ENABLED=false`
- `INGRAM_INVENTORY_IMPORT_ENABLED=false`
- `INGRAM_COST_IMPORT_ENABLED=false`
- `INGRAM_FULFILLMENT_IMPORT_ENABLED=false`
- `INGRAM_INVOICE_IMPORT_ENABLED=false`
- `INGRAM_REPORT_IMPORT_ENABLED=false`

## YasReady. Books remains built in

The hidden `yasready.books.marketplace.v1` contract from v0.11 remains untouched: paid ebook/audiobook entitlements, one YasReady identity, Library ownership, Saved/Recent, progress sync, guest-purchase claiming, device/sync contracts, and future content manifests all remain part of Marketplace architecture.

## Quick preview

Double-click `SHOWCASE.command`.

## Local verification

```bash
npm install
npm test
npm run verify:ingram-ops
npm run verify:books
npm run verify:stripe-test
npm run verify:analytics
npm run verify:ui
npm run verify:catalog
npm run verify:consumer
npm run verify:marketing
npm run verify:style
npm run verify:pages
npm run verify:publishing
npm run build
```

See `BUILD_REPORT.md` for the checks actually executed in the build environment.
