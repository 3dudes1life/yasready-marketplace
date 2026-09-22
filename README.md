# Marketplace | YasReady v0.9.0

**Marketing Studio**

Marketplace remains the standalone commerce/discovery product at `marketplace.yasready.com`. v0.9 keeps the v0.8 reader foundation, v0.7 catalog management and all prior commerce/provider boundaries, then turns the existing attribution plumbing into a real indie-author marketing workspace.

## What changed in v0.9

Marketing Studio now treats promotion as part of publishing instead of something the author has to assemble after launch. A book can generate one campaign and reuse that campaign identity across a trackable link, QR code, website button/embed, social copy, email copy, event copy and launch checklist.

Campaign performance keeps visits, orders, conversion, attributed revenue, optional author-entered spend and ROAS together. Free channels remain fully supported; an author never has to enter spend to use the tools.

### New Marketing Studio foundation

- campaign objectives and optional budget/spend
- one-click campaign asset bundles
- launch kits and checklists
- Marketplace-owned short-link records + redirect tracking
- campaign-cost ledger
- conversion, revenue-per-visit and ROAS math
- evidence-based “YasReady Signal” recommendations
- campaign performance by channel
- marketing data included in the Business export seam

### New/expanded APIs

- `GET /api/me/marketing-studio/:bookId`
- `POST /api/me/campaigns` (objective/budget aware)
- `POST /api/me/marketing-studio/:bookId/short-links`
- `POST /api/me/marketing-studio/:bookId/costs`
- `GET /r/:slug` (tracked redirect)

v0.9 does **not** post to social networks, buy ads or spend money for an author. The author owns the campaign; YasReady provides the assets, attribution and evidence.

## Existing systems preserved

- v0.8 reader discovery, library, saved/recent titles and YasReady. Books data contract
- v0.7 catalog drafts, autosave, preview, validation and audit history
- v0.6 YasReady author operating shell
- v0.5 signed Publishing handshake and explicit author launch gate
- v0.4 Ingram bridge/provider operations
- v0.3 Stripe/settlement/refund/payout accounting model

Publishing remains a separate repo and is not modified by this package.

## Quick preview

Double-click:

```bash
SHOWCASE.command
```

The no-install preview now opens the v0.9 Marketing Studio.

## Verification

```bash
npm test
./MARKETING_VERIFY.command
./CONSUMER_VERIFY.command
./UI_CLOSURE_VERIFY.command
./YASREADY_STYLE_VERIFY.command
./PAGES_VERIFY.command
./PUBLISHING_HANDSHAKE_VERIFY.command
./CATALOG_VERIFY.command
```

See `BUILD_REPORT.md` for the exact verified state.
