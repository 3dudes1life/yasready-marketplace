# Marketplace | YasReady v0.10.0

**Analytics Brain**

Marketplace | YasReady is the commerce, discovery, promotion and reader-entitlement layer that sits after Publishing | YasReady. v0.10 keeps the v0.6 YasReady operating shell, v0.7 catalog editor, v0.8 consumer/library foundation and v0.9 Marketing Studio, then adds an explainable analytics layer for authors.

## What is new in 0.10.0

### Analytics Brain workspace

A new **Insights** workspace compares the current period with the immediately preceding comparable period and highlights the small number of things that deserve attention instead of making authors interpret a wall of charts.

It covers:

- gross Marketplace sales
- orders, units, listing views and conversion
- period-over-period movement
- tracked direct-sale contribution and contribution margin
- refunds and fulfillment-cost pressure
- format mix and concentration
- book-level direct-sale economics
- campaign spend, conversion and ROAS signals
- daily trend direction and unusual spikes/drops
- dismissible evidence-based YasReady Signals

### Contribution is deliberately not called net profit

Marketplace only knows Marketplace selling costs. v0.10 calculates:

`gross - refunds - Marketplace fee - processor fees - fulfillment - tracked campaign spend`

The UI labels that value **Tracked contribution**. Full-company profit belongs in Business | YasReady, where editing, design, software, payroll, tax and other expenses can be included.

### Business-ready intelligence

`GET /api/me/business-export` now carries a normalized analytics object in addition to sales, format, channel and Marketing Studio data. This preserves the architecture:

**Publishing | YasReady → Marketplace | YasReady → Business | YasReady**

## New API surface

- `GET /api/me/analytics-brain?days=30`
- `POST /api/me/analytics-brain/refresh?days=30`
- `POST /api/me/analytics-signals/:key/dismiss`

## New persistence

Migration `0012_analytics_brain.sql` adds:

- `analytics_brain_runs`
- `analytics_signal_state`
- `analytics_daily_rollups`

The daily-rollup table is reserved as a future cache/aggregation layer; the current brain can still compute from canonical commerce/events data.

## Existing product layers preserved

- shared YasReady identity; no second author login
- Publishing handoff with author-controlled go-live gate
- real catalog drafts/autosave/history
- public discovery + author/series storefronts
- saved/recent/library/progress data for future **YasReady. Books**
- Marketing Studio campaign links, QR, embeds, launch kits, spend and attribution
- Stripe/Connect test architecture
- Ingram bridge + fail-closed provider operations
- Business export seam

## Quick preview

Double-click:

`SHOWCASE.command`

This opens the no-install v0.10 Analytics Brain preview.

## Local verification

```bash
npm install
npm run test
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

Live checkout, payouts, refunds, Ingram submission and Publishing import remain fail-closed until intentionally configured.
