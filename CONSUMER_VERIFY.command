#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.11.0 — Consumer Marketplace verification"
node scripts/verify-consumer.mjs
