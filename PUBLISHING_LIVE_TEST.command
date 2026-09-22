#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "YASREADY MARKETPLACE v0.13.0 — END-TO-END PUBLISHING HANDSHAKE SMOKE TEST"
echo "Requires a running Marketplace Worker with demo auth, PUBLISHING_IMPORT_ENABLED=true and PUBLISHING_IMPORT_SECRET set."
node scripts/publishing-live-test.mjs
