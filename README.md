# Marketplace | YasReady v0.5.0

`marketplace.yasready.com`

Standalone YasReady marketplace engine for taking a finished indie book from **made → sellable → sold → promoted → fulfilled → measured** without destabilizing Publishing | YasReady.

## Product boundary

- **Publishing | YasReady** owns how a book is made.
- **Marketplace | YasReady** owns how it is listed, priced, sold, promoted, fulfilled and commercially measured.
- **Business | YasReady** consumes a versioned commercial export later.
- Marketplace uses the **same YasReady account identity** as Publishing; there is no second author login.

## YasReady visual parity

v0.5 also closes the visual mismatch with the rest of the YasReady platform. Marketplace now uses the shared YasReady light/dark surface system, compact 64px shell, green operating accent, Ready Lime status signal, dense Apple-style cards and the same `yasready-theme` appearance preference used across the wider platform. Marketplace remains a bookstore where readers need it to be, but the author workspace now looks and behaves like another YasReady module.

## v0.5.0 — Publishing Handshake

v0.5 closes the product loop without merging the codebases.

### One-way signed handoff

Publishing can send a completed-production package to:

`POST /api/integrations/publishing/handoff`

The endpoint is disabled by default and requires a timestamped HMAC signature plus the shared schema:

`yasready.publishing.marketplace.v1`

The package carries the YasReady `userId`, Publishing source book/edition IDs, source revision, book metadata, edition formats/ISBNs, production state and artifact provenance.

### Same account, no second backend identity

Marketplace maps the incoming `userId` to the existing `authors.user_id`. A Publishing source book cannot be reassigned to another YasReady account. Existing Marketplace books already carrying the same `publishing_source_id` are linked rather than duplicated.

### Field ownership prevents destructive syncs

**Publishing-owned production truth** may sync:

- title / subtitle / description
- cover + category
- formats + ISBNs
- provider title/SKU references
- production state
- production artifact reference/hash

**Marketplace-owned commercial truth** stays under the author’s control:

- public slug
- listing status / visibility
- sale price after first import
- marketing campaigns
- orders, reviews and analytics

A later Publishing price suggestion never silently overwrites the Marketplace sale price. The difference is logged as `preserved` provenance.

### Explicit author launch gate

A handoff creates or updates a **draft**. Publishing cannot put a title on sale.

Author APIs:

- `GET /api/me/publishing/imports`
- `GET /api/me/publishing/changes?bookId=...`
- `GET /api/me/books/:bookId/readiness`
- `POST /api/me/books/:bookId/go-live`
- `POST /api/me/books/:bookId/pause`

Go-live runs readiness checks, records an immutable launch event and activates only the editions selected by the author.

### Author workspace

The app now includes **Launch** alongside My Books, Sales, Commerce, Fulfillment, Promote and Connections. It explains the Publishing → Marketplace contract and gives the author a clear approval point before sale.

## Everything retained from v0.4

- GitHub Pages-safe demo deployment
- multi-format storefront and multi-author cart architecture
- Stripe Checkout + Connect test architecture behind safety gates
- immutable commerce/refund/transfer ledgers
- Ingram metadata, inventory, PO/document, shipment, invoice, retry and dead-letter bridge
- tracked links, QR codes, HTML embeds and promo copy
- marketplace stats + Business-ready export contract

## Safety defaults

All real-money/provider/source integration switches remain OFF:

- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `PAYOUTS_ENABLED=false`
- `REFUNDS_ENABLED=false`
- `INGRAM_MODE=off`
- `INGRAM_SUBMISSION_ENABLED=false`
- `INGRAM_METADATA_IMPORT_ENABLED=false`
- `INGRAM_INVENTORY_IMPORT_ENABLED=false`
- `INGRAM_INVOICE_IMPORT_ENABLED=false`
- `INGRAM_REPORT_IMPORT_ENABLED=false`
- `INGRAM_FULFILLMENT_IMPORT_ENABLED=false`
- `INGRAM_RETRY_ENABLED=false`
- `PUBLISHING_IMPORT_ENABLED=false`

## Verify the handshake

```bash
npm run verify:publishing
npm run verify:style
npm test
npm run verify:pages
```

or double-click `PUBLISHING_HANDSHAKE_VERIFY.command`.

A complete sample payload lives at:

`examples/publishing-handoff.example.json`

To generate a valid signature header for that payload:

```bash
node scripts/sign-publishing-handoff.mjs examples/publishing-handoff.example.json YOUR_SECRET
```

## GitHub / local

GitHub target: `https://github.com/3dudes1life/yasready-marketplace.git`

```bash
npm install
npm run dev
```

`SHOWCASE.command` opens the no-install preview.

## Before production

1. Bind production D1 and apply all migrations.
2. Connect the same central YasReady OIDC provider used by Publishing.
3. Certify Stripe in test mode and resolve marketplace/tax/MoR obligations.
4. Establish the approved Ingram technical relationship and transport.
5. Keep `PUBLISHING_IMPORT_ENABLED=false` until the Publishing sender is built and its secret is stored securely on both sides.
6. Run a dry handoff, inspect field provenance, then intentionally enable the connection.
7. Keep the author go-live gate; do not let Publishing auto-publish Marketplace listings.

See `docs/PUBLISHING-HANDSHAKE.md`, `docs/INGRAM-BRIDGE.md`, `docs/COMMERCE-CLOSURE.md`, and the remaining contracts under `docs/`.
