#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "YASREADY MARKETPLACE v0.13.0 — PUBLISHING HANDSHAKE LIVE TEST VERIFY"
node scripts/verify-publishing-live.mjs
