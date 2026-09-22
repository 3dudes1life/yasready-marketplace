# Marketplace | YasReady v0.3.0 — Build Report

## Scope
Commerce Closure on top of v0.2.0 Marketplace Engine. Publishing | YasReady remains untouched.

## Verified
- Node source syntax: PASS (`worker.mjs`, `commerce.mjs`, `stripe-server.mjs`, `main.js`, verification script)
- Foundation/commerce tests: PASS — 21/21
- Fresh SQLite migration chain: PASS — 0001 through 0006 in order
- Fresh schema result: PASS — 41 tables
- Shared YasReady account mapping retained
- Live checkout default: OFF
- Stripe mode default: OFF
- Refund operations default: OFF
- Payout/transfer operations default: OFF
- Ingram mode default: OFF
- Publishing import default: OFF

## Commerce Closure additions
- Historical order economics snapshot print/fulfillment cost at checkout
- Idempotent paid-order materialization from verified Stripe webhook events
- Per-author settlement allocations
- Author commerce APIs for orders, ledger, payouts/transfers and fulfillment
- Refund request path with server-only authorization and independent kill switch
- Refund webhook reconciliation, including Stripe-originated refunds when payment intent maps to a YasReady order
- Proportional refund allocation across order items/authors
- Seller balance calculation: earned, refunded, paid out, available
- Transfer creation path with balance ceiling and independent kill switch
- Transfer paid/reversed reconciliation
- Physical fulfillment jobs created only after payment materializes
- Order status history, commerce exception, reconciliation, shipment, provider-document and audit schemas
- Commerce UI workspace added to the demo app

## Not verified in this environment
`npm run build` could not run because npm dependencies are not available locally and dependency download timed out. `vite` therefore is not installed in this sandbox. This is an environment/dependency-fetch limitation, not recorded as a source-code pass.

Run locally after unzip:

```bash
npm install
npm run verify
```

Do not enable test/live checkout, refunds, payouts, or Ingram operations until the relevant provider credentials and operating policies are configured.
