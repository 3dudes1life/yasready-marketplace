# Marketplace | YasReady — v0.2.0 architecture

## Hard product boundaries

`Publishing -> completed-book payload -> Marketplace`

`Marketplace -> versioned commerce export -> Business`

Marketplace is deployable and testable without either adjacent product.

## Identity

Marketplace trusts the central YasReady identity and maps `sub -> authors.user_id`.

No Marketplace password database exists.

## Canonical ownership

- Publishing owns production files/workflow.
- Marketplace owns listings, commerce, promotion attribution, fulfillment state and author earnings.
- Business owns whole-company analysis.

## Book model

`Book -> Listing -> Editions`

One listing can expose any combination of:

- ebook
- paperback
- hardcover
- audiobook

That prevents the later audiobook storefront from becoming a second marketplace.

## Commerce model

An order can contain items from multiple authors. Every order item preserves:

- gross
- estimated fulfillment cost
- processor fee
- allocated tax
- marketplace fee
- seller payable

Payment and fulfillment are separate state machines.

## Provider model

Stripe and Ingram are adapters behind Marketplace-owned records. Neither provider becomes the Marketplace database.

## Analytics

`marketplace_events` is first-class from the beginning. Marketing attribution is not reconstructed after launch.
