# Changelog

## 0.8.0 — Consumer Marketplace Closure

- Rebuilt the public Marketplace around consumer discovery rather than an author-oriented catalog.
- Added digital-first, audiobook, recent, genre and full-catalog discovery surfaces.
- Added Saved books with API + local demo persistence.
- Added Recently viewed with API + local demo persistence.
- Added public author storefronts and author-follow persistence.
- Added series metadata and reading-order pages.
- Added reader/customer mapping to the same central YasReady user identity.
- Added reader library API backed by existing digital entitlements.
- Added ebook/audiobook reading/listening progress persistence.
- Added consumer mobile styling and richer book detail presentation.
- Added explicit YasReady. Books bridge: Marketplace owns entitlement/progress truth; future app reads it.
- Added `0010_consumer_marketplace.sql` and `src/lib/consumer.mjs`.
- Added v0.8 consumer regression suite.
- Preserved all v0.7 catalog management and prior commerce/provider safety gates.

## 0.7.0 — Real Catalog & Book Management

- Added Marketplace-owned presentation overrides without replacing Publishing production truth.
- Added autosaved working drafts, validation, live preview, apply revision and catalog history.
- Added author-profile concurrency protection and listing revision locks.
- Added real edition price/status controls and safer catalog editing.
