# Consumer Marketplace Contract — v0.8

Marketplace is the canonical reader-commerce service. **YasReady. Books** is expected to be a client of this service, not a parallel library.

## Identity

The same central YasReady `userId` may map to both an `authors` record and a `customers` record. Marketplace does not own passwords.

## Ownership

`customer_entitlements` is the durable digital ownership record for ebooks and audiobooks. A reader/player must require an active entitlement before protected content is opened.

## Progress

`reader_progress` stores format-specific progress:

- ebook: percent + structured locator JSON
- audiobook: percent + seconds position, optional locator JSON

Progress writes require an active entitlement and the progress kind must match the purchased edition format.

## Discovery

Public books may expose author and series routes. Saved and recent lists belong to a customer identity and are separate from ownership.

## Boundary

v0.8 does not implement protected EPUB/audio delivery, DRM, offline downloads or a production reader/player. It creates the identity, entitlement and progress seams those clients will use.
