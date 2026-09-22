# Marketplace | YasReady — v0.1.0 Architecture

## Product boundary

Marketplace is a standalone product and repository. Publishing is not imported, modified, or depended upon at runtime.

Future integration is intentionally narrow:

`Publishing -> versioned completed-book payload -> Marketplace`

`Marketplace -> normalized commerce/analytics export -> Business`

If Marketplace is unavailable, Publishing must continue to work.

## Canonical ownership

- **Publishing | YasReady** owns how a book is made.
- **Marketplace | YasReady** owns how a book is sold.
- **Business | YasReady** will own how the company is understood.

Marketplace owns the canonical commercial records: authors, books, editions, listings, campaigns, customers, orders, order items, economics, fulfillment jobs, ledger entries, payouts and marketplace events.

## Analytics from day one

Stats are not reconstructed from orders later. `marketplace_events` is an immutable-ish event stream intended to capture:

- book/listing views
- campaign landings
- generated/clicked links
- QR and embed activity
- cart additions/removals
- checkout starts/completions
- payment/refund events
- edition/format performance
- fulfillment state transitions
- payout and reconciliation events

Every marketing asset can carry a campaign ID plus source/medium. This keeps future Business ingestion clean.

## Commerce safety

The tracked Cloudflare config defaults to:

- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `INGRAM_MODE=off`

No committed source file contains live credentials. Live money should require a separate activation/certification build.
