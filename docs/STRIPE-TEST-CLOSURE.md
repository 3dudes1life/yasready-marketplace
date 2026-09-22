# Stripe Test Commerce Closure — v0.11

v0.11 keeps live money off by default and adds an explicit test certification surface.

## Eight scenarios

1. single-author checkout
2. multi-author checkout
3. signed webhook replay/idempotency
4. digital entitlement grant
5. Connect onboarding
6. refund reconciliation
7. transfer ceiling / seller available balance
8. dispute hold

Admin endpoints can create and complete persisted test runs. A failed scenario does not enable anything automatically. Existing environment switches remain the authority for checkout/refunds/transfers.

`GET /api/admin/commerce/readiness` returns Stripe readiness plus the latest test run and Books-app bridge state.
