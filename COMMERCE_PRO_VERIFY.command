#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.10.0 — commerce regression verification"
node --test tests/foundation.test.mjs
