# Marketplace | YasReady v0.10 — Analytics Brain

Analytics Brain turns Marketplace commercial truth into a small set of explainable signals for indie authors. It does not try to become Business | YasReady. It only interprets the selling layer Marketplace can actually observe.

## What it compares

- current period vs the immediately preceding comparable period
- gross sales, orders, units, listing views and conversion
- refunds and direct selling costs
- format mix and concentration
- book-level direct-sale contribution
- campaign spend, conversion and tracked ROAS
- short-term daily sales trend and unusual spikes/drops

## Contribution, not company profit

Marketplace can calculate a tracked direct-sale contribution:

`gross sales - refunds - Marketplace fee - processor fees - fulfillment cost - tracked campaign spend`

This is intentionally **not** labeled net profit. Editing, cover design, payroll, subscriptions, tax, overhead and other business expenses belong in Business | YasReady.

## Signal contract

Every signal contains:

- stable signal key
- category
- severity
- plain-language title
- plain-language detail
- evidence object
- author state (open/dismissed)

Signals are deterministic and evidence-based. They do not invent motives or promise outcomes.

## API

- `GET /api/me/analytics-brain?days=30` — compute current brain state
- `POST /api/me/analytics-brain/refresh?days=30` — compute + persist a brain run
- `POST /api/me/analytics-signals/:key/dismiss` — dismiss a signal for this author

## Business handoff

The existing `yasready.marketplace.business.v1` export now includes an optional analytics object with period comparison, tracked economics, book-level contribution and signal summaries. Business can consume that data without reading Marketplace tables.
