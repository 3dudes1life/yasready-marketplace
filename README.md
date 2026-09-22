# Marketplace | YasReady v0.14.0

**Business Intelligence Bridge**

v0.14 turns the old Marketplace → Business export seam into a real sync contract while preserving everything from v0.13 and the hidden YasReady. Books bridge.

## What v0.14 adds

### Business snapshot v2
Business can receive a normalized commercial snapshot through:

`yasready.marketplace.business.v2`

The snapshot is keyed by the same central YasReady `userId` and includes:

- direct Marketplace revenue
- refunds and disputes
- Marketplace fees
- payment processor fees
- fulfillment cost
- author payable
- transferred/payout amounts
- order + unit counts
- format mix
- campaign performance
- tracked marketing spend
- Ingram / external-channel sales
- settlement state
- Analytics Brain signals

All money remains in integer minor units.

### Incremental change feed
Business no longer has to repeatedly import the entire Marketplace history.

Marketplace now records append-only `business_sync_events` for commercial changes such as:

- ledger activity
- settlement changes
- transfers and payouts
- external sales imports
- campaign changes
- marketing costs
- Analytics Brain refreshes

Business asks for changes after its last sequence cursor, then acknowledges the highest sequence it processed.

### No-lost-change snapshot boundary
Marketplace captures the sync cursor **before** computing snapshot aggregates.

That means a transaction occurring during snapshot creation may be replayed in the incremental feed, but it cannot be silently skipped. The contract intentionally favors at-least-once delivery over lossy synchronization.

### Sync evidence
New tables retain the integration trail:

- `business_sync_events`
- `business_sync_consumers`
- `business_sync_runs`

The old `business_export_runs` evidence remains intact.

### Fail-closed service access
Author-side Business previews work immediately, but actual Business-to-Marketplace service sync remains OFF by default:

- `BUSINESS_BRIDGE_ENABLED=false`
- `BUSINESS_BRIDGE_SECRET` must be configured separately

## New APIs

Author preview:

- `GET /api/me/business-bridge/status`
- `GET /api/me/business-bridge/snapshot`
- `GET /api/me/business-bridge/changes`

Secret-gated service bridge:

- `GET /api/internal/business/snapshot?userId=...`
- `GET /api/internal/business/changes?userId=...&after=...`
- `POST /api/internal/business/ack`

The legacy `/api/me/business-export` v1 route remains for backward compatibility.

## Product boundary

**Publishing | YasReady** owns production truth.  
**Marketplace | YasReady** owns commercial truth.  
**YasReady. Books** owns the reader experience against Marketplace entitlements.  
**Business | YasReady** combines Marketplace truth with the rest of the company.

Marketplace does not call tracked selling contribution full-company profit. Payroll, editing, design, software, tax, bank activity, overhead and non-Marketplace revenue remain Business concerns.

## YasReady. Books remains intact

The future Books app contract from v0.11 remains unchanged: digital purchase → entitlement → Library → cross-device reading/listening progress → future app sync.

## Quick preview

Double-click `SHOWCASE.command`.

## Verification

```bash
npm test
npm run verify:business-bridge
npm run verify:publishing
npm run verify:publishing-live
npm run verify:ingram-ops
npm run verify:books
npm run verify:stripe-test
npm run verify:analytics
npm run verify:catalog
npm run verify:consumer
npm run verify:marketing
npm run verify:ui
npm run verify:style
npm run verify:pages
```

Production migrations and service activation remain deliberate manual actions.
