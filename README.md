# Marketplace | YasReady v0.3.0

`marketplace.yasready.com`

Standalone YasReady marketplace engine for selling completed books without destabilizing Publishing | YasReady.

## The product boundary

- **Publishing | YasReady** owns how a book is made.
- **Marketplace | YasReady** owns how a book is listed, sold, promoted and commercially measured.
- **Business | YasReady** can later consume a normalized Marketplace export without reading Marketplace internals.

Marketplace does **not** own a second password system. The same YasReady account identity used in Publishing maps to one Marketplace author profile through `authors.user_id`.

## v0.3.0 includes

### Reader storefront
- marketplace discovery/search/filter UI
- one Book with multiple editions (ebook, paperback, hardcover, audiobook)
- cart designed for multiple authors
- server-side cart validation endpoint
- physical/digital fulfillment provider separation

### Author workspace
- same-YasReady-account session contract
- author catalog and listing state
- sales overview and recent orders
- format mix and attribution model
- promotion workspace
- trackable campaign links
- QR generation
- copy/paste HTML embeds and buy buttons
- ready-to-post promotional copy
- campaign performance table

### Commerce plumbing
- Stripe Connect Express onboarding hooks
- Stripe Checkout Session adapter
- separate-charges/transfers-friendly multi-seller allocation model
- webhook signature verification and replay protection table
- payment state kept separate from fulfillment state
- item-level marketplace fee / processor / fulfillment / seller payable accounting

### Ingram boundary
- Share & Sell fallback field per edition
- metadata / inventory / Consumer Direct Fulfillment / EDI capability model
- fulfillment request normalization
- provider sync run table
- no undocumented Ingram API calls

### Data + future Business
- first-class marketplace events
- campaign attribution
- versioned `yasready.marketplace.business.v1` export contract
- clean money fields in minor currency units

## Safety defaults

Tracked defaults are deliberately off:

- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `INGRAM_MODE=off`
- `PUBLISHING_IMPORT_ENABLED=false`

That lets the whole product run as a private-beta demo without accidentally moving money or submitting fulfillment orders.

## Fastest local demo

Double-click:

`SHOWCASE.command`

or run:

```bash
npm install
npm run dev
```

`SHOWCASE.command` opens `PREVIEW.html` immediately with no install. For the interactive Vite UI, double-click `RUN_DEMO_APP.command` or use `npm run dev`. The app has built-in demo data and does not require provider credentials.

## Full local Worker + D1 demo

```bash
npm install
npm run build
npm run db:migrate:local
npm run cloudflare:dev
```

Then use the local Wrangler URL. `YASREADY_AUTH_MODE=demo` maps the demo YasReady account to the seeded author profile.

## Verify

```bash
npm run verify
```

## GitHub

Target repository:

`https://github.com/3dudes1life/yasready-marketplace.git`

`GITHUB_FIRST_PUSH.command` is configured for that repo.

## Before production

1. Create/bind the real Cloudflare D1 database and replace `REPLACE_AFTER_D1_CREATE`.
2. Point Marketplace at the same OIDC/JWT identity provider as Publishing.
3. Configure Stripe Connect in **test** mode first and certify onboarding, Checkout, webhooks, refunds and transfer reconciliation.
4. Determine YasReady's merchant-of-record / marketplace-facilitator / tax obligations before live money.
5. Establish the correct Ingram retailer/technical relationship before enabling CDF/EDI.
6. Keep Publishing import disabled until Marketplace has independently passed beta testing.

See `docs/` for the integration contracts and partner notes.
