# Ingram Bridge — v0.4.0

Marketplace treats Ingram as a replaceable fulfillment/data provider behind normalized contracts. It does not assume a private IngramSpark REST API.

## Publicly documented lifecycle modeled

Ingram's retailer Consumer Direct Fulfillment material describes three integration areas: metadata, stock feed, and EDI fulfillment. The EDI lifecycle is modeled as purchase order → purchase order acknowledgment → pick/pack → advance shipment notice → invoice.

Marketplace stores those as provider documents and normalized fulfillment events. The transport itself remains disabled until YasReady has an approved retailer/technical relationship.

## v0.4 lanes

- Metadata snapshots by ISBN
- Inventory/availability + provider-cost snapshots by ISBN
- Purchase-order envelope preparation
- PO acknowledgment / shipment / exception ingestion
- Invoice + invoice-line ingestion
- Fulfillment attempts and retry timing
- Dead-letter queue for malformed/unmatched provider records
- Sales-report ingestion kept separate from native Marketplace orders
- Provider sync cursors/runs for inspectable freshness

## Safety gates

All are `false` by default: `INGRAM_SUBMISSION_ENABLED`, `INGRAM_METADATA_IMPORT_ENABLED`, `INGRAM_INVENTORY_IMPORT_ENABLED`, `INGRAM_INVOICE_IMPORT_ENABLED`, `INGRAM_REPORT_IMPORT_ENABLED`, `INGRAM_FULFILLMENT_IMPORT_ENABLED`, and `INGRAM_RETRY_ENABLED`.

## Provider relationship

YasReady should contact Ingram retailer new accounts / technical integration before activating CDF/EDI. Public Ingram materials identify technical integration and dedicated EDI support, but exact transport credentials/formats remain agreement-specific.

## v0.12 operations closure

The original v0.4 bridge is now extended by `docs/INGRAM-OPERATIONS-CLOSURE.md`. v0.12 adds durable title mappings, cost refresh runs, invoice variance cases, dead-letter repair history, persisted readiness evidence, and author/admin operations summaries. The original principle is unchanged: normalized contracts first; provider-specific transport only after approval.
