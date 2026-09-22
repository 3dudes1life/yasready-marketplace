#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.11.0 — Analytics Brain verification"
node scripts/verify-marketing-studio.mjs
