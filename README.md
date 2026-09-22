# Marketplace | YasReady v0.4.0

`marketplace.yasready.com`

Standalone YasReady marketplace engine for taking a finished indie book from **ready to sell → sold → promoted → fulfilled → measured** without destabilizing Publishing | YasReady.

## Product boundary

- **Publishing | YasReady** owns how a book is made.
- **Marketplace | YasReady** owns how it is listed, sold, promoted, fulfilled and commercially measured.
- **Business | YasReady** consumes a versioned commercial export later.
- Marketplace uses the **same YasReady account identity** as Publishing; there is no second author login.

## v0.4.0 — Ingram Bridge

### Reader + author product
- multi-format storefront and multi-author cart model
- My Books, Sales, Commerce, **Fulfillment**, Promote and Connections workspaces
- same-account author mapping
- free marketing kit with tracked links, QR, embeds and ready-to-post copy
- Business-ready marketplace analytics contract

### Commerce Closure retained
- Stripe Connect/Checkout architecture behind explicit gates
- webhook replay protection
- immutable order economics snapshots
- marketplace fee, processor fee, fulfillment cost and author payable separated
- refunds, transfer/payout ledger, disputes and reconciliation

### Ingram Bridge
Marketplace does not fake a private IngramSpark API. v0.4 models the publicly documented retailer integration lifecycle and leaves transport contract-specific:

- metadata feed snapshots
- inventory/availability snapshots
- provider-cost snapshots
- normalized purchase-order envelope
- PO acknowledgment / fulfillment event ingestion
- shipment + tracking normalization
- invoice + invoice-line ingestion
- fulfillment attempts and bounded retry scheduling
- dead-letter queue for records that cannot safely reconcile
- provider sync runs + cursors for freshness
- external Ingram sales remain a separate channel ledger
- Share & Sell remains available as a fallback

### GitHub Pages demo fix
The previous white page was a deployment/bootstrap problem: raw Vite source was served at a GitHub project path while the page requested `/src/main.js` from the domain root. v0.4 is safe to demo directly from the repo root on GitHub Pages and includes:

- relative module/bootstrap paths
- lazy QR loading so an optional CDN failure cannot blank the storefront
- linked source stylesheet rather than a browser-invalid CSS module import
- guarded `import.meta.env` access
- project-safe campaign URLs
- `404.html` book-route fallback
- `npm run verify:pages`

## Safety defaults

All real-money/provider submission switches stay OFF:

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

## GitHub Pages check

```bash
npm run verify:pages
```

or double-click `PAGES_VERIFY.command`.

GitHub target: `https://github.com/3dudes1life/yasready-marketplace.git`

## Local app

```bash
npm install
npm run dev
```

`SHOWCASE.command` opens the no-install preview.

## Full Worker + D1

```bash
npm install
npm run build
npm run db:migrate:local
npm run cloudflare:dev
```

## Before production

1. Bind the production D1 database.
2. Connect the same central YasReady identity provider used by Publishing.
3. Certify Stripe in test mode.
4. Resolve merchant-of-record / marketplace-facilitator / tax obligations.
5. Establish the correct Ingram retailer/technical relationship and approved transport.
6. Turn on Ingram feed types individually and validate reconciliation before any order submission.
7. Keep Publishing import disabled until Marketplace independently passes beta.

See `docs/INGRAM-BRIDGE.md`, `docs/GITHUB-PAGES.md`, and the remaining `docs/` contracts.
