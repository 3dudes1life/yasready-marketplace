# Marketplace | YasReady v0.6.0

`marketplace.yasready.com`

Standalone YasReady marketplace engine for taking a finished indie book from **made → sellable → sold → promoted → fulfilled → measured** without destabilizing Publishing | YasReady.

## v0.6.0 — YasReady UI Closure

v0.6 is intentionally a **visual/system closure release**, not another feature pile-on. The goal is to make Marketplace feel like a native YasReady product everywhere authors work while keeping the public bookstore clean and consumer-friendly.

### Two experiences, one product

**Public Marketplace** stays simple for readers:

- compact consumer header
- browse / search / format filters
- book-first cards and format pricing
- bag + storefront actions
- responsive mobile storefront

**Author workspace** now uses the YasReady operating shell:

- persistent left navigation rail on desktop
- grouped `Workspace`, `Grow`, and `Operations` modules
- compact top utility bar
- same YasReady account identity
- shared light/dark appearance preference
- Ready Lime status semantics
- YasReady green operating actions
- denser Apple-style cards, forms, tables and metrics
- mobile author navigation when the rail disappears

The public storefront and the author operating system no longer compete for the same navigation pattern.

### Exact shared mark

The shell now uses the actual YasReady `Y.` mark asset instead of a Marketplace-specific SVG approximation. The same optimized mark is shipped at the repo root for GitHub Pages and under `public/` for the Vite/Cloudflare build.

### UI states are first-class

v0.6 adds a shared visual grammar for:

- loading
- skeleton data
- empty results
- safe error messaging
- responsive layout
- focus states
- reduced-motion accessibility

The app can grow without inventing a new visual treatment for every future feature.

## Product boundary

- **Publishing | YasReady** owns how a book is made.
- **Marketplace | YasReady** owns how it is listed, priced, sold, promoted, fulfilled and commercially measured.
- **Business | YasReady** consumes a versioned commercial export later.
- Marketplace uses the **same YasReady account identity** as Publishing; there is no second author login.

## Publishing Handshake retained from v0.5

Publishing can send a completed-production package to:

`POST /api/integrations/publishing/handoff`

The endpoint remains disabled by default and requires a timestamped HMAC signature plus the shared schema:

`yasready.publishing.marketplace.v1`

Publishing may sync production truth such as title metadata, cover provenance, formats, ISBNs and production artifact references. Marketplace-owned commercial truth — sale price after first import, visibility, campaigns, orders and launch state — stays under Marketplace/author control.

A handoff creates or updates a **draft**. Publishing cannot put a title on sale. The author must pass readiness and explicitly approve go-live.

## Commerce, Ingram, marketing and Business architecture retained

- multi-format storefront and multi-author cart model
- Stripe Checkout + Connect test architecture behind safety gates
- immutable payment / refund / transfer ledgers
- Ingram metadata, inventory, PO/document, shipment, invoice, retry and dead-letter bridge
- tracked links, QR codes, HTML embeds and promo copy
- marketplace stats + Business-ready export contract
- same-user Publishing → Marketplace ownership mapping

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

## Verify v0.6

```bash
npm test
npm run verify:ui
npm run verify:style
npm run verify:pages
npm run verify:publishing
```

Or double-click:

`UI_CLOSURE_VERIFY.command`

`SHOWCASE.command` opens the no-install v0.6 author-workspace preview.

## GitHub / local

GitHub target: `https://github.com/3dudes1life/yasready-marketplace.git`

```bash
npm install
npm run dev
```

## Before production

1. Bind production D1 and apply all migrations.
2. Connect the same central YasReady OIDC provider used by Publishing.
3. Certify Stripe in test mode and resolve marketplace/tax/MoR obligations.
4. Establish the approved Ingram technical relationship and transport.
5. Keep `PUBLISHING_IMPORT_ENABLED=false` until the Publishing sender is deliberately connected.
6. Dry-run a real Publishing handoff and inspect field provenance.
7. Keep author go-live approval as a separate Marketplace action.

See `docs/PUBLISHING-HANDSHAKE.md`, `docs/INGRAM-BRIDGE.md`, `docs/COMMERCE-CLOSURE.md`, and the remaining contracts under `docs/`.
