# Provider integration plan

## Ingram

The marketplace deliberately models Ingram as multiple seams, not one imaginary API.

### 1. Metadata ingestion
Support licensed Ingram metadata via Web Service and/or feed ingestion. Map external title IDs, ISBNs, cover/image URLs and catalog metadata into Marketplace `books` + `editions`.

### 2. Inventory / availability
A dedicated inventory sync updates edition availability without overwriting Marketplace-owned pricing or campaign data.

### 3. Consumer Direct Fulfillment / EDI
Physical order fulfillment adapter should model the documented retailer flow as purchase order -> acknowledgment -> pick/pack -> ASN -> invoice. `fulfillment_jobs` exists specifically so these states do not get mixed into payment state.

### 4. Share & Sell fallback
For authors whose titles are already in IngramSpark but before a deeper retailer integration is approved, Marketplace can store a provider purchase URL as a fallback. That path should be explicitly labeled because YasReady would not own checkout/customer data for that sale.

### 5. Sales reporting import
Provider reports should land through `provider_sync_runs`, normalize into ledger/event records and preserve source provenance. Never silently merge provider-reported sales with YasReady-native checkout sales.

## Stripe

### Marketplace cart
The schema supports a cart containing items from multiple authors. Do not implement a client-authoritative price or seller amount.

### Checkout
Server must reload edition price, availability, author and fulfillment configuration before creating any Stripe Checkout Session.

### Connect
The current allocation helper groups order items by author and calculates the Marketplace fee separately. The production choice between destination charges and separate charges/transfers should be finalized during Stripe Connect onboarding, with multi-seller carts preserved as a hard requirement.

### Webhooks
Production should accept and idempotently persist at minimum:

- checkout.session.completed
- payment_intent.succeeded / payment_failed
- charge.refunded or refund events used by the selected integration
- transfer / payout lifecycle events needed for reconciliation
- Connect account capability/status updates

Stripe IDs must be unique in D1 so replays cannot duplicate entitlements, orders or transfers.

### Accounting
Do not store one vague “net” number. Per order item, retain gross, fulfillment cost, Stripe fee, tax allocation, refund allocation, Marketplace fee and seller payable independently.
