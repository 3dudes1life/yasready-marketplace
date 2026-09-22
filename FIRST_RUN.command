#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo ""
echo "Marketplace | YasReady — v0.1.0"
echo "================================="
echo "Opening the zero-install demo..."
open "DEMO.html"
echo ""
echo "For the full development build later:"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "Live Stripe and Ingram actions are intentionally OFF in this build."
