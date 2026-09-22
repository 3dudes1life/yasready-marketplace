# Changelog

## 0.4.0 — Ingram Bridge

- fixes GitHub Pages white-screen deployment by making the repo-root demo project-path safe
- adds a Pages deep-link fallback and deployment verification script
- adds a dedicated author Fulfillment workspace
- models Ingram's public metadata → stock → EDI fulfillment lifecycle without inventing a private API
- adds provider metadata and inventory snapshot ingestion
- adds provider sync cursors and freshness history
- adds invoice and invoice-line ingestion tied back to order items
- adds fulfillment attempt history, bounded retry scheduling and dead-letter handling
- adds admin fulfillment queue and provider-health endpoints
- validates physical orders before purchase-order envelope preparation
- retains Share & Sell as a fallback path
- keeps all Ingram imports/submission/retry switches fail-closed
- preserves Commerce Closure ledgers and Business export contract

## 0.3.0 — Marketplace Engine

- shared YasReady account contract; no separate author login
- OIDC/JWKS verification adapter for production identity
- automatic central-user -> Marketplace author mapping
- D1-backed public catalog and author APIs
- Book -> Listing -> Editions commercial model
- author My Books workspace
- sales / format / attribution dashboard
- free author marketing toolkit with trackable links, QR, embeds and social copy
- campaign creation API and first-class marketing assets
- versioned Business | YasReady export contract
- Stripe Connect Express onboarding adapter
- Stripe Checkout Session adapter behind explicit safety gate
- Stripe webhook signature verification + replay safety
- server-validated multi-author carts
- Ingram fulfillment capability model and Share & Sell fallback field
- Cloudflare Worker static asset serving
- Publishing import receiving table reserved but disabled
- expanded verification suite

## 0.1.0 — Foundation

Initial standalone Marketplace architecture, demo storefront, commerce model, marketing attribution, Stripe/Ingram provider seams and D1 schema.

## v0.3.0 — Commerce Closure
- Snapshot fulfillment cost into every order item at checkout.
- Idempotent payment materialization and order state history.
- Refund records + proportional item/author reversal allocation.
- Seller balance, transfer and payout ledger.
- Author Orders, Ledger, Payouts and Fulfillment APIs.
- Admin-gated Stripe refund and transfer actions.
- Physical paid items automatically enter the fulfillment queue.
- Customer/payment metadata captured from Stripe webhooks.
- Reconciliation schema added for future Stripe/Ingram settlement audits.
