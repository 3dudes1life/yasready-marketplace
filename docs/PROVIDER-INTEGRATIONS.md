# Provider integration plan — v0.2.0

## Stripe Connect

The Worker includes provider hooks for:

- Express connected-account creation
- Account Link onboarding
- connected-account status retrieval
- server-created Checkout Sessions
- `transfer_group` on Marketplace payments
- webhook HMAC verification
- webhook replay protection
- server-side cart price/author validation
- multi-seller allocation planning

The model is compatible with separate charges and transfers, where one platform payment can later fund transfers to multiple connected accounts. That is important because one YasReady cart can contain books by multiple authors.

Live transfers are intentionally not executed in v0.2.0. Refund, dispute and transfer-reversal policy needs to be certified before money leaves the platform balance.

Public Stripe references:
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/api/account_links/create
- https://docs.stripe.com/api/accounts

## Ingram

The code deliberately avoids inventing a private Ingram API. It models the public capabilities YasReady would likely need from the approved retailer/publisher relationship:

1. title metadata;
2. inventory/availability feed;
3. Consumer Direct Fulfillment;
4. EDI order lifecycle;
5. print-on-demand / publisher-direct fulfillment;
6. reporting reconciliation;
7. IngramSpark Share & Sell as a temporary per-edition fallback link.

Public Ingram references:
- https://www.ingramcontent.com/retailers/consumer-direct-fulfillment
- https://www.ingramcontent.com/retailers/ordering-ecommerce
- https://www.ingramcontent.com/publishers/sales
- https://www.ingramspark.com/sell-my-book
- https://www.ingramcontent.com/contact

## Provider truth rule

Marketplace owns normalized commercial records. Provider payloads are evidence with provenance, not the canonical UI model.
