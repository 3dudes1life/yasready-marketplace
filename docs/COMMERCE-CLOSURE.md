# Marketplace | YasReady v0.3.0 — Commerce Closure

Commerce is modeled as an auditable ledger, not a dashboard calculation. The order captures immutable sale economics; provider webhooks advance state; refunds create separate allocations/reversals; seller transfers are their own records; physical items queue fulfillment jobs.

## Safety
Live checkout remains disabled unless `CHECKOUT_ENABLED=true` and Stripe is configured. Refund and transfer actions additionally require the server-only `COMMERCE_ADMIN_SECRET`. `PAYOUTS_ENABLED` and `REFUNDS_ENABLED` remain false in shipped defaults.

## Core routes
- `GET /api/me/orders`
- `GET /api/me/ledger`
- `GET /api/me/payouts`
- `GET /api/me/fulfillment`
- `POST /api/admin/refunds`
- `POST /api/admin/transfers/create`

Settlement allocations aggregate immutable per-order economics by author; transfer records are separate from author earnings so payout history never rewrites sale history.
- `POST /api/webhooks/stripe`

## Accounting principle
Historical orders retain the price, marketplace fee, fulfillment reserve, seller payable, refunds and transfers that were true for that order. Current catalog economics never rewrite history.
