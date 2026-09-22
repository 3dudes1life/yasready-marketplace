# Publishing Handshake — v0.5.0

Marketplace and Publishing remain separate applications and repositories. The handshake is one-way: Publishing may send a completed-production snapshot to Marketplace, but Marketplace never reaches into Publishing's database or source tree.

## Shared identity

`userId` is the canonical YasReady account subject. Marketplace maps that value to exactly one `authors.user_id`. A Publishing source book cannot be reattached to a different user.

## Signed receipt

`POST /api/integrations/publishing/handoff`

The endpoint is fail-closed unless `PUBLISHING_IMPORT_ENABLED=true` and `PUBLISHING_IMPORT_SECRET` is configured. Requests use the header:

`x-yasready-publishing-signature: t=<unix>,v1=<hmac-sha256>`

The signed message is `<timestamp>.<raw request body>`.

## Contract

Schema: `yasready.publishing.marketplace.v1`

Publishing-owned production truth:

- title, subtitle, descriptions, cover, category
- edition format + ISBN
- provider title/SKU references
- production state
- artifact reference/hash

Marketplace-owned commercial truth:

- public slug
- listing visibility/status
- sale price after first import
- provider purchase URL
- campaigns, analytics, orders and reviews

On the first import, `suggestedPriceMinor` seeds the draft edition price. Later Publishing syncs never overwrite the author's Marketplace price; a changed suggested price is preserved as a provenance change instead.

## Explicit launch gate

A successful handoff creates or updates a **draft**. Publishing cannot make a listing live.

The author uses:

- `GET /api/me/books/:bookId/readiness`
- `POST /api/me/books/:bookId/go-live`
- `POST /api/me/books/:bookId/pause`

Go-live writes an auditable `marketplace_launch_events` record and only activates selected editions after readiness checks pass.

## Idempotency and provenance

The import payload is SHA-256 hashed. Replaying the same source book + payload hash returns the existing receipt. Source-book and source-edition links are durable. Production-field changes are logged in `publishing_sync_changes`; Marketplace-owned values are explicitly marked `preserved` rather than silently overwritten.
