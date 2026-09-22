#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Marketplace | YasReady v0.2.0 — first run"
echo "Installing dependencies..."
npm install
echo "Running verification..."
npm run verify
echo
echo "PASS — v0.2.0 is ready."
echo "For the UI demo, double-click SHOWCASE.command."
