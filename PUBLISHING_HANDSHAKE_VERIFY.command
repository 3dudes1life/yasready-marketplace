#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/verify-publishing.mjs
npm test
