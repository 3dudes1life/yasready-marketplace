# Marketplace provider research notes — September 21, 2026

These notes document the external capabilities the v0.1.0 architecture was designed around. They are not a claim that YasReady already has contractual access to any Ingram or Stripe production service.

## Ingram Content Group

Current retailer documentation describes Consumer Direct Fulfillment as a retailer service that can process orders originating on the retailer's website and ship directly to the customer. The published integration model is explicitly split into three areas: metadata, stock feed, and EDI fulfillment (PO -> POA -> pick/pack -> ASN -> invoice).

- Consumer Direct Fulfillment: https://www.ingramcontent.com/retailers/consumer-direct-fulfillment
- Retail ordering / EDI: https://www.ingramcontent.com/retailers/ordering-ecommerce
- Data services: https://www.ingramcontent.com/retailers/data-services
- Technical integration contact: https://www.ingramcontent.com/contact

Ingram's data-services documentation describes bibliographic, image, and stock data via FTP or Web Service. This is why Marketplace separates catalog metadata from inventory state instead of pretending they are the same feed.

IngramSpark Share & Sell currently provides author/publisher purchase links and reporting. Current public documentation says completed sales can be reported with unit counts and country, while buyer personally identifiable information is not shared with the publisher. Current US Share & Sell fulfillment fee is listed as $3.50 per copy, before print cost; terms can change and should be rechecked before launch.

- Share & Sell: https://www.ingramspark.com/sell-my-book
- Share & Sell publisher FAQ: https://www.ingramspark.com/ecommerce-faq-publisher

CoreSource is relevant to the later multi-format strategy because Ingram markets it for digital asset distribution including ebook and audiobook channels. Marketplace does not assume CoreSource access in v0.1.0.

- CoreSource distribution partners: https://lp.ingramcontent.com/publishers/coresource-direct-partners
- Ingram analytics: https://www.ingramcontent.com/publishers/analytics

## Stripe Connect

Stripe Connect documentation supports separate charges and transfers where a platform charge can later be transferred to multiple connected accounts. That is the main reason the Marketplace cart and database are multi-seller from day one instead of hard-coded to one author per order.

- Separate charges and transfers: https://docs.stripe.com/connect/separate-charges-and-transfers
- Marketplace / collect then transfer guide: https://docs.stripe.com/connect/collect-then-transfer-guide

Stripe documents Account Links / Connect Onboarding for connected-account onboarding.

- Account Links: https://docs.stripe.com/api/account_links

Stripe recommends using server-side Checkout/webhook events such as `checkout.session.completed` to trigger order fulfillment rather than trusting the browser redirect after payment. Marketplace therefore keeps payment, order, fulfillment, and ledger states separate and reserves webhook idempotency keys in the schema.

- Checkout post-payment events: https://docs.stripe.com/payments/existing-customers

## Design decision

v0.1.0 deliberately creates adapter boundaries rather than coding to credentials or undocumented endpoints. The correct live implementation should be selected only after YasReady's actual Ingram retailer/fulfillment relationship and Stripe Connect account configuration are approved.
