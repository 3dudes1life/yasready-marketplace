# Marketplace | YasReady v0.11.0

**Stripe Test Commerce Closure + hidden YasReady. Books app bridge**

v0.11 keeps every layer from v0.10, then closes two important loops:

1. **Commerce can now be certified as an end-to-end Stripe test system** instead of merely having Stripe-shaped code paths.
2. **A paid ebook/audiobook becomes a durable reader entitlement** that the future YasReady. Books app can consume without inventing another library later.

## The Books app decision is now architectural

Marketplace is the canonical source for what a reader owns, saved/recent books, followed authors, ebook/audiobook progress, entitlement grant/revocation, future digital asset manifests, and reader order history.

The future **YasReady. Books** app gets a hidden, versioned API contract (`yasready.books.marketplace.v1`) and uses the same YasReady identity. There is no second app login or second purchase database.

The bridge is built but fail-closed by default: `BOOKS_APP_BRIDGE_ENABLED=false`, `BOOKS_APP_DELIVERY_ENABLED=false`, and `BOOKS_APP_PUSH_ENABLED=false`.

## Buy → Library loop

Successful Stripe checkout/PaymentIntent events now reconcile paid ebook/audiobook order items into `customer_entitlements`. A fully refunded digital item can revoke the entitlement without rewriting purchase history. A reader who bought as a guest can later sign into the same YasReady email and claim that prior customer record instead of creating a duplicate Library.

## Books app API reserved now

- `GET /api/books-app/v1/bootstrap`
- `GET /api/books-app/v1/library`
- `POST /api/books-app/v1/devices`
- `GET /api/books-app/v1/sync?since=<cursor>`
- `PATCH /api/books-app/v1/progress/:editionId`
- `GET /api/books-app/v1/content/:editionId/manifest`

Content delivery itself remains off until storage/signing is implemented.

## Stripe Test Commerce Closure

v0.11 models an eight-scenario certification run: single-author checkout, multi-author checkout, signed webhook replay, digital entitlement grant, Connect onboarding, refund reconciliation, transfer ceiling, and dispute hold.

Admin operations: `GET /api/admin/commerce/readiness`, `POST /api/admin/commerce/test-runs`, and `POST /api/admin/commerce/test-runs/:id/complete`.

## Existing product layers preserved

YasReady UI Closure, real catalog management, consumer Marketplace/library, Marketing Studio, Analytics Brain, Publishing handshake, Ingram bridge, Stripe settlement/refund/dispute architecture, and the Business export seam all remain intact.

## Quick preview

Double-click `SHOWCASE.command`.

## Local verification

```bash
npm install
npm run test
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

Live checkout, payouts, refunds, Ingram submission, Publishing transport and Books content delivery remain disabled until deliberately configured.
