# Marketplace | YasReady

**v0.1.0 — Marketplace Foundation**

Standalone foundation for `marketplace.yasready.com` and the repo:
`https://github.com/3dudes1life/yasready-marketplace.git`

This first build is deliberately isolated from Publishing | YasReady.

## What is already here

- YasReady-family visual system and responsive consumer storefront
- multi-format book model: ebook, paperback, hardcover, audiobook
- seeded demo marketplace using the Tres Amigos series plus a second demo author
- multi-author cart behavior
- author dashboard with gross sales, author earnings, units, conversion, format mix, attribution and recent fulfillment state
- free Marketing Kit with campaign URLs, locally generated QR codes, embeddable HTML buy buttons and ready-to-post copy
- event tracking foundation for marketing and conversion analytics
- D1 schema for authors, books, editions, campaigns, customers, orders, order items, ledger entries, payouts, fulfillment jobs, events and provider sync runs
- Stripe-ready marketplace economics and multi-seller allocation model
- Ingram-ready metadata, inventory, fulfillment, reporting and Share & Sell fallback seams
- fail-closed live commerce defaults

## Demo it locally

```bash
npm install
npm run dev
```

Vite will print the local URL. The storefront works without any credentials.

## Verify before GitHub

```bash
npm install
npm run verify
```

## Cloudflare foundation

1. Create a D1 database named `yasready-marketplace`.
2. Replace `REPLACE_AFTER_D1_CREATE` in `wrangler.jsonc` with the returned database ID.
3. Apply migrations locally first:

```bash
npm run db:migrate:local
```

4. Keep `CHECKOUT_ENABLED=false`, `STRIPE_MODE=off`, and `INGRAM_MODE=off` until each live provider path is separately certified.

## Production sequence

1. Deploy demo/private beta at `marketplace.yasready.com`.
2. Add authentication + author ownership.
3. Add Stripe Connect onboarding in test mode.
4. Certify Stripe test checkout/webhooks/refunds/replay safety.
5. Pursue Ingram retailer/integration onboarding and map the actual credentials/feeds to the existing provider boundary.
6. Add one-way completed-book import from Publishing only after Marketplace stands on its own.
7. Add normalized commerce export for Business after Marketplace data has real production history.

## Non-goals of v0.1.0

- no live payment creation
- no live Stripe transfers
- no live Ingram order submission
- no attempt to modify Publishing
- no claim that Ingram has approved YasReady for retailer/CDF/EDI access

Those are activation steps, not missing architecture.
