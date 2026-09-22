# Marketplace -> Business handoff

Marketplace captures commercial truth while the transaction happens. Business should consume a versioned export rather than querying Marketplace's private tables.

## Schema

`yasready.marketplace.business.v1`

Example:

```json
{
  "schema": "yasready.marketplace.business.v1",
  "source": "marketplace.yasready.com",
  "author": {
    "id": "author-id",
    "userId": "central-yasready-sub",
    "displayName": "Author Name"
  },
  "period": {
    "start": "2026-09-01T00:00:00.000Z",
    "end": "2026-09-30T23:59:59.999Z"
  },
  "totals": {
    "grossSalesMinor": 248641,
    "refundsMinor": 0,
    "marketplaceFeesMinor": 12432,
    "processorFeesMinor": 0,
    "fulfillmentCostMinor": 51740,
    "sellerPayableMinor": 162174,
    "orders": 123,
    "units": 137
  },
  "formats": [],
  "campaigns": []
}
```

Money remains in integer minor units so Business never has to reverse rounding done in a UI.

## Why this exists in v0.3

The Marketplace is likely to become a natural acquisition funnel for Business: once an author can see what they sold and which campaign caused it, Business can add the rest of the company context (ads, editing, subscriptions, event costs, taxes, bank activity and other revenue channels).

## v0.10 Analytics Brain

Marketplace's `yasready.marketplace.business.v1` envelope can now include an optional `analytics` object containing tracked contribution economics, comparable-period changes, book-level contribution and compact signal summaries. These are Marketplace observations only; Business remains responsible for full-company profitability and operating intelligence.
