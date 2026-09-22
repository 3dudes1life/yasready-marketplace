# Changelog

## 0.7.0 — Real Catalog & Book Management

- turns My Books into a real catalog operations workspace
- adds one working autosave draft per book instead of saving directly into the live storefront
- adds Marketplace-owned presentation overrides so author edits never overwrite Publishing production truth
- adds reader-facing title/subtitle, descriptions, cover override, category and excerpt controls
- adds edition-level price and draft/live/paused controls
- adds author storefront display name, tagline, bio and website editing
- adds SEO title/description plus planned launch-date metadata
- adds side-by-side live preview before apply
- adds persisted catalog validation runs
- adds optimistic draft revision locking for stale browser tabs
- adds listing revision locking before apply
- adds field-level catalog change history
- prevents no-op apply actions from manufacturing revisions
- updates public catalog and marketing kit to use Marketplace presentation overrides first
- preserves the v0.6 YasReady operating shell and all earlier Publishing, Ingram, commerce, marketing and Business seams

## 0.6.0 — YasReady UI Closure

- separates the public consumer storefront from the logged-in author operating shell
- adds persistent YasReady left navigation rail for desktop author workflows
- groups author navigation into Workspace, Grow and Operations instead of one crowded horizontal nav
- adds compact YasReady top utility bar with environment, money-safety, bag, appearance and account controls
- adds mobile author navigation for smaller screens
- uses the exact shared YasReady `Y.` mark asset instead of a Marketplace-specific SVG approximation
- keeps the shared `yasready-theme` light/dark preference contract
- tightens author metrics, panels, forms, tables and cards to the shared YasReady density
- reduces public storefront visual weight so books remain the primary content
- adds explicit loading, skeleton and safe error-state components
- adds reduced-motion support and stronger focus behavior
- adds `scripts/verify-ui-closure.mjs` and `UI_CLOSURE_VERIFY.command`
- adds v0.6 regression tests for author shell structure, mobile behavior and exact mark assets
- preserves v0.5 Publishing Handshake, v0.4 Ingram Bridge, v0.3 Commerce Closure and all fail-closed safety defaults

## 0.5.0 — Publishing Handshake

- restores exact YasReady platform visual parity instead of a separate bookstore-adjacent look
- adopts shared YasReady light/dark tokens, green operating accent and Ready Lime status signal
- uses the same `yasready-theme` preference contract as the wider platform
- adds the compact 64px YasReady shell, shared panel density and green-gradient primary actions
- adds a dedicated visual-parity verifier so future Marketplace builds cannot casually drift away again
- adds signed one-way Publishing → Marketplace handoff contract
- binds imported books to the same central YasReady user ID
- reuses an existing source-linked Marketplace book instead of duplicating it
- adds durable Publishing source-book and source-edition links
- stores source revision, artifact reference/hash and production sync status
- adds SHA-256 payload replay/idempotency protection
- adds field-level sync provenance with publishing vs marketplace ownership
- preserves author Marketplace pricing when Publishing later suggests a different price
- creates/updates imports as drafts; Publishing cannot make a listing live
- adds author readiness, go-live and pause APIs
- adds immutable Marketplace launch-event audit records
- adds author import history and sync-change APIs
- adds Launch workspace in the Marketplace UI
- adds a complete example handoff payload plus signing/verification utilities
- keeps Publishing import fail-closed by default
- retains v0.4 Ingram Bridge, v0.3 Commerce Closure, marketing attribution and Business export architecture

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
