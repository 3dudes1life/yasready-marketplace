# Marketplace | YasReady v0.13.0

**Publishing Handshake Live Test**

v0.13 keeps the v0.12 Ingram Operations layer, v0.11 Stripe/Books bridge, and every existing Marketplace feature intact while closing the most important safety gap in the Publishing → Marketplace connection: **later production revisions no longer silently rewrite an existing Marketplace book.**

## What v0.13 adds

### Reviewable Publishing updates
The first signed Publishing package can still create a Marketplace draft under the same YasReady account. Later changed revisions are now staged in `publishing_update_reviews`.

The author can see the field-level production diff and explicitly:

- **Apply production update**
- **Reject update**

Publishing-owned production truth can change only after the review is applied. Marketplace-owned commercial truth—price, listing visibility, campaigns, live state, sales and analytics—remains protected.

### Separate production approval and sale approval
Applying a production update does **not** put the book on sale.

The existing readiness + go-live gate remains separate:

1. Publishing sends production truth.
2. Marketplace stages later revisions.
3. Author approves/rejects the production update.
4. Marketplace runs sale readiness.
5. Author explicitly approves selected editions for sale.

Publishing still cannot push a book live.

### Live-test tooling
`PUBLISHING_LIVE_TEST.command` can exercise a running local/staging Worker end-to-end with a unique test book:

- signed handoff
- first-draft creation
- replay protection
- second production revision
- staged review diff
- Marketplace price preservation
- author apply
- sale-readiness check
- author go-live when eligible

`PUBLISHING_LIVE_VERIFY.command` verifies the architecture without requiring a running Worker.

### Evidence tables
v0.13 adds:

- `publishing_update_reviews`
- `publishing_handshake_test_runs`
- `publishing_handshake_test_events`

These retain the review and certification trail instead of relying on screenshots or memory.

## New/updated APIs

- `GET /api/me/publishing/imports` now includes review state
- `GET /api/me/books/:bookId/publishing-review`
- `POST /api/me/books/:bookId/publishing-review/:reviewId/apply`
- `POST /api/me/books/:bookId/publishing-review/:reviewId/reject`
- `GET /api/admin/publishing/live-test/runs`
- `POST /api/admin/publishing/live-test/run`

The signed receiver remains:

- `POST /api/integrations/publishing/handoff`

## Safety defaults

Tracked defaults remain fail-closed:

- `PUBLISHING_IMPORT_ENABLED=false`
- `PUBLISHING_LIVE_TEST_ENABLED=false`
- `CHECKOUT_ENABLED=false`
- `STRIPE_MODE=off`
- `INGRAM_MODE=off`
- `BOOKS_APP_BRIDGE_ENABLED=false`
- `BOOKS_APP_DELIVERY_ENABLED=false`
- `BOOKS_APP_PUSH_ENABLED=false`

## YasReady. Books remains built in

The future Books app contract is unchanged. Marketplace still owns the canonical paid ebook/audiobook entitlement, Library state, Saved/Recent, cross-device progress, guest-purchase claiming, sync cursors and content manifests.

## Quick preview

Double-click `SHOWCASE.command`.

## Verification

```bash
npm test
npm run verify:publishing
npm run verify:publishing-live
npm run verify:ingram-ops
npm run verify:books
npm run verify:stripe-test
npm run verify:analytics
npm run verify:catalog
npm run verify:consumer
npm run verify:marketing
npm run verify:ui
npm run verify:style
npm run verify:pages
```

For an actual local/staging handshake smoke test, configure the test-only Publishing flags and run `PUBLISHING_LIVE_TEST.command`.
