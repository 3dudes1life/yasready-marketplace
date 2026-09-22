#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.9.0 — Marketing Studio verification"
node scripts/verify-marketing-studio.mjs
