# Publishing Handshake Live Test — v0.13.0

v0.13.0 proves the Marketplace side of the Publishing → Marketplace bridge without modifying the Publishing repository.

## What changed

The first signed package for a Publishing book still creates a Marketplace draft under the same YasReady `userId`. Later production revisions no longer mutate an existing Marketplace book immediately. They are stored as a **pending production review** with a field-level diff.

Publishing-owned changes such as ISBNs, production status, provider references, artifact hashes, title/cover production metadata, and newly-added editions can be reviewed and explicitly applied by the author. Marketplace-owned commercial truth—especially sale price, listing visibility, campaign data, live state, orders and analytics—is preserved.

## Review flow

1. Publishing sends `yasready.publishing.marketplace.v1` with the signed HMAC header.
2. Marketplace validates schema, signature, source ownership and replay hash.
3. First receipt creates a draft book.
4. Later changed receipts create `publishing_update_reviews.status = pending`.
5. The same YasReady user sees the diff in Marketplace.
6. The author chooses **Apply production update** or **Reject update**.
7. Applying changes updates only Publishing-owned production truth.
8. The author sale gate remains separate; Publishing still cannot make a book live.

## APIs

- `POST /api/integrations/publishing/handoff`
- `GET /api/me/publishing/imports`
- `GET /api/me/books/:bookId/publishing-review`
- `POST /api/me/books/:bookId/publishing-review/:reviewId/apply`
- `POST /api/me/books/:bookId/publishing-review/:reviewId/reject`
- `GET /api/me/books/:bookId/readiness`
- `POST /api/me/books/:bookId/go-live`

Admin preflight evidence:

- `GET /api/admin/publishing/live-test/runs`
- `POST /api/admin/publishing/live-test/run`

## End-to-end smoke test

`PUBLISHING_LIVE_TEST.command` can test a running local/staging Worker. It creates a unique test book, verifies replay protection, sends a second production revision, confirms the review diff and price-preservation behavior, applies the review as the same demo YasReady user, runs readiness, and exercises the author launch gate when eligible.

Required for that test only:

```text
PUBLISHING_IMPORT_ENABLED=true
PUBLISHING_LIVE_TEST_ENABLED=true
PUBLISHING_IMPORT_SECRET=<test secret>
MARKETPLACE_TEST_URL=http://127.0.0.1:8787
```

The tracked defaults remain fail-closed.

## YasReady. Books

This release does not change the reader-app contract. Digital purchase entitlements, Library state, cross-device progress, sync cursors and content manifests remain owned by Marketplace and available to the future YasReady. Books app through the existing versioned bridge.
