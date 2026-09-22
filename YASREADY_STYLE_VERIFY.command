#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.7.0 — shared visual parity verification"
node scripts/verify-yasready-style.mjs
