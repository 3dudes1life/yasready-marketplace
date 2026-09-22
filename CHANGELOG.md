# Changelog

## 0.14.0 — Business Intelligence Bridge

### Versioned Business contract
- Added `yasready.marketplace.business.v2` snapshot schema.
- Added `yasready.marketplace.business.change.v1` incremental-event schema.
- Same central YasReady user ID is the cross-product identity key.
- Money remains integer minor units with explicit provenance.

### Incremental sync
- Added append-only `business_sync_events`.
- Added per-consumer acknowledgement cursors in `business_sync_consumers`.
- Added `business_sync_runs` for snapshot/change/ack evidence.
- Added ledger, settlement, transfer, payout, external-sale, marketing-cost, campaign and Analytics Brain triggers.
- Snapshot cursor is captured before aggregation so concurrent writes can replay but cannot be skipped.

### APIs + UI
- Added author Business Bridge status/snapshot/change preview APIs.
- Added secret-gated internal Business snapshot/change/ack APIs.
- Added a first-class Business workspace in the YasReady author shell.
- Legacy Business v1 export remains available for compatibility.

### Safety
- `BUSINESS_BRIDGE_ENABLED=false` remains the tracked default.
- Service sync also requires `BUSINESS_BRIDGE_SECRET`.
- No Business integration gets direct Marketplace database access.

### Preserved
- v0.13 Publishing Handshake Live Test.
- v0.12 Ingram Operations Closure.
- v0.11 Stripe test commerce + hidden YasReady. Books bridge.
- Analytics Brain, Marketing Studio, Consumer Marketplace, Catalog Management, GitHub Pages and YasReady visual parity.

## 0.13.0 — Publishing Handshake Live Test

### Publishing review gate
- Existing-book Publishing updates are staged instead of applied immediately.
- Added durable `publishing_update_reviews` with payload, diff, revision, resolution and reviewer evidence.
- Added author Apply / Reject actions for pending production revisions.
- Added field-level diff display in the Launch workspace.
- Publishing-owned fields move from `needs_review` to `applied` only after author approval.
- Marketplace-owned price differences remain `preserved`.

### Identity + ownership
- Same YasReady `userId` remains the canonical cross-product subject.
- Publishing source books still cannot be moved to a different YasReady account.
- Review resolution verifies the same author/book/link relationship again before mutation.

### Live-test evidence
- Added `publishing_handshake_test_runs` and `publishing_handshake_test_events`.
- Added admin Publishing live-test preflight APIs.
- Added `PUBLISHING_LIVE_VERIFY.command` for architecture regression checks.
- Added `PUBLISHING_LIVE_TEST.command` for a real running-Worker smoke test.
- Added a second-revision handoff example for review testing.

### Launch safety
- Applying a production update does not make a listing live.
- Existing readiness and explicit author go-live gates remain separate.
- `PUBLISHING_LIVE_TEST_ENABLED=false` is now a tracked default.

### Preserved
- v0.12 Ingram Operations Closure.
- v0.11 Stripe test commerce and hidden YasReady. Books bridge.
- Analytics Brain, Marketing Studio, Consumer Marketplace, Catalog Management, Business export, GitHub Pages and YasReady visual parity.
