# Marketplace -> Business Intelligence Bridge

Marketplace captures the commercial truth while a sale happens. Business | YasReady should consume that truth through a versioned bridge rather than querying Marketplace's private tables.

## v0.14 contract

Primary snapshot schema:

`yasready.marketplace.business.v2`

Incremental change schema:

`yasready.marketplace.business.change.v1`

The bridge is keyed by the **same central YasReady user ID** used by Publishing, Marketplace and the future Books app. Business does not match companies by author name or email.

## Sync model

Business performs three steps:

1. Request a **snapshot** for the YasReady user. The snapshot includes a `throughSequence` cursor.
2. Request **incremental changes** after that sequence. Changes are append-only commercial events such as ledger activity, settlement changes, payouts, external channel sales, marketing costs and Analytics Brain refreshes.
3. **Acknowledge** the highest sequence Business has successfully processed. Marketplace stores that acknowledgement as sync evidence.

The snapshot captures its cursor **before** computing aggregates. If Marketplace changes while the snapshot is being built, Business may replay a change after the snapshot, but it will not silently skip one. The bridge therefore favors at-least-once delivery over lossy synchronization.

## Snapshot shape

```json
{
  "schema": "yasready.marketplace.business.v2",
  "source": "marketplace.yasready.com",
  "identity": {
    "yasreadyUserId": "central-yasready-sub",
    "marketplaceAuthorId": "author-id",
    "displayName": "Author Name"
  },
  "sync": {
    "throughSequence": 186,
    "cursorType": "business_sync_events.seq"
  },
  "period": {
    "start": "2026-09-01T00:00:00.000Z",
    "end": "2026-09-30T23:59:59.999Z"
  },
  "commerce": {
    "currency": "usd",
    "grossSalesMinor": 248641,
    "refundsMinor": 1799,
    "marketplaceFeesMinor": 12432,
    "processorFeesMinor": 8234,
    "fulfillmentCostMinor": 51740,
    "sellerPayableMinor": 162174,
    "transferredMinor": 52340,
    "orders": 123,
    "units": 137
  },
  "formats": [],
  "campaigns": [],
  "externalChannels": [],
  "marketing": {},
  "analytics": {},
  "settlements": {},
  "payouts": {}
}
```

Money remains in **integer minor units**. Business never has to reverse UI rounding.

## Incremental changes

Business requests:

`GET /api/internal/business/changes?userId=<yasready-user-id>&after=<sequence>`

Each row contains an immutable sequence, event type, object reference, timestamp and normalized payload. The initial change sources in v0.14 include:

- ledger entries
- settlement allocation creation and updates
- transfers
- payouts
- external channel sales
- marketing campaign costs
- campaign changes
- Analytics Brain refreshes

A full snapshot remains the baseline for aggregate state; incremental rows tell Business what changed after that baseline.

## Acknowledgement

Business acknowledges a processed cursor with:

`POST /api/internal/business/ack`

using the same YasReady user ID and a `throughSequence`. Marketplace will not allow Business to acknowledge beyond the latest known sequence.

## Service authentication

The service-to-service endpoints are **fail closed** by default:

- `BUSINESS_BRIDGE_ENABLED=false`
- `BUSINESS_BRIDGE_SECRET` must be configured separately

The author-facing workspace can preview the bridge without enabling Business service access.

## Provenance boundary

Marketplace provides the selling layer:

- direct orders and order items
- immutable money ledger
- refunds and disputes
- Marketplace and processor fees
- fulfillment cost
- seller payable and transfers
- Ingram / external channel sales
- marketing spend and attribution
- format mix
- Analytics Brain observations

Business | YasReady adds the rest of the company context: bank activity, non-Marketplace revenue, editing/design expenses, software, payroll, taxes, overhead, other sales channels and full-company operating intelligence.

Marketplace never labels its tracked selling contribution as full company profit.

## Legacy v1 export

`/api/me/business-export` and `yasready.marketplace.business.v1` remain available for backward compatibility in v0.14. New Business integrations should use the v2 snapshot + incremental bridge.
