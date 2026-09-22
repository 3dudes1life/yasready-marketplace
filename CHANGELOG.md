# Changelog

## 0.10.0 — Analytics Brain

- Added a first-class **Insights** workspace inside the YasReady author shell.
- Added comparable-period analysis for sales, orders, units, views, conversion, refunds and seller payable.
- Added tracked direct-sale contribution economics using only Marketplace-known costs.
- Explicitly avoids labeling Marketplace contribution as company net profit.
- Added format concentration analysis and book-level contribution economics.
- Added daily trend direction plus deterministic spike/drop detection.
- Added evidence-based YasReady Signals for revenue movement, conversion pressure, refunds, fulfillment cost, format concentration and campaign efficiency.
- Added dismissible signal state so authors can hide irrelevant guidance without deleting underlying data.
- Added `GET /api/me/analytics-brain`, `POST /api/me/analytics-brain/refresh`, and signal-dismiss API.
- Added `0012_analytics_brain.sql` with brain runs, signal state and daily rollup cache tables.
- Added Analytics Brain summaries to the existing Business export contract.
- Added `ANALYTICS_VERIFY.command`, dedicated verifier and pure Analytics Brain engine tests.
- Preserved the v0.9 Marketing Studio, v0.8 reader layer, v0.7 catalog workflow and v0.6 YasReady UI shell.

## 0.9.0 — Marketing Studio

- Rebuilt Promote into a real Marketing Studio.
- Added campaign goals, optional spend, trackable short links, QR assets, launch kits and attribution intelligence.
- Added campaign conversion, revenue-per-visit and ROAS calculations.
- Added evidence-based Marketing Studio recommendations.
- Added marketing intelligence to the Business export seam.

## 0.8.0 — Consumer Marketplace Closure

- Added discovery, saved titles, recently viewed, author/series pages and canonical reader library/progress concepts for future YasReady. Books.

## 0.7.0 — Real Catalog & Book Management

- Added draft/autosave catalog editing, validation, reader preview, optimistic concurrency and audited listing revisions.

## 0.6.0 — YasReady UI Closure

- Separated the public storefront from the logged-in YasReady author operating shell and locked visual parity.
