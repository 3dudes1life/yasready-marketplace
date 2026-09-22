# Changelog

## 0.11.0 — Stripe Test Commerce Closure + YasReady. Books App Bridge

### Commerce
- Added explicit Stripe test-readiness model and eight-scenario certification runbook.
- Persisted commerce test runs and results.
- Added admin commerce readiness endpoint.
- Preserved signed webhook replay protection, Connect onboarding, refunds, disputes, seller transfer ceilings and fail-closed live switches.
- Added reader order-history APIs.

### Digital ownership
- Successful digital purchases now grant ebook/audiobook entitlements.
- Fully refunded digital items can revoke their entitlement without deleting purchase history.
- Guest purchases can be claimed by the same YasReady identity email later.

### Future YasReady. Books app
- Added hidden versioned app contract.
- Added app bootstrap/library endpoints.
- Added device/install registration.
- Added incremental sync cursor with tombstones.
- Added optimistic cross-device progress revisions.
- Added opaque digital-asset manifest model.
- Added future `yasreadybooks://` deep-link contract.
- Delivery and push remain disabled.

### Safety
- No live money was enabled.
- No Books app content delivery was enabled.
- Publishing and Ingram production switches remain unchanged/off.
