# Marketplace | YasReady v0.9.0 — Build Report

**Release:** Marketing Studio  
**Target:** `marketplace.yasready.com`  
**Repository:** `3dudes1life/yasready-marketplace`

## Release objective

v0.9 turns the attribution plumbing already inside Marketplace into a usable author growth system. Promotion stays attached to the canonical Marketplace book, so campaign links, QRs, website assets, traffic and eventual orders share the same campaign identity.

The design rule remains: **more capability should not create more work for the author.** A campaign produces a reusable bundle instead of making the author configure each asset separately.

## Marketing Studio added

- Campaign goals: launch, sales, awareness, reviews, events and evergreen.
- Optional planned/actual marketing cost records.
- Trackable Marketplace campaign URLs.
- Marketplace-owned short-link records and tracked redirects.
- QR campaign assets.
- Website button/embed assets.
- Social, email and event copy.
- Reusable launch/checklist kits.
- Conversion, net attributed revenue, revenue per visit and ROAS calculations.
- Channel ranking and evidence-based YasReady Signal recommendations.
- Marketing metrics exported through the existing Business handoff seam.

## Data foundation

Migration `0011_marketing_studio.sql` adds campaign objective/budget/status fields plus:

- `marketing_short_links`
- `marketing_campaign_costs`
- `marketing_launch_kits`
- `marketing_recommendations`

Existing `campaigns`, `marketing_assets`, `marketplace_events`, `orders` and `order_items` remain the canonical attribution/commerce records.

## Safety

v0.9 does not post to social networks, purchase ads or spend funds. Cost records are author-entered planning/accounting data. Existing checkout, Stripe live mode, automatic refund/payout/transfer, Ingram submission/import and Publishing transport switches remain fail-closed.

## Verification actually run

- **73/73** Node engine/regression tests passed.
- **16/16** Marketing Studio checks passed.
- **20/20** UI Closure regression checks passed.
- **16/16** Catalog Management checks passed.
- **12/12** Consumer Marketplace checks passed.
- **16/16** YasReady visual parity checks passed.
- **7/7** GitHub Pages checks passed.
- **8/8** Publishing Handshake checks passed.
- JavaScript syntax checks passed for `src/main.js`, `src/worker.mjs`, `src/lib/marketing-studio.mjs`, and `src/lib/business.mjs`.
- All **11/11** SQL migrations replayed successfully from an empty SQLite database.
- Fresh database produced **64 application tables**.

## Production bundle status

The Vite production bundle is not marked verified in this runtime because `node_modules` is not installed. Run locally:

```bash
npm install
npm run verify
```
