# Changelog

## 0.9.0 — Marketing Studio

- Rebuilt Promote into a real Marketing Studio while preserving the v0.8 reader layer and v0.6 YasReady shell.
- Added campaign goals, optional budgets and persistent campaign-cost records.
- Added launch-kit generation with social, email, event copy and launch checklists.
- Added Marketplace-owned short-link records and tracked `/r/:slug` redirects.
- Added conversion, net attributed revenue, revenue-per-visit and ROAS calculations.
- Added channel ranking and evidence-based YasReady Signal recommendations.
- Added campaign asset plans that adapt to social, email, website and offline/event channels.
- Added Marketing Studio API returning campaign performance + recommendation state per book.
- Added marketing metrics to the Business export seam so Business does not need to reverse-engineer Marketplace later.
- Added `0011_marketing_studio.sql`, `src/lib/marketing-studio.mjs`, `MARKETING_VERIFY.command`, and Marketing Studio regression checks.
- Preserved all live-money, Ingram and Publishing safety gates.

## 0.8.0 — Consumer Marketplace Closure

- Added consumer discovery, Saved, Recently Viewed, author/series pages and a canonical reader library/progress foundation for YasReady. Books.
- Added the shared YasReady customer identity and digital entitlement/progress APIs.
- Preserved v0.7 catalog management and prior commerce/provider safety gates.

## 0.7.0 — Real Catalog & Book Management

- Added Marketplace-owned presentation overrides without replacing Publishing production truth.
- Added autosaved working drafts, validation, live preview, apply revision and catalog history.
- Added author-profile concurrency protection and listing revision locks.
