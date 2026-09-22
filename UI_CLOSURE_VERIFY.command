#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.9.0 — UI Closure verification"
node scripts/verify-ui-closure.mjs
