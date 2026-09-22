#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "YASREADY MARKETPLACE — v0.13.0 INGRAM OPERATIONS VERIFY"
node --test tests/ingram-operations.test.mjs
node scripts/verify-ingram-operations.mjs
