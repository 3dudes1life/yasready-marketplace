# Marketplace | YasReady v0.10.0 — Build Report

**Release:** Analytics Brain  
**Baseline:** v0.9.0 Marketing Studio  
**Primary goal:** turn Marketplace commercial data into comparable, explainable author intelligence without pretending Marketplace knows full-company profit.

## Added in v0.10

- New **Insights** workspace inside the YasReady author shell.
- Comparable current-period vs previous-period analysis.
- Tracked direct-sale contribution economics.
- Format concentration and book-level economics.
- Daily trend direction and unusual spike/drop detection.
- Evidence-based YasReady Signals with dismiss state.
- Analytics Brain persistence/history boundary.
- Business export now includes compact analytics intelligence.
- Dedicated Analytics Brain migration, engine library, tests and verification command.
- Updated no-install showcase focused on Analytics Brain.

## Important accounting boundary

The Analytics Brain calculates **Tracked contribution**, not net profit:

`gross - refunds - Marketplace fee - processor fees - fulfillment - tracked marketing spend`

Marketplace does not claim to know editing, design, payroll, subscriptions, tax, overhead or other company expenses. Those belong in Business | YasReady.

## Verification actually run

- JavaScript syntax: **PASS** (`src/main.js`, `src/worker.mjs`, `src/lib/analytics-brain.mjs`)
- Engine/unit tests: **83/83 PASS**
- Analytics Brain checks: **20/20 PASS**
- UI Closure regression checks: **20/20 PASS**
- Catalog Management checks: **16/16 PASS**
- Consumer Marketplace checks: **12/12 PASS**
- Marketing Studio checks: **16/16 PASS**
- YasReady visual parity checks: **16/16 PASS**
- GitHub Pages checks: **7/7 PASS**
- Publishing Handshake checks: **8/8 PASS**
- Fresh SQLite migration replay: **12/12 PASS**
- Fresh schema size: **67 application tables**
- Analytics SQL smoke checks: **2/2 PASS** (daily sales + book economics queries)

## Production bundle status

`npm run build` was attempted, but this execution environment does not have the package dependencies installed, so the command stops at:

`vite: not found`

This is an environment/dependency limitation, not reported as a passing bundle. Run `npm install && npm run verify` locally before production deployment.

## Safety

Existing fail-closed production defaults remain intact. v0.10 does not enable live checkout, payouts, refunds, Ingram submission or Publishing import.
