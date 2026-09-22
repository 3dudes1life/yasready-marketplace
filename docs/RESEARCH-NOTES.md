# Marketplace provider research notes — September 21, 2026

## Ingram

Current public Ingram materials support the architecture in this build:

- Consumer Direct Fulfillment is positioned for online retailers and describes metadata, stock feeds and EDI fulfillment.
- Publisher sales materials describe EDI integrations that can power website orders while Ingram prints and ships directly to customers.
- IngramSpark Share & Sell supports shareable URLs, QR codes and HTML embeds for print titles.
- Share & Sell is currently print-only.
- Ingram announced an enhanced IndiePubs direct-to-consumer storefront / Express Checkout in June 2026 for qualifying Ingram Publisher Services clients, further validating that Ingram supports direct-to-consumer publisher commerce models even though YasReady must still establish its own eligibility and technical relationship.

References:
- https://www.ingramcontent.com/retailers/consumer-direct-fulfillment
- https://www.ingramcontent.com/publishers/sales
- https://www.ingramspark.com/sell-my-book
- https://www.ingramspark.com/ecommerce-faq-publisher
- https://www.ingramcontent.com/news/ingram-publisher-services-upgrades-its-e-commerce-platform-indiepubs

## Stripe

Stripe Connect documentation describes separate charges and transfers for marketplace cases where a platform charge can fund multiple connected accounts. Stripe also provides hosted Account Links for Connect onboarding.

The build therefore preserves multi-author carts as a hard requirement rather than assuming one seller per payment.

References:
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/api/account_links/create
- https://docs.stripe.com/api/accounts

## What this build does not claim

- no Ingram partnership has been approved;
- no Ingram private API credentials are present;
- no live Stripe credentials are present;
- no live payments or transfers are enabled;
- no legal conclusion is made about merchant-of-record, marketplace-facilitator, tax or 1099 obligations.
