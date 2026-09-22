# Marketplace | YasReady v0.8.0

**Consumer Marketplace Closure**

Marketplace remains the standalone commerce/discovery product at `marketplace.yasready.com`. v0.8 keeps the v0.7 author catalog and all prior commerce/provider architecture, then adds the reader layer that can later power **YasReady. Books** without creating a second customer system.

## What changed in v0.8

The public storefront is now organized for readers, not authors. It includes richer discovery/search, genre shortcuts, digital-first and audiobook shelves, recently viewed titles, saved books, public author storefronts, series reading-order pages, richer title details, and a more consumer-focused mobile layout.

The same YasReady identity can now be both an author and a reader. Marketplace maps that central `userId` to a `customer` record instead of creating another password/account system.

### Reader data foundation

v0.8 adds persistent records for:

- saved books
- recently viewed books
- ebook/audiobook entitlement library
- reading/listening progress
- author follows
- reader activity events
- series name/order metadata

`customer_entitlements`, introduced earlier, remains the purchase-ownership source of truth. v0.8 adds progress and library APIs around it rather than creating a duplicate “app purchase” model.

### YasReady. Books bridge

The future **YasReady. Books** app is intentionally not a separate content database. It can consume Marketplace reader APIs for ownership and progress:

- `GET /api/reader/library`
- `GET /api/reader/saved`
- `POST/DELETE /api/reader/saved/:bookId`
- `GET /api/reader/recent`
- `POST /api/reader/recent/:bookId`
- `PATCH /api/reader/progress/:editionId`
- `POST/DELETE /api/reader/follow/:authorId`

The reader/player UI itself is not production-built in v0.8; the library buttons are intentionally a preview of the next consumer layer.

## Existing systems preserved

v0.8 retains:

- v0.7 catalog drafts, autosave, preview, validation and audit history
- v0.6 YasReady author operating shell
- v0.5 signed Publishing handshake and explicit author launch gate
- v0.4 Ingram bridge/provider operations
- v0.3 Stripe/settlement/refund/payout accounting model
- marketing attribution and Business export contracts

Publishing remains a separate repo and is not modified by this package.

## Safety

Live checkout, live Stripe mode, automatic refunds/transfers, Ingram submission/import actions and Publishing transport remain fail-closed unless explicitly configured. v0.8 adds consumer data APIs; it does not loosen any money/provider gates.

## Quick preview

Double-click:

```bash
SHOWCASE.command
```

The no-install preview demonstrates the consumer storefront, digital shelves and YasReady library concept.

## Verification

```bash
npm test
./CONSUMER_VERIFY.command
./UI_CLOSURE_VERIFY.command
./YASREADY_STYLE_VERIFY.command
./PAGES_VERIFY.command
./PUBLISHING_HANDSHAKE_VERIFY.command
./CATALOG_VERIFY.command
```

See `BUILD_REPORT.md` for the exact verified state of this package.
