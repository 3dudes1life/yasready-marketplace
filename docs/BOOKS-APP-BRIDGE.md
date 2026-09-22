# YasReady. Books app bridge — v0.11

Marketplace remains the canonical commerce + entitlement service. The future **YasReady. Books** app should be a reader/player client of Marketplace rather than creating another ownership database.

## Contract

`yasready.books.marketplace.v1`

Hidden routes are under `/api/books-app/v1/*` and remain fail-closed with `BOOKS_APP_BRIDGE_ENABLED=false` until the app exists.

### Built now

- same YasReady identity as Publishing/Marketplace
- guest-purchase claim by the same verified YasReady email
- paid ebook/audiobook → active Marketplace entitlement
- full-refund → entitlement revocation for that refunded digital item
- canonical Library endpoint
- saved/recent/follow state reuse
- cross-device progress with optimistic revision protection
- append-only incremental sync cursor with tombstones
- app install/device registration without a second account system
- digital asset manifests using opaque storage references
- deep-link contract (`yasreadybooks://...`) plus Marketplace web URL

### Deliberately not enabled yet

- content bytes / signed CDN delivery
- push tokens / push delivery
- DRM
- App Store / Play Store commerce

Those remain separate switches so adding the app later does not endanger Marketplace commerce.
