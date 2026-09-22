#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady — v0.14.0 Business Intelligence Bridge verification"
node scripts/verify-business-bridge.mjs
