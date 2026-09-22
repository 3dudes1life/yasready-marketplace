#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.8.0 — Catalog Management verification"
node scripts/verify-catalog.mjs
