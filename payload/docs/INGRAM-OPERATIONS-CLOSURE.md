# Ingram Operations Closure — v0.12.0

v0.12 turns the existing Ingram Bridge into an inspectable operations layer without assuming a private Ingram API.

## Source of truth

Marketplace keeps separate records for:

- edition ↔ Ingram title/SKU mappings
- metadata and stock/cost freshness
- outbound purchase-order documents
- acknowledgment / pick-pack / shipment / invoice events
- provider invoices and line-level variance
- dead-letter records and their human repair history
- external Ingram channel sales
- readiness runs proving which gates are still closed

The checkout snapshot remains immutable. Later provider costs reconcile into actual fulfillment cost; they never rewrite what the buyer paid.

## Author-facing operations

`GET /api/me/ingram/operations` returns only the signed-in author's physical editions, provider mapping/freshness state, fulfillment queue, shipments, invoice/reconciliation status, and external Ingram sales summary.

## Admin operations

- `GET /api/admin/ingram/operations`
- `POST /api/admin/ingram/title-mappings`
- `POST /api/admin/ingram/readiness/run`
- `POST /api/admin/ingram/dead-letters/:id/action`
- `POST /api/providers/ingram/costs/import`

All writes require the existing admin/provider secrets, and live purchase-order submission remains separately gated.

## Readiness rule

A provider connection is not called live-ready unless required transport, secrets, title mappings, feed freshness, exception queues, reconciliation, import lanes, and `INGRAM_SUBMISSION_ENABLED` all pass. The default package intentionally fails this readiness check.
