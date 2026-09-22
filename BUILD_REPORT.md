# Marketplace | YasReady v0.13.0 — Build Report

**Publishing Handshake Live Test**

## Verified in this build environment

- `npm test`: **124/124 PASS**
- Publishing Handshake verifier: **8/8 PASS**
- Publishing Live Test verifier: **12/12 PASS**
- UI Closure: **20/20 PASS**
- Catalog Management: **16/16 PASS**
- Consumer Marketplace: **12/12 PASS**
- Marketing Studio: **16/16 PASS**
- Analytics Brain: **20/20 PASS**
- YasReady. Books bridge: **12/12 PASS**
- Stripe Test Closure: **10/10 PASS**
- Ingram Operations: **12/12 PASS**
- YasReady visual parity: **16/16 PASS**
- GitHub Pages: **7/7 PASS**
- Fresh database replay: **15/15 migrations PASS**
- Fresh schema: **81 application tables**
- New Publishing review/test tables confirmed present
- JS syntax checks passed for Worker, UI, live-test script and verifier

## Important behavioral closure

- First Publishing receipt creates a safe draft.
- Later changed production revisions are staged for review.
- The author can apply or reject a staged revision.
- Marketplace prices remain protected from Publishing suggestions.
- Production approval and sale approval remain separate gates.
- Same-account ownership and replay protection remain enforced.
- YasReady. Books entitlement/library architecture is unchanged.

## Not executed here

The actual networked `PUBLISHING_LIVE_TEST.command` was not run because this build environment is not running the Cloudflare Worker with a configured test secret. The command is included for local/staging execution.

The Vite production bundle is not marked verified because this environment does not have installed npm dependencies/Vite. No claim is made that the production bundle was built here.
